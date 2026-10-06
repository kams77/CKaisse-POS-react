// Tests de l'API KolaPass sur un serveur démarré (base vierge).
// Usage : BASE_URL=http://localhost:3000 SETUP_CODE=... node server/tests/api.test.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SETUP = process.env.SETUP_CODE || 'code-test';
let passed = 0;
function ok(cond, msg, extra) {
  if (!cond) { console.error(`✗ ${msg}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); process.exit(1); }
  passed++; console.log(`✓ ${msg}`);
}

function client() {
  let cookie = '';
  return async (method, url, body, { csrf = true } = {}) => {
    const res = await fetch(BASE + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-Requested-With': 'kolapass' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
    let json = null;
    try { json = await res.json(); } catch { /* vide */ }
    return { status: res.status, json, headers: res.headers };
  };
}

const admin = client();
let r = await admin('GET', '/api/public/status');
ok(r.status === 200 && r.json.initialized === false, 'serveur vierge');
ok(r.headers.get('x-frame-options') === 'DENY', 'en-têtes de sécurité');

r = await admin('POST', '/api/setup', { setupCode: 'mauvais', name: 'Admin', login: 'admin', password: 'Kinshasa-2026-ok' });
ok(r.status === 403, 'installation : mauvais code refusé');
r = await admin('POST', '/api/setup', { setupCode: SETUP, name: 'Admin', login: 'chef', password: 'court' });
ok(r.status === 400, 'installation : mot de passe faible refusé');
r = await admin('POST', '/api/setup', { setupCode: SETUP, name: 'Administrateur Test', login: 'chef', password: 'Gombe-Kin-2026', organizationName: 'KolaPass Test' });
ok(r.status === 201 && r.json.user.role === 'admin', 'installation : compte administrateur créé');
r = await client()('POST', '/api/setup', { setupCode: SETUP, name: 'X', login: 'pirate', password: 'Gombe-Kin-2026' });
ok(r.status === 409, 'installation : impossible une deuxième fois');

r = await admin('GET', '/api/state');
ok(r.status === 200 && r.json.events.length === 0 && r.json.passes.length === 0, 'démarrage vide (aucune donnée de démonstration)');
r = await client()('GET', '/api/state');
ok(r.status === 401, 'données inaccessibles sans connexion');
r = await admin('PUT', '/api/settings', { maxDiscountPercent: 10 }, { csrf: false });
ok(r.status === 403, 'écriture refusée sans en-tête anti-CSRF');

// Comptes
r = await admin('POST', '/api/users', { name: 'Organisateur Un', login: 'orga1', role: 'organizer', phone: '+243 810000001' });
ok(r.status === 201 && r.json.temporaryPassword && r.json.user.mustChangePassword, 'admin : crée un organisateur avec mot de passe provisoire');
const orgaTemp = r.json.temporaryPassword; const orgaId = r.json.user.id;
r = await admin('POST', '/api/users', { name: 'Organisateur Deux', login: 'orga2', role: 'organizer' });
const orga2Temp = r.json.temporaryPassword;
r = await admin('POST', '/api/users', { name: 'Agent Porte A', login: 'agent1', role: 'agent' });
const agentTemp = r.json.temporaryPassword;
r = await admin('POST', '/api/users', { name: 'Doublon', login: 'ORGA1', role: 'agent' });
ok(r.status === 409, 'identifiant en double refusé');

async function loginNew(login, temp, newPass) {
  const c = client();
  let x = await c('POST', '/api/auth/login', { login, password: temp });
  ok(x.status === 200 && x.json.user.mustChangePassword, `${login} : connexion avec mot de passe provisoire`);
  x = await c('GET', '/api/state');
  ok(x.status === 403, `${login} : bloqué tant que le mot de passe n'est pas changé`);
  x = await c('POST', '/api/auth/password', { currentPassword: temp, newPassword: newPass });
  ok(x.status === 200, `${login} : mot de passe personnel enregistré`);
  return c;
}
const orga = await loginNew('orga1', orgaTemp, 'Lingwala-77-ok');
const orga2 = await loginNew('orga2', orga2Temp, 'Bandal-88-ok');
const agent = await loginNew('agent1', agentTemp, 'Limete-99-ok');

r = await agent('POST', '/api/users', { name: 'X', login: 'xx1', role: 'admin' });
ok(r.status === 403, 'agent : ne peut pas créer de compte');

// Paramètres
r = await admin('PUT', '/api/settings', { maxDiscountPercent: 10, promoCodes: [{ code: 'test15', percent: 15 }], rates: { CDF: 2900, XOF: 600, EUR: 0.9 } });
ok(r.status === 200 && r.json.result.promoCodes[0].code === 'TEST15' && r.json.result.rates.CDF === 2900, 'admin : paramètres (remise max, code promo, taux)');
r = await orga('PUT', '/api/settings', { maxDiscountPercent: 90 });
ok(r.status === 403, 'organisateur : ne modifie pas les paramètres');

// Événements
r = await orga('POST', '/api/events', { title: 'Concert Test', venue: 'Stade', city: 'Kinshasa', eventDate: '2026-12-20T18:00:00Z', standardPriceUSD: 10, standardCap: 5, vipPriceUSD: 50, vipCap: 2, vvipPriceUSD: 100, vvipCap: 0, commissionRatePercent: 0 });
ok(r.status === 200 && r.json.result.ownerId === orgaId && r.json.result.commissionRatePercent === 10, 'organisateur : crée son événement (commission imposée par la plateforme)');
const ev = r.json.result;
ok(/^EVT-\d{4}-01$/.test(ev.code), 'code événement suivi', ev.code);
r = await agent('POST', '/api/events', { title: 'X', venue: 'Y', eventDate: '2026-12-20', standardPriceUSD: 1, standardCap: 1 });
ok(r.status === 403, 'agent : ne crée pas d\'événement');
r = await orga2('GET', '/api/state');
ok(r.json.events.length === 0, 'organisateur 2 : ne voit pas l\'événement d\'un autre');

// Vente
r = await orga2('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'Standard', holderName: 'Pirate' });
ok(r.status === 403, 'organisateur 2 : ne vend pas pour un autre');
r = await orga('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'Standard', holderName: 'Client A', holderPhone: '+243 811111111', discountPercent: 50 });
ok(r.status === 403, 'remise au-delà du maximum refusée');
r = await orga('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'Standard', holderName: 'Client A', holderPhone: '+243 811111111', promoCode: 'TEST15', quantity: 2, paymentRail: 'M-Pesa', paymentReference: 'MP-123' });
ok(r.status === 200 && r.json.result.passes.length === 2, 'vente de 2 billets avec code promo');
const sold = r.json.result.passes;
ok(sold[0].pricePaidUSD === 8.5 && sold[0].platformFeeUSD === 0.85 && sold[0].netOrganizerUSD === 7.65, 'prix calculés par le serveur (promo 15 %, commission 10 %)', sold[0]);
ok(sold[0].passCode !== sold[1].passCode && /^[A-Z0-9]+-[2-9A-HJ-NP-Z]{10}$/.test(sold[0].passCode), 'codes aléatoires et différents', sold.map(p => p.passCode));
r = await orga('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'Standard', holderName: 'X', promoCode: 'FAUX' });
ok(r.status === 400, 'code promo inconnu refusé');
r = await orga('POST', '/api/passes/sell', { eventId: ev.id, tierName: 'VIP', holderName: 'X', quantity: 3 });
ok(r.status === 409, 'capacité dépassée refusée');

// Plage
r = await orga('POST', '/api/batches', { eventId: ev.id, tierName: 'Standard', name: 'Plage revendeur', startNumber: 1, endNumber: 3, distributorName: 'Revendeur' });
ok(r.status === 200 && r.json.result.passes.length === 3, 'plage de 3 billets générée');
const batchPasses = r.json.result.passes;
ok(!batchPasses.some(p => /-0*[123]$/.test(p.passCode)), 'billets de plage non séquentiels (code imprévisible)', batchPasses.map(p => p.passCode));
r = await orga('POST', '/api/batches', { eventId: ev.id, tierName: 'Standard', startNumber: 4, endNumber: 4 });
ok(r.status === 409, 'plage : capacité épuisée refusée');

// Scan
const qr = sold[0].qrPayload;
r = await agent('POST', '/api/scan', { code: qr, gate: 'Porte A' });
ok(r.status === 200 && r.json.result.outcome === 'valid_entry' && r.json.result.pass.checkedInBy === 'Agent Porte A', 'scan QR : entrée autorisée, agent enregistré par le serveur');
r = await admin('POST', '/api/scan', { code: qr, gate: 'Porte B' });
ok(r.json.result.outcome === 'fraud_duplicate', 'deuxième portique : doublon refusé');
const forged = JSON.stringify({ v: 2, code: sold[1].passCode, sig: '0'.repeat(32) });
r = await agent('POST', '/api/scan', { code: forged });
ok(r.json.result.outcome === 'not_found', 'QR à signature falsifiée refusé');
r = await agent('POST', '/api/scan', { code: 'KP-ABCDEFGHJK' });
ok(r.json.result.outcome === 'not_found', 'code inconnu refusé');
r = await agent('POST', '/api/scan', { code: sold[1].passCode, eventId: 'evt-autre' });
ok(r.json.result.outcome === 'not_found' && r.json.result.wrongEvent, 'billet d\'un autre événement refusé');

// Blocage
r = await agent('POST', `/api/passes/${batchPasses[0].id}/blacklist`, { reason: 'Vol' });
ok(r.status === 403, 'agent : ne bloque pas de billet');
r = await orga('POST', `/api/passes/${batchPasses[0].id}/blacklist`, { reason: 'Perdu par le revendeur' });
ok(r.status === 200 && r.json.result.status === 'blacklisted', 'organisateur : bloque un billet');
r = await agent('POST', '/api/scan', { code: batchPasses[0].passCode });
ok(r.json.result.outcome === 'blacklisted', 'billet bloqué refusé au portique');
r = await orga('POST', `/api/passes/${sold[0].id}/blacklist`, { reason: 'test' });
r = await orga('POST', `/api/passes/${sold[0].id}/reactivate`, {});
ok(r.json.result.status === 'used', 'réactivation d\'un billet déjà utilisé : reste « utilisé »');

// Hors-ligne
r = await agent('POST', '/api/scan/sync', { scans: [
  { passCode: batchPasses[1].passCode, gate: 'Porte C', timestamp: new Date(Date.now() - 60000).toISOString() },
  { passCode: batchPasses[1].passCode, gate: 'Porte D', timestamp: new Date(Date.now() - 30000).toISOString() },
] });
ok(r.status === 200 && r.json.result.results[0].outcome === 'valid_entry' && r.json.result.results[1].outcome === 'fraud_duplicate', 'synchronisation hors-ligne : 1re entrée valide, 2e doublon');

// Vue agent
r = await agent('GET', '/api/state');
ok(r.json.passes.length === 5 && r.json.passes.every(p => !p.holderPhone && p.pricePaidUSD === 0) && r.json.payouts.length === 0, 'agent : billets sans téléphone ni montants');
ok(!('secret' in r.json) && !JSON.stringify(r.json).includes('passwordHash'), 'aucun secret ni empreinte de mot de passe envoyés');

// Reversements
r = await orga('POST', '/api/payouts', { eventId: ev.id, amountUSD: 1000, destinationAccount: '+243 810000001', paymentRail: 'M-Pesa' });
ok(r.status === 409, 'reversement supérieur au solde refusé');
r = await orga('POST', '/api/payouts', { eventId: ev.id, amountUSD: 10, destinationAccount: '+243 810000001', paymentRail: 'M-Pesa' });
ok(r.status === 200 && r.json.result.status === 'pending', 'reversement demandé (en attente, pas « payé » d\'office)');
const payoutId = r.json.result.id;
r = await orga('PATCH', `/api/payouts/${payoutId}`, { status: 'completed', reference: 'X' });
ok(r.status === 403, 'organisateur : ne valide pas son propre reversement');
r = await admin('PATCH', `/api/payouts/${payoutId}`, { status: 'completed', reference: 'MPESA-778899' });
ok(r.status === 200 && r.json.result.status === 'completed', 'admin : valide le reversement avec référence');

// Connexion : blocage après 5 erreurs
const pirate = client();
for (let i = 0; i < 4; i++) await pirate('POST', '/api/auth/login', { login: 'orga2', password: 'faux-mot-1' });
r = await pirate('POST', '/api/auth/login', { login: 'orga2', password: 'faux-mot-1' });
ok(r.status === 423, 'compte bloqué après 5 erreurs');
r = await pirate('POST', '/api/auth/login', { login: 'orga2', password: 'Bandal-88-ok' });
ok(r.status === 423, 'bon mot de passe refusé pendant le blocage');
r = await admin('PATCH', `/api/users/${(await admin('GET', '/api/state')).json.users.find(u => u.login === 'orga2').id}`, { unlock: true });
ok(r.status === 200, 'admin : débloque le compte');
r = await pirate('POST', '/api/auth/login', { login: 'orga2', password: 'Bandal-88-ok' });
ok(r.status === 200, 'connexion après déblocage');

// Dernier administrateur protégé, sauvegarde
const adminId = (await admin('GET', '/api/state')).json.users.find(u => u.login === 'chef').id;
r = await admin('PATCH', `/api/users/${adminId}`, { active: false });
ok(r.status === 409, 'dernier administrateur : désactivation refusée');
r = await admin('GET', '/api/backup');
ok(r.status === 200 && r.json.schema === 1 && !('sessions' in r.json), 'sauvegarde téléchargeable (sans sessions)');
r = await orga('GET', '/api/backup');
ok(r.status === 403, 'sauvegarde réservée à l\'administrateur');

r = await admin('GET', '/api/state');
ok(r.json.logs.length >= 7 && r.json.audit.length > 5, 'journal des scans et journal d\'administration remplis');
ok(r.json.batches[0].scannedCount === 1, 'compteur de la plage mis à jour');

console.log(`\n${passed} vérifications réussies.`);
