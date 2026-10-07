// server/kolapass.mjs — règles métier de la billetterie (fonctions pures sur la base `db`).
//
// Le serveur est la seule source de vérité : il calcule les prix, attribue les codes, signe les
// billets et valide les entrées. Un billet ne peut donc être validé qu'une seule fois, même si
// plusieurs portiques scannent en même temps.
import crypto from 'node:crypto';
import { randomPassCode, signPass, verifyPassSignature } from './auth.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const ROLES = ['admin', 'organizer', 'agent'];
export const TIERS = ['Standard', 'VIP', 'VVIP'];
export const RAILS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Wave', 'MTN MoMo', 'Visa / Mastercard', 'Espèces'];
export const CATEGORIES = ['Concert & Festival', 'Conférence & Business', 'Formation & Masterclass', 'Sport & Match', 'Soirée & Gala'];

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const nowIso = () => new Date().toISOString();
export const newId = prefix => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const num = v => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')));

/** Prochaine référence PREFIXE-AAAA-NNN (plus grand numéro de l'année + 1). */
export function nextReference(prefix, existing, width = 3) {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const ref of existing) { const m = re.exec(ref || ''); if (m) max = Math.max(max, Number(m[1])); }
  return `${prefix}-${year}-${String(max + 1).padStart(width, '0')}`;
}

export function publicUser(u) {
  const { passwordHash, failedAttempts, ...rest } = u;
  return rest;
}

export function audit(db, user, action, details) {
  db.audit.unshift({ id: newId('aud'), at: nowIso(), userId: user?.id, userName: user?.name || 'Système', action, details });
  if (db.audit.length > 5000) db.audit.length = 5000;
}

// ---------------------------------------------------------------------------
// Droits
// ---------------------------------------------------------------------------
export const isAdmin = u => u?.role === 'admin';
export function canManageEvent(u, ev) {
  return isAdmin(u) || (u?.role === 'organizer' && ev?.ownerId === u.id);
}
function requireRole(u, ...roles) {
  if (!u || !roles.includes(u.role)) throw new HttpError(403, 'Action non autorisée pour votre rôle.');
}
function findEvent(db, id) {
  const ev = db.events.find(e => e.id === id);
  if (!ev) throw new HttpError(404, 'Événement introuvable.');
  return ev;
}

