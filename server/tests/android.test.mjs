// Contrat d'API utilisé par l'application Android « KolaPass Scan » : rejoue exactement
// la séquence d'appels de l'appli (connexion, mot de passe provisoire, état, scan du QR brut,
// file hors ligne, déconnexion) sur un serveur démarré avec une base vierge.
// Usage : BASE_URL=http://localhost:3000 SETUP_CODE=... node server/tests/android.test.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SETUP = process.env.SETUP_CODE || 'code-test';
let passed = 0;
function ok(cond, msg, extra) {
  if (!cond) { console.error(`✗ ${msg}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); process.exit(1); }
  passed++; console.log(`✓ ${msg}`);
}

/** Même comportement que Api.kt : cookie kp_session mémorisé, en-tête anti-CSRF partout. */
function androidClient() {
  const c = { cookie: null };
  c.call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: {
        Accept: 'application/json', 'X-Requested-With': 'kolapass', 'User-Agent': 'KolaPassScan/Android',
        ...(c.cookie ? { Cookie: `kp_session=${c.cookie}` } : {}),
        ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const h of res.headers.getSetCookie()) {
      const m = /^kp_session=([^;]*)/.exec(h.trim());
      if (m) c.cookie = m[1] || null;
    }
    const text = await res.text();
    return { code: res.status, body: text ? JSON.parse(text) : {} };
  };
  return c;
}

// --- Préparation par l'administrateur (comme dans le site web) ---
const admin = androidClient();
let r = await admin.call('POST', '/api/setup', { setupCode: SETUP, name: 'Admin', login: 'chef', password: 'Gombe-Kin-2026', organizationName: 'Port de Matadi' });
ok(r.code === 201, 'administrateur créé');
await admin.call('PUT', '/api/settings', { gates: ['Quai 1', 'Quai 2'] });
r = await admin.call('POST', '/api/users', { name: 'Agent Quai 1', login: 'agentq1', role: 'agent' });
const temp = r.body.temporaryPassword;
ok(r.code === 201 && temp, 'compte agent créé avec mot de passe provisoire');
r = await admin.call('POST', '/api/events', { title: 'Traversée Matadi', venue: 'Quai 1', eventDate: '2026-12-01T08:00:00Z', standardPriceUSD: 5, standardCap: 10, vipPriceUSD: 0, vipCap: 0, vvipPriceUSD: 0, vvipCap: 0 });
const ev = r.body.result?.event ?? r.body.result;
ok(r.code === 200 && ev?.id, 'événement créé', r.body);
r = await admin.call('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'Standard', holderName: 'Passager', quantity: 3 });
const passes = r.body.result.passes;
ok(passes.length === 3 && passes[0].qrPayload, 'billets vendus (QR signé)');

// --- Application Android ---
const app = androidClient();
r = await app.call('GET', '/api/auth/me');
ok(r.code === 401, 'sans session : /api/auth/me → 401 (écran de connexion)');
r = await app.call('POST', '/api/auth/login', { login: 'AGENTQ1'.toLowerCase(), password: temp });
ok(r.code === 200 && r.body.user.mustChangePassword === true && app.cookie, 'connexion avec mot de passe provisoire → demande de changement');
r = await app.call('GET', '/api/state');
ok(r.code === 403, 'état refusé tant que le mot de passe provisoire n\'est pas changé');
r = await app.call('POST', '/api/auth/password', { currentPassword: temp, newPassword: 'Quai-Matadi-2026' });
ok(r.code === 200 && r.body.user.mustChangePassword === false, 'mot de passe changé depuis l\'appli');

r = await app.call('GET', '/api/state');
ok(r.code === 200 && r.body.settings.organizationName === 'Port de Matadi', 'état reçu : nom de l\'organisation');
ok(JSON.stringify(r.body.settings.gates) === '["Quai 1","Quai 2"]', 'état reçu : portes');
ok(r.body.events.length === 1 && r.body.passes.length === 3, 'état reçu : événement et billets pour le contrôle hors ligne');
ok(r.body.passes.every(p => !p.holderPhone && p.pricePaidUSD === 0), 'aucun téléphone ni montant envoyé au téléphone de l\'agent');
const version = r.body.version;
r = await app.call('GET', `/api/state?since=${version}`);
ok(r.body.unchanged === true, 'rafraîchissement sans changement : réponse légère');

// Scan du contenu brut du QR, tel que lu par la caméra
r = await app.call('POST', '/api/scan', { code: passes[0].qrPayload, gate: 'Quai 1', eventId: ev.id });
ok(r.body.result.outcome === 'valid_entry' && r.body.result.pass.holderName.startsWith('Passager'), 'QR valide → ENTRÉE OK');
ok(!('holderPhone' in r.body.result.pass) || !r.body.result.pass.holderPhone, 'réponse de scan sans téléphone');
r = await app.call('POST', '/api/scan', { code: passes[0].qrPayload, gate: 'Quai 2' });
ok(r.body.result.outcome === 'fraud_duplicate' && r.body.result.previousCheckIn, 'même QR → DÉJÀ ENTRÉ avec l\'heure du 1er passage');
const forged = JSON.parse(passes[1].qrPayload); forged.sig = '0'.repeat(32);
r = await app.call('POST', '/api/scan', { code: JSON.stringify(forged), gate: 'Quai 1' });
ok(r.body.result.outcome === 'not_found', 'QR falsifié (signature) → INVALIDE');
r = await app.call('POST', '/api/scan', { code: 'E99-INEXISTANT', gate: 'Quai 1' });
ok(r.body.result.outcome === 'not_found', 'code saisi inconnu → INVALIDE');
r = await app.call('POST', '/api/scan', { code: passes[1].passCode.toLowerCase(), gate: 'Quai 1', eventId: 'evt-autre' });
ok(r.body.result.outcome === 'not_found' && r.body.result.wrongEvent, 'billet d\'un autre événement → refusé');

// File hors ligne rejouée au retour du réseau
const t = new Date(Date.now() - 60_000).toISOString();
r = await app.call('POST', '/api/scan/sync', { scans: [{ passCode: passes[1].passCode, gate: 'Quai 2', timestamp: t }, { passCode: passes[0].passCode, gate: 'Quai 2', timestamp: t }] });
const res = r.body.result.results;
ok(res[0].outcome === 'valid_entry' && res[1].outcome === 'fraud_duplicate', 'synchronisation hors ligne : entrée enregistrée, doublon signalé');
r = await app.call('GET', `/api/state?since=${version}`);
ok(!r.body.unchanged && r.body.passes.filter(p => p.status === 'used').length === 2, 'état mis à jour après les scans');

// Session
r = await app.call('POST', '/api/auth/logout');
ok(r.code === 200 && app.cookie === null, 'déconnexion : cookie effacé');
app.cookie = 'jeton-expire';
r = await app.call('POST', '/api/scan', { code: passes[2].passCode, gate: 'Quai 1' });
ok(r.code === 401, 'session expirée → 401 (retour à la connexion)');

console.log(`\n${passed} vérifications réussies (contrat Android).`);
