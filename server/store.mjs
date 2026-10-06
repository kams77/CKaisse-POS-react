// server/store.mjs — fichier de données JSON partagé par tous les postes.
//
// Toutes les écritures passent par une file : une seule modification à la fois, écrite dans un
// fichier temporaire puis renommée (pas de fichier à moitié écrit en cas de coupure de courant).
// Une copie de sécurité horodatée est conservée chaque jour (les 14 dernières).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const EMPTY_DB = () => ({
  schema: 1,
  version: 0,
  secret: crypto.randomBytes(32).toString('hex'), // clé de signature des billets (ne quitte jamais le serveur)
  users: [],
  sessions: [],
  settings: {
    organizationName: '',
    phone: '',
    defaultCommissionPercent: 10,
    maxDiscountPercent: 20,
    promoCodes: [],
    gates: ['Porte A', 'Porte B'],
    rates: { USD: 1, CDF: 2850, XOF: 610, EUR: 0.92 },
    ratesUpdatedAt: null,
  },
  events: [],
  batches: [],
  passes: [],
  logs: [],
  payouts: [],
  audit: [],
});

export function createFileStore(dataDir) {
  const file = path.join(dataDir, 'kolapass.json');
  const backupDir = path.join(dataDir, 'sauvegardes');
  fs.mkdirSync(backupDir, { recursive: true });

  let db;
  if (fs.existsSync(file)) {
    db = { ...EMPTY_DB(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } else {
    db = EMPTY_DB();
    fs.writeFileSync(file, JSON.stringify(db));
  }

  let queue = Promise.resolve();
  let lastBackupDay = '';
  let timer = null;
  // Regroupe les écritures rapprochées (plusieurs scans par seconde aux portiques).
  function schedulePersist() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; try { persist(); } catch (e) { console.error('Écriture du fichier de données impossible :', e); } }, 200);
  }

  function persist() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastBackupDay) {
      lastBackupDay = day;
      fs.copyFileSync(file, path.join(backupDir, `kolapass-${day}.json`));
      const old = fs.readdirSync(backupDir).filter(f => f.startsWith('kolapass-')).sort();
      for (const f of old.slice(0, Math.max(0, old.length - 14))) fs.unlinkSync(path.join(backupDir, f));
    }
  }

  return {
    file,
    /** Lecture (pas de copie : ne pas modifier l'objet renvoyé hors de `write`). */
    read: () => db,
    /** Modification atomique : `fn(db)` modifie la base ; elle n'est enregistrée que si fn réussit. */
    write(fn) {
      const run = queue.then(() => {
        const draft = structuredClone(db);
        const result = fn(draft);
        draft.version = (draft.version || 0) + 1;
        db = draft;
        schedulePersist();
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
    /** Écrit immédiatement les modifications en attente (arrêt du serveur). */
    flush() { if (timer) { clearTimeout(timer); timer = null; persist(); } },
    /** Remplacement complet (restauration d'une sauvegarde). */
    replace(next) {
      return this.write(d => { Object.keys(d).forEach(k => delete d[k]); Object.assign(d, next); });
    },
  };
}

/** Base en mémoire (tests). */
export function createMemoryStore() {
  let db = EMPTY_DB();
  let queue = Promise.resolve();
  return {
    file: ':memory:',
    read: () => db,
    write(fn) {
      const run = queue.then(() => {
        const draft = structuredClone(db);
        const result = fn(draft);
        draft.version = (draft.version || 0) + 1;
        db = draft;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
    replace(next) {
      return this.write(d => { Object.keys(d).forEach(k => delete d[k]); Object.assign(d, next); });
    },
  };
}