// ---------------------------------------------------------------------------
// Vue des données selon le rôle
// ---------------------------------------------------------------------------
export function stateFor(db, u) {
  const settings = { ...db.settings };
  if (!isAdmin(u)) settings.promoCodes = (settings.promoCodes || []).filter(p => p.active).map(({ code, percent }) => ({ code, percent }));
  if (isAdmin(u)) {
    return {
      version: db.version, settings,
      events: db.events, batches: db.batches, passes: db.passes, logs: db.logs, payouts: db.payouts,
      users: db.users.map(publicUser), audit: db.audit.slice(0, 500),
    };
  }
  if (u.role === 'organizer') {
    const mine = new Set(db.events.filter(e => e.ownerId === u.id).map(e => e.id));
    return {
      version: db.version, settings,
      events: db.events.filter(e => mine.has(e.id)),
      batches: db.batches.filter(b => mine.has(b.eventId)),
      passes: db.passes.filter(p => mine.has(p.eventId)),
      logs: db.logs.filter(l => mine.has(l.eventId)),
      payouts: db.payouts.filter(p => mine.has(p.eventId)),
      users: [], audit: [],
    };
  }
  // Agent de contrôle : événements à venir et billets correspondants (sans téléphone), pour le
  // contrôle hors-ligne ; aucun montant ni reversement.
  const active = new Set(db.events.filter(e => e.status !== 'completed').map(e => e.id));
  return {
    version: db.version,
    settings: { organizationName: settings.organizationName, gates: settings.gates, rates: settings.rates },
    events: db.events.filter(e => active.has(e.id)),
    batches: [],
    passes: db.passes
      .filter(p => active.has(p.eventId))
      .map(({ holderPhone, pricePaidUSD, platformFeeUSD, netOrganizerUSD, transactionReference, ...p }) => ({ ...p, holderPhone: '', pricePaidUSD: 0, platformFeeUSD: 0, netOrganizerUSD: 0 })),
    logs: db.logs.filter(l => active.has(l.eventId)).slice(0, 1000),
    payouts: [], users: [], audit: [],
  };
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------
export function createEvent(db, u, body) {
  requireRole(u, 'admin', 'organizer');
  const title = str(body.title, 120);
  const venue = str(body.venue, 120);
  if (!title || !venue) throw new HttpError(400, 'Titre et lieu obligatoires.');
  const date = new Date(body.eventDate);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Date de l\'événement invalide.');
  const ownerId = isAdmin(u) && body.ownerId ? str(body.ownerId, 80) : u.id;
  const owner = db.users.find(x => x.id === ownerId);
  if (!owner) throw new HttpError(400, 'Organisateur introuvable.');
  const commission = isAdmin(u) && body.commissionRatePercent !== undefined && Number.isFinite(num(body.commissionRatePercent))
    ? Math.min(50, Math.max(0, num(body.commissionRatePercent)))
    : db.settings.defaultCommissionPercent;
  const tier = (name, price, cap) => {
    const p = num(price); const c = Math.floor(num(cap));
    if (!(p >= 0) || !(c >= 0) || c > 200000) throw new HttpError(400, `Prix ou capacité invalide (${name}).`);
    return { id: newId('tier'), name, priceUSD: round2(p), capacity: c, sold: 0 };
  };
  const tiers = [
    tier('Standard', body.standardPriceUSD, body.standardCap),
    tier('VIP', body.vipPriceUSD, body.vipCap),
    tier('VVIP', body.vvipPriceUSD, body.vvipCap),
  ];
  if (!tiers.some(t => t.capacity > 0)) throw new HttpError(400, 'Au moins une catégorie doit avoir une capacité.');
  const ev = {
    id: newId('evt'),
    code: nextReference('EVT', db.events.map(e => e.code), 2),
    title,
    category: CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0],
    organizerName: str(body.organizerName, 120) || owner.name,
    organizerPhone: str(body.organizerPhone, 40) || owner.phone || '',
    venue,
    city: str(body.city, 80),
    eventDate: date.toISOString(),
    tiers,
    commissionRatePercent: commission,
    status: 'upcoming',
    ownerId,
    createdAt: nowIso(),
  };
  db.events.unshift(ev);
  audit(db, u, 'Création événement', `${ev.code} — ${ev.title}`);
  return ev;
}

export function updateEventStatus(db, u, id, status) {
  const ev = findEvent(db, id);
  if (!canManageEvent(u, ev)) throw new HttpError(403, 'Seul l\'organisateur de l\'événement ou l\'administrateur peut le modifier.');
  if (!['upcoming', 'completed'].includes(status)) throw new HttpError(400, 'Statut invalide.');
  ev.status = status;
  audit(db, u, 'Statut événement', `${ev.code} → ${status}`);
  return ev;
}

// ---------------------------------------------------------------------------
// Billets
// ---------------------------------------------------------------------------
function buildPass(db, ev, tierName, fields) {
  const passCode = (() => {
    for (;;) {
      const c = randomPassCode(ev.code.replace(/^EVT-\d{4}-/, 'E'));
      if (!db.passes.some(p => p.passCode === c)) return c;
    }
  })();
  const pass = {
    id: newId('pass'),
    passCode,
    eventId: ev.id,
    eventTitle: ev.title,
    eventDate: ev.eventDate,
    venue: ev.venue,
    tierName,
    status: 'valid',
    scanAttempts: 0,
    purchasedAt: nowIso(),
    ...fields,
  };
  const sig = signPass(db.secret, pass);
  pass.qrSignature = `HMAC-SHA256:${sig}`;
  // Contenu du QR code : code + signature (vérifiée par le serveur au portique).
  pass.qrPayload = JSON.stringify({ v: 2, code: passCode, sig });
  return pass;
}

