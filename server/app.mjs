// server/app.mjs — API HTTP KolaPass (sans dépendance externe : module http de Node).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  LOCK_MINUTES, MAX_FAILED_ATTEMPTS, SESSION_IDLE_MS, SESSION_MAX_MS,
  burnTime, hashPassword, hashToken, newToken, passwordProblem, safeEqual, temporaryPassword, verifyPassword,
} from './auth.mjs';
import {
  HttpError, ROLES, audit, createEvent, decidePayout, generateBatch, newId, publicUser, requestPayout,
  scan, sellPasses, setPassBlacklist, stateFor, syncOfflineScans, updateEventStatus, updateSettings,
} from './kolapass.mjs';

const COOKIE = 'kp_session';
const MAX_BODY = 2 * 1024 * 1024;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

export function createApp({ store, setupCode, distDir, secureCookies = false, devMiddleware = null }) {
  // Tentatives de connexion par adresse IP (limite anti-force brute).
  const ipAttempts = new Map();

  function send(res, status, body, extra = {}) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra });
    res.end(json);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', c => {
        size += c.length;
        if (size > MAX_BODY) { reject(new HttpError(413, 'Requête trop volumineuse.')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON invalide.')); }
      });
      req.on('error', reject);
    });
  }

  const cookieOf = req => {
    const m = /(?:^|;\s*)kp_session=([^;]+)/.exec(req.headers.cookie || '');
    return m ? decodeURIComponent(m[1]) : null;
  };
  const setCookie = token => `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_MS / 1000}${secureCookies ? '; Secure' : ''}`;
  const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookies ? '; Secure' : ''}`;
  const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  /** Session valide → utilisateur ; sinon null. */
  async function sessionUser(req) {
    const token = cookieOf(req);
    if (!token) return null;
    const h = hashToken(token);
    const db = store.read();
    const s = db.sessions.find(x => x.tokenHash === h);
    if (!s) return null;
    const now = Date.now();
    if (now - s.lastSeen > SESSION_IDLE_MS || now - s.createdAt > SESSION_MAX_MS) {
      await store.write(d => { d.sessions = d.sessions.filter(x => x.tokenHash !== h); });
      return null;
    }
    const u = db.users.find(x => x.id === s.userId);
    if (!u || !u.active) return null;
    if (now - s.lastSeen > 60_000) await store.write(d => { const t = d.sessions.find(x => x.tokenHash === h); if (t) t.lastSeen = now; });
    return { user: u, tokenHash: h };
  }

  async function requireUser(req, { allowPasswordChange = false } = {}) {
    const s = await sessionUser(req);
    if (!s) throw new HttpError(401, 'Session expirée : reconnectez-vous.');
    if (s.user.mustChangePassword && !allowPasswordChange) throw new HttpError(403, 'Changez d\'abord votre mot de passe provisoire.');
    // Anti-CSRF : les écritures doivent venir de l'application (en-tête ajouté par fetch).
    if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'kolapass') throw new HttpError(403, 'Requête refusée.');
    return s;
  }

  function validateLogin(login) {
    const l = String(login ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._@+-]{3,60}$/.test(l)) throw new HttpError(400, 'Identifiant invalide (3 à 60 caractères : lettres, chiffres, . _ @ + -).');
    return l;
  }

  async function createSession(res, userId) {
    const token = newToken();
    const now = Date.now();
    await store.write(d => {
      d.sessions = d.sessions.filter(s => now - s.lastSeen < SESSION_IDLE_MS);
      d.sessions.push({ tokenHash: hashToken(token), userId, createdAt: now, lastSeen: now });
    });
    return setCookie(token);
  }

  // -------------------------------------------------------------------------
  async function handleApi(req, res, url) {
    const p = url.pathname;
    const m = req.method;

    if (p === '/api/health' && m === 'GET') return send(res, 200, { ok: true });

    if (p === '/api/public/status' && m === 'GET') {
      const db = store.read();
      return send(res, 200, { initialized: db.users.length > 0, organizationName: db.settings.organizationName || '' });
    }

    // Premier démarrage : création du compte administrateur.
    if (p === '/api/setup' && m === 'POST') {
      const body = await readBody(req);
      if (store.read().users.length > 0) throw new HttpError(409, 'Le serveur est déjà initialisé.');
      if (!setupCode || !safeEqual(String(body.setupCode ?? ''), setupCode)) throw new HttpError(403, 'Code d\'installation incorrect.');
      const login = validateLogin(body.login);
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) throw new HttpError(400, 'Nom obligatoire.');
      const problem = passwordProblem(body.password, login);
      if (problem) throw new HttpError(400, problem);
      const passwordHash = await hashPassword(body.password);
      const admin = await store.write(d => {
        if (d.users.length > 0) throw new HttpError(409, 'Le serveur est déjà initialisé.');
        const u = { id: newId('usr'), name, login, phone: String(body.phone ?? '').slice(0, 40), role: 'admin', passwordHash, mustChangePassword: false, active: true, failedAttempts: 0, createdAt: new Date().toISOString() };
        d.users.push(u);
        d.settings.organizationName = String(body.organizationName ?? '').trim().slice(0, 120);
        audit(d, u, 'Installation', `Compte administrateur créé : ${login}`);
        return u;
      });
      const cookie = await createSession(res, admin.id);
      return send(res, 201, { user: publicUser(admin) }, { 'Set-Cookie': cookie });
    }

    if (p === '/api/auth/login' && m === 'POST') {
      const ip = clientIp(req);
      const a = ipAttempts.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - a.t > 15 * 60_000) { a.n = 0; a.t = Date.now(); }
      if (a.n >= 30) throw new HttpError(429, 'Trop de tentatives depuis ce poste. Réessayez dans 15 minutes.');
      a.n++; ipAttempts.set(ip, a);

      const body = await readBody(req);
      const login = String(body.login ?? '').trim().toLowerCase();
      const u = store.read().users.find(x => x.login === login);
      if (!u || !u.active) { await burnTime(body.password); throw new HttpError(401, 'Identifiant ou mot de passe incorrect.'); }
      if (u.lockedUntil && Date.now() < u.lockedUntil) {
        const min = Math.ceil((u.lockedUntil - Date.now()) / 60000);
        throw new HttpError(423, `Compte bloqué après ${MAX_FAILED_ATTEMPTS} essais : réessayez dans ${min} min ou demandez à l'administrateur.`);
      }
      if (!(await verifyPassword(body.password, u.passwordHash))) {
        const left = await store.write(d => {
          const x = d.users.find(y => y.id === u.id);
          x.failedAttempts = (x.failedAttempts || 0) + 1;
          if (x.failedAttempts >= MAX_FAILED_ATTEMPTS) {
            x.lockedUntil = Date.now() + LOCK_MINUTES * 60_000;
            x.failedAttempts = 0;
            audit(d, x, 'Compte bloqué', `${MAX_FAILED_ATTEMPTS} mots de passe erronés (${ip})`);
            return 0;
          }
          return MAX_FAILED_ATTEMPTS - x.failedAttempts;
        });
        throw new HttpError(left === 0 ? 423 : 401, left === 0
          ? `Compte bloqué ${LOCK_MINUTES} minutes après ${MAX_FAILED_ATTEMPTS} essais.`
          : `Identifiant ou mot de passe incorrect. Il reste ${left} essai(s).`);
      }
      ipAttempts.delete(ip);
      await store.write(d => {
        const x = d.users.find(y => y.id === u.id);
        Object.assign(x, { failedAttempts: 0, lockedUntil: undefined, lastLoginAt: new Date().toISOString() });
      });
      const cookie = await createSession(res, u.id);
      return send(res, 200, { user: publicUser(store.read().users.find(x => x.id === u.id)) }, { 'Set-Cookie': cookie });
    }

    if (p === '/api/auth/logout' && m === 'POST') {
      const token = cookieOf(req);
      if (token) { const h = hashToken(token); await store.write(d => { d.sessions = d.sessions.filter(s => s.tokenHash !== h); }); }
      return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
    }

    if (p === '/api/auth/me' && m === 'GET') {
      const s = await sessionUser(req);
      if (!s) throw new HttpError(401, 'Non connecté.');
      return send(res, 200, { user: publicUser(s.user) });
    }

    if (p === '/api/auth/password' && m === 'POST') {
      const s = await requireUser(req, { allowPasswordChange: true });
      const body = await readBody(req);
      if (!(await verifyPassword(body.currentPassword, s.user.passwordHash))) throw new HttpError(401, 'Mot de passe actuel incorrect.');
      const problem = passwordProblem(body.newPassword, s.user.login);
      if (problem) throw new HttpError(400, problem);
      if (body.newPassword === body.currentPassword) throw new HttpError(400, 'Choisissez un mot de passe différent du mot de passe actuel.');
      const passwordHash = await hashPassword(body.newPassword);
      await store.write(d => {
        const x = d.users.find(y => y.id === s.user.id);
        Object.assign(x, { passwordHash, mustChangePassword: false });
        d.sessions = d.sessions.filter(t => t.userId !== x.id || t.tokenHash === s.tokenHash); // déconnecte les autres postes
        audit(d, x, 'Mot de passe changé', x.login);
      });
      return send(res, 200, { user: publicUser(store.read().users.find(x => x.id === s.user.id)) });
    }

    // ----- Données (toutes protégées) -----
    if (p === '/api/state' && m === 'GET') {
      const { user } = await requireUser(req);
      const since = Number(url.searchParams.get('since'));
      const db = store.read();
      if (since && since === db.version) return send(res, 200, { unchanged: true, version: db.version });
      return send(res, 200, stateFor(db, user));
    }

    // Comptes (administrateur)
    if (p === '/api/users' && m === 'POST') {
      const { user } = await requireUser(req);
      if (user.role !== 'admin') throw new HttpError(403, 'Réservé à l\'administrateur.');
      const body = await readBody(req);
      const login = validateLogin(body.login);
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) throw new HttpError(400, 'Nom obligatoire.');
      if (!ROLES.includes(body.role)) throw new HttpError(400, 'Rôle invalide.');
      const temp = temporaryPassword();
      const passwordHash = await hashPassword(temp);
      const created = await store.write(d => {
        if (d.users.some(x => x.login === login)) throw new HttpError(409, 'Cet identifiant existe déjà.');
        const u = { id: newId('usr'), name, login, phone: String(body.phone ?? '').slice(0, 40), role: body.role, passwordHash, mustChangePassword: true, active: true, failedAttempts: 0, createdAt: new Date().toISOString(), createdBy: user.name };
        d.users.push(u);
        audit(d, user, 'Compte créé', `${login} (${body.role})`);
        return u;
      });
      return send(res, 201, { user: publicUser(created), temporaryPassword: temp });
    }

    const userMatch = /^\/api\/users\/([\w-]+)$/.exec(p);
    if (userMatch && m === 'PATCH') {
      const { user } = await requireUser(req);
      if (user.role !== 'admin') throw new HttpError(403, 'Réservé à l\'administrateur.');
      const body = await readBody(req);
      const id = userMatch[1];
      let temp = null;
      const tempHash = body.resetPassword ? await hashPassword((temp = temporaryPassword())) : null;
      const updated = await store.write(d => {
        const x = d.users.find(y => y.id === id);
        if (!x) throw new HttpError(404, 'Compte introuvable.');
        const admins = d.users.filter(y => y.role === 'admin' && y.active);
        const wouldRemoveLastAdmin = x.role === 'admin' && admins.length === 1 && (body.active === false || (body.role && body.role !== 'admin'));
        if (wouldRemoveLastAdmin) throw new HttpError(409, 'Impossible : c\'est le dernier administrateur actif.');
        if (body.name !== undefined) x.name = String(body.name).trim().slice(0, 120) || x.name;
        if (body.phone !== undefined) x.phone = String(body.phone).slice(0, 40);
        if (body.role !== undefined) { if (!ROLES.includes(body.role)) throw new HttpError(400, 'Rôle invalide.'); x.role = body.role; }
        if (body.active !== undefined) {
          x.active = !!body.active;
          if (!x.active) d.sessions = d.sessions.filter(s => s.userId !== x.id);
        }
        if (body.unlock) { x.lockedUntil = undefined; x.failedAttempts = 0; }
        if (tempHash) {
          x.passwordHash = tempHash; x.mustChangePassword = true; x.lockedUntil = undefined; x.failedAttempts = 0;
          d.sessions = d.sessions.filter(s => s.userId !== x.id);
        }
        audit(d, user, 'Compte modifié', `${x.login} : ${Object.keys(body).join(', ')}`);
        return x;
      });
      return send(res, 200, { user: publicUser(updated), temporaryPassword: temp });
    }

    // Opérations métier
    const routes = [
      ['POST', /^\/api\/events$/, (d, u, b) => createEvent(d, u, b)],
      ['PATCH', /^\/api\/events\/([\w-]+)$/, (d, u, b, id) => updateEventStatus(d, u, id, b.status)],
      ['POST', /^\/api\/passes\/sell$/, (d, u, b) => ({ passes: sellPasses(d, u, b) })],
      ['POST', /^\/api\/batches$/, (d, u, b) => generateBatch(d, u, b)],
      ['POST', /^\/api\/scan$/, (d, u, b) => scan(d, u, b)],
      ['POST', /^\/api\/scan\/sync$/, (d, u, b) => ({ results: syncOfflineScans(d, u, b.scans) })],
      ['POST', /^\/api\/passes\/([\w-]+)\/blacklist$/, (d, u, b, id) => setPassBlacklist(d, u, id, true, b.reason)],
      ['POST', /^\/api\/passes\/([\w-]+)\/reactivate$/, (d, u, b, id) => setPassBlacklist(d, u, id, false)],
      ['POST', /^\/api\/payouts$/, (d, u, b) => requestPayout(d, u, b)],
      ['PATCH', /^\/api\/payouts\/([\w-]+)$/, (d, u, b, id) => decidePayout(d, u, id, b)],
      ['PUT', /^\/api\/settings$/, (d, u, b) => updateSettings(d, u, b)],
    ];
    for (const [method, re, fn] of routes) {
      const match = re.exec(p);
      if (match && m === method) {
        const { user } = await requireUser(req);
        const body = await readBody(req);
        const result = await store.write(d => fn(d, d.users.find(x => x.id === user.id), body, match[1]));
        return send(res, 200, { result, version: store.read().version });
      }
    }

    // Sauvegarde / restauration (administrateur)
    if (p === '/api/backup' && m === 'GET') {
      const { user } = await requireUser(req);
      if (user.role !== 'admin') throw new HttpError(403, 'Réservé à l\'administrateur.');
      const { sessions, ...data } = store.read();
      const day = new Date().toISOString().slice(0, 10);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="kolapass-sauvegarde-${day}.json"`, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
      return res.end(JSON.stringify(data));
    }
    if (p === '/api/restore' && m === 'POST') {
      const { user } = await requireUser(req);
      if (user.role !== 'admin') throw new HttpError(403, 'Réservé à l\'administrateur.');
      const body = await readBody(req);
      if (!body || body.schema !== 1 || !Array.isArray(body.users) || !body.users.some(x => x.role === 'admin' && x.active)) {
        throw new HttpError(400, 'Fichier de sauvegarde invalide.');
      }
      await store.replace({ ...body, sessions: [] });
      return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
    }

    throw new HttpError(404, 'Route inconnue.');
  }

  // -------------------------------------------------------------------------
  function serveStatic(req, res, url) {
    if (!distDir) { res.writeHead(404); return res.end(); }
    let rel = decodeURIComponent(url.pathname);
    if (rel.includes('\0')) { res.writeHead(400); return res.end(); }
    let file = path.join(distDir, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(path.resolve(distDir))) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Application non compilée : lancez « npm run build ».'); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ...SECURITY_HEADERS, 'Content-Security-Policy': CSP };
    headers['Cache-Control'] = ext === '.html' ? 'no-cache' : (url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      try {
        await handleApi(req, res, url);
      } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, { error: err.message });
        console.error(err);
        send(res, 500, { error: 'Erreur interne du serveur.' });
      }
      return;
    }
    if (devMiddleware) return devMiddleware(req, res, () => { res.writeHead(404); res.end(); });
    serveStatic(req, res, url);
  };
}

export const randomSetupCode = () => crypto.randomBytes(9).toString('base64url');