function discountFor(db, u, body) {
  const code = str(body.promoCode, 40).toUpperCase();
  if (code) {
    const promo = (db.settings.promoCodes || []).find(p => p.active && p.code.toUpperCase() === code);
    if (!promo) throw new HttpError(400, 'Code promotionnel invalide ou désactivé.');
    return { percent: promo.percent, label: `Code ${promo.code}` };
  }
  const manual = Math.max(0, num(body.discountPercent) || 0);
  const max = isAdmin(u) ? 100 : db.settings.maxDiscountPercent;
  if (manual > max) throw new HttpError(403, `Remise maximale autorisée : ${max} %.`);
  return { percent: manual, label: manual ? 'Remise manuelle' : '' };
}

export function sellPasses(db, u, body) {
  requireRole(u, 'admin', 'organizer');
  const ev = findEvent(db, body.eventId);
  if (!canManageEvent(u, ev)) throw new HttpError(403, 'Vous ne pouvez vendre que les billets de vos événements.');
  if (ev.status === 'completed') throw new HttpError(400, 'Événement terminé : vente fermée.');
  const tier = ev.tiers.find(t => t.name === body.tierName);
  if (!tier) throw new HttpError(400, 'Catégorie introuvable.');
  const qty = Math.floor(num(body.quantity) || 1);
  if (qty < 1 || qty > 50) throw new HttpError(400, 'Quantité entre 1 et 50.');
  if (tier.sold + qty > tier.capacity) throw new HttpError(409, `Plus que ${tier.capacity - tier.sold} place(s) en ${tier.name}.`);
  const holderName = str(body.holderName, 120);
  if (!holderName) throw new HttpError(400, 'Nom de l\'acheteur obligatoire.');
  const rail = RAILS.includes(body.paymentRail) ? body.paymentRail : 'Espèces';
  const discount = discountFor(db, u, body);
  const unit = round2(tier.priceUSD * (1 - discount.percent / 100));
  const fee = round2(unit * (ev.commissionRatePercent / 100));
  const txRef = str(body.paymentReference, 60) || nextReference('VTE', db.passes.map(p => p.transactionReference), 5);
  const guests = Array.isArray(body.guestNames) ? body.guestNames : [];
  const created = [];
  for (let i = 0; i < qty; i++) {
    created.push(buildPass(db, ev, tier.name, {
      holderName: qty === 1 ? holderName : (str(guests[i], 120) || `${holderName} (invité ${i + 1})`),
      holderPhone: str(body.holderPhone, 40),
      pricePaidUSD: unit,
      platformFeeUSD: fee,
      netOrganizerUSD: round2(unit - fee),
      paymentRail: rail,
      transactionReference: txRef,
      discountLabel: discount.label || undefined,
      soldById: u.id,
      soldByName: u.name,
    }));
  }
  tier.sold += qty;
  db.passes.unshift(...created);
  audit(db, u, 'Vente billets', `${qty} × ${tier.name} — ${ev.code} — ${holderName} — ${txRef}`);
  return created;
}

export function generateBatch(db, u, body) {
  requireRole(u, 'admin', 'organizer');
  const ev = findEvent(db, body.eventId);
  if (!canManageEvent(u, ev)) throw new HttpError(403, 'Vous ne pouvez générer des billets que pour vos événements.');
  const tier = ev.tiers.find(t => t.name === body.tierName);
  if (!tier) throw new HttpError(400, `Catégorie ${body.tierName} introuvable.`);
  const start = Math.floor(num(body.startNumber));
  const end = Math.floor(num(body.endNumber));
  const quantity = end - start + 1;
  if (!(start >= 1) || !(quantity >= 1)) throw new HttpError(400, 'La plage de numéros est invalide.');
  if (quantity > 5000) throw new HttpError(400, '5 000 billets maximum par plage.');
  if (tier.sold + quantity > tier.capacity) throw new HttpError(409, `Capacité insuffisante : seulement ${tier.capacity - tier.sold} places disponibles.`);
  const unit = num(body.unitPriceUSD) > 0 ? round2(num(body.unitPriceUSD)) : tier.priceUSD;
  const fee = round2(unit * (ev.commissionRatePercent / 100));
  const batchId = newId('batch');
  const batchNumber = nextReference('PLG', db.batches.map(b => b.batchNumber));
  const label = str(body.distributorName, 120) || 'Porteur';
  const passes = [];
  for (let n = start; n <= end; n++) {
    passes.push(buildPass(db, ev, tier.name, {
      // Le numéro imprimé (N°) sert au rangement ; le code d'entrée reste aléatoire et imprévisible.
      holderName: `${label} (N° ${n})`,
      holderPhone: str(body.distributorPhone, 40),
      pricePaidUSD: unit,
      platformFeeUSD: fee,
      netOrganizerUSD: round2(unit - fee),
      paymentRail: 'Espèces',
      transactionReference: `${batchNumber}-N${n}`,
      batchId, batchNumber, batchName: str(body.name, 120), rangeIndex: n, rangeTotal: quantity,
      isBatchTicket: true, distributorName: str(body.distributorName, 120) || undefined,
      soldById: u.id, soldByName: u.name,
    }));
  }
  const batch = {
    id: batchId, batchNumber, name: str(body.name, 120) || batchNumber,
    eventId: ev.id, eventTitle: ev.title, tierName: tier.name, unitPriceUSD: unit,
    startNumber: start, endNumber: end, quantity, prefix: passes[0].passCode.split('-')[0],
    generatedBy: u.name, distributorName: str(body.distributorName, 120) || undefined,
    distributorPhone: str(body.distributorPhone, 40) || undefined,
    totalValueUSD: round2(unit * quantity), status: 'active', notes: str(body.notes, 500) || undefined,
    generatedAt: nowIso(), passIds: passes.map(p => p.id), scannedCount: 0,
  };
  tier.sold += quantity;
  db.passes.unshift(...passes);
  db.batches.unshift(batch);
  audit(db, u, 'Génération plage', `${batchNumber} — ${quantity} × ${tier.name} — ${ev.code}`);
  return { batch, passes };
}

export function setPassBlacklist(db, u, id, blacklisted, reason) {
  const pass = db.passes.find(p => p.id === id);
  if (!pass) throw new HttpError(404, 'Billet introuvable.');
  const ev = db.events.find(e => e.id === pass.eventId);
  if (!canManageEvent(u, ev)) throw new HttpError(403, 'Action réservée à l\'organisateur de l\'événement ou à l\'administrateur.');
  if (blacklisted) {
    const why = str(reason, 200);
    if (!why) throw new HttpError(400, 'Motif obligatoire.');
    Object.assign(pass, { status: 'blacklisted', blacklistReason: why, blacklistedAt: nowIso(), statusBeforeBlacklist: pass.status });
    audit(db, u, 'Billet bloqué', `${pass.passCode} — ${why}`);
  } else {
    if (pass.status !== 'blacklisted') return pass;
    // Un billet déjà utilisé redevient « utilisé », jamais « valide » (pas de seconde entrée).
    Object.assign(pass, { status: pass.checkedInAt ? 'used' : 'valid', blacklistReason: undefined, blacklistedAt: undefined, statusBeforeBlacklist: undefined });
    audit(db, u, 'Billet réactivé', pass.passCode);
  }
  return pass;
}

// ---------------------------------------------------------------------------
// Contrôle d'accès (scan)
// ---------------------------------------------------------------------------
/** Lit ce que le portique a scanné : contenu JSON du QR, code seul, ou code#suffixe. */
export function parseScanned(raw) {
  const s = String(raw ?? '').trim();
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o.code === 'string') return { code: o.code.trim().toUpperCase(), sig: typeof o.sig === 'string' ? o.sig : null };
    } catch { /* texte libre */ }
  }
  return { code: s.split('#')[0].trim().toUpperCase(), sig: null };
}

export function scan(db, u, body, opts = {}) {
  requireRole(u, 'admin', 'organizer', 'agent');
  const { code, sig } = parseScanned(body.code);
  if (!code) throw new HttpError(400, 'Code vide.');
  const gate = str(body.gate, 60) || 'Portique';
  const at = opts.timestamp || nowIso();
  const restrictEvent = str(body.eventId, 80);
  const pass = db.passes.find(p => p.passCode.toUpperCase() === code);
  const log = (result, notes, p) => {
    const entry = {
      id: newId('log'), timestamp: at, passCode: p?.passCode || code,
      holderName: p?.holderName || 'Inconnu', eventId: p?.eventId || '', eventTitle: p?.eventTitle || 'Non identifié',
      tierName: p?.tierName || '—', gate, scannedBy: u.name, scannedById: u.id, result, notes,
      offlineSynced: opts.offline || undefined,
    };
    db.logs.unshift(entry);
    if (db.logs.length > 100000) db.logs.length = 100000;
    return entry;
  };

  if (!pass) {
    log('invalid_unknown', 'Code inconnu : billet inexistant ou contrefait');
    return { outcome: 'not_found' };
  }
  if (u.role === 'organizer' && !canManageEvent(u, db.events.find(e => e.id === pass.eventId))) {
    throw new HttpError(403, 'Ce billet appartient à un autre organisateur.');
  }
  if (sig !== null && !verifyPassSignature(db.secret, pass, sig)) {
    log('invalid_unknown', 'Signature du QR invalide : billet falsifié', pass);
    return { outcome: 'not_found' };
  }
  const passEvent = db.events.find(e => e.id === pass.eventId);
  if (passEvent && passEvent.status === 'completed') {
    log('invalid_unknown', `Événement clôturé (${pass.eventTitle})`, pass);
    return { outcome: 'not_found', pass, eventClosed: true };
  }
  if (restrictEvent && pass.eventId !== restrictEvent) {
    log('invalid_unknown', `Billet d'un autre événement (${pass.eventTitle})`, pass);
    return { outcome: 'not_found', pass, wrongEvent: true };
  }
  pass.scanAttempts = (pass.scanAttempts || 0) + 1;
  if (pass.status === 'blacklisted' || pass.status === 'cancelled') {
    log('blacklisted_denied', `Billet bloqué : ${pass.blacklistReason || pass.status}`, pass);
    return { outcome: 'blacklisted', pass };
  }
  if (pass.status === 'used') {
    log('duplicate_denied', `Déjà entré le ${new Date(pass.checkedInAt).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })} (${pass.checkedInGate || ''}, ${pass.checkedInBy || ''})`, pass);
    return { outcome: 'fraud_duplicate', pass, previousCheckIn: pass.checkedInAt };
  }
  Object.assign(pass, { status: 'used', checkedInAt: at, checkedInGate: gate, checkedInBy: u.name });
  if (pass.batchId) {
    const b = db.batches.find(x => x.id === pass.batchId);
    if (b) b.scannedCount = (b.scannedCount || 0) + 1;
  }
  log('granted', `Entrée autorisée — ${pass.tierName}${pass.rangeIndex ? ` (N° ${pass.rangeIndex})` : ''}`, pass);
  return { outcome: 'valid_entry', pass };
}

/** Scans faits hors connexion, rejoués dans l'ordre chronologique. */
export function syncOfflineScans(db, u, scans) {
  if (!Array.isArray(scans)) throw new HttpError(400, 'Liste de scans attendue.');
  const now = Date.now();
  const ordered = scans
    .slice(0, 5000)
    .map(s => ({ code: s.passCode ?? s.code, gate: s.gate, t: Date.parse(s.timestamp) }))
    .map(s => ({ ...s, t: Number.isFinite(s.t) && s.t <= now && s.t > now - 7 * 86400000 ? s.t : now }))
    .sort((a, b) => a.t - b.t);
  return ordered.map(s => ({ code: s.code, ...scan(db, u, { code: s.code, gate: s.gate }, { timestamp: new Date(s.t).toISOString(), offline: true }) }))
    .map(r => ({ code: r.code, outcome: r.outcome }));
}

// ---------------------------------------------------------------------------
// Reversements aux organisateurs
// ---------------------------------------------------------------------------
export function payoutBalance(db, eventId) {
  const earned = db.passes.filter(p => p.eventId === eventId && p.status !== 'cancelled').reduce((s, p) => s + (p.netOrganizerUSD || 0), 0);
  const paid = db.payouts.filter(p => p.eventId === eventId && p.status !== 'rejected').reduce((s, p) => s + p.amountUSD, 0);
  return round2(earned - paid);
}

export function requestPayout(db, u, body) {
  requireRole(u, 'admin', 'organizer');
  const ev = findEvent(db, body.eventId);
  if (!canManageEvent(u, ev)) throw new HttpError(403, 'Reversement réservé à l\'organisateur de l\'événement.');
  const amount = round2(num(body.amountUSD));
  if (!(amount > 0)) throw new HttpError(400, 'Montant invalide.');
  const available = payoutBalance(db, ev.id);
  if (amount > available) throw new HttpError(409, `Montant supérieur au solde disponible (${available} $).`);
  const dest = str(body.destinationAccount, 80);
  if (!dest) throw new HttpError(400, 'Compte de destination obligatoire.');
  const p = {
    id: newId('pay'), eventId: ev.id, eventTitle: ev.title, organizerName: ev.organizerName, organizerPhone: ev.organizerPhone,
    amountUSD: amount, paymentRail: RAILS.includes(body.paymentRail) ? body.paymentRail : 'M-Pesa', destinationAccount: dest,
    status: 'pending', requestedAt: nowIso(), requestedBy: u.name,
  };
  db.payouts.unshift(p);
  audit(db, u, 'Demande de reversement', `${amount} $ — ${ev.code} — ${dest}`);
  return p;
}

export function decidePayout(db, u, id, body) {
  requireRole(u, 'admin');
  const p = db.payouts.find(x => x.id === id);
  if (!p) throw new HttpError(404, 'Reversement introuvable.');
  if (p.status !== 'pending') throw new HttpError(409, 'Reversement déjà traité.');
  if (body.status === 'completed') {
    const ref = str(body.reference, 80);
    if (!ref) throw new HttpError(400, 'Référence du transfert obligatoire.');
    Object.assign(p, { status: 'completed', completedAt: nowIso(), transferReference: ref, decidedBy: u.name });
  } else if (body.status === 'rejected') {
    Object.assign(p, { status: 'rejected', completedAt: nowIso(), rejectReason: str(body.reason, 200), decidedBy: u.name });
  } else throw new HttpError(400, 'Décision invalide.');
  audit(db, u, 'Décision reversement', `${p.id} → ${p.status}`);
  return p;
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------
export function updateSettings(db, u, body) {
  requireRole(u, 'admin');
  const s = db.settings;
  if (body.organizationName !== undefined) s.organizationName = str(body.organizationName, 120);
  if (body.phone !== undefined) s.phone = str(body.phone, 40);
  if (body.defaultCommissionPercent !== undefined) {
    const c = num(body.defaultCommissionPercent);
    if (!(c >= 0 && c <= 50)) throw new HttpError(400, 'Commission entre 0 et 50 %.');
    s.defaultCommissionPercent = c;
  }
  if (body.maxDiscountPercent !== undefined) {
    const c = num(body.maxDiscountPercent);
    if (!(c >= 0 && c <= 100)) throw new HttpError(400, 'Remise maximale entre 0 et 100 %.');
    s.maxDiscountPercent = c;
  }
  if (Array.isArray(body.gates)) s.gates = body.gates.map(g => str(g, 40)).filter(Boolean).slice(0, 30);
  if (Array.isArray(body.promoCodes)) {
    s.promoCodes = body.promoCodes.slice(0, 100).map(p => {
      const code = str(p.code, 30).toUpperCase().replace(/\s+/g, '');
      const percent = num(p.percent);
      if (!code || !(percent > 0 && percent <= 100)) throw new HttpError(400, `Code promo invalide : ${code || '(vide)'}.`);
      return { code, percent, active: p.active !== false };
    });
  }
  if (body.rates && typeof body.rates === 'object') {
    const r = { USD: 1 };
    for (const k of ['CDF', 'XOF', 'EUR']) {
      const v = num(body.rates[k]);
      if (!(v > 0)) throw new HttpError(400, `Taux ${k} invalide.`);
      r[k] = v;
    }
    s.rates = r;
    s.ratesUpdatedAt = nowIso();
  }
  audit(db, u, 'Paramètres modifiés', Object.keys(body).join(', '));
  return s;
}
