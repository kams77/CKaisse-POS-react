// server/index.mjs — démarrage du serveur KolaPass.
//
// Variables d'environnement :
//   PORT        port HTTP (défaut 3000)
//   DATA_DIR    dossier du fichier de données (défaut ./data)
//   SETUP_CODE  code demandé à la création du compte administrateur (sinon : code aléatoire affiché au démarrage)
//   NODE_ENV=production ou option --production : sert l'application compilée (dist/) ; sinon mode développement (Vite)
//   COOKIE_SECURE=true  si le site est servi en HTTPS (reverse proxy du Synology)
//   TRUST_PROXY=true    si un reverse proxy (Caddy, Synology, Nginx) est devant le serveur
import http from 'node:http';
import path from 'node:path';
import { createApp, randomSetupCode } from './app.mjs';
import { createFileStore } from './store.mjs';

const PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

let setupCode = process.env.SETUP_CODE || '';
if (/^CHANGEZ/i.test(setupCode)) {
  console.error('SETUP_CODE contient encore la valeur d\'exemple : choisissez votre propre code.');
  process.exit(1);
}
// Sans SETUP_CODE, un code aléatoire est affiché dans le journal du serveur (visible seulement
// par la personne qui a accès au serveur).
if (!setupCode) setupCode = randomSetupCode();

const store = createFileStore(DATA_DIR);

let devMiddleware = null;
if (!PROD) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  devMiddleware = vite.middlewares;
}

const handler = createApp({
  store,
  setupCode,
  distDir: PROD ? path.resolve(process.env.DIST_DIR || 'dist') : null,
  secureCookies: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  devMiddleware,
});

const server = http.createServer(handler);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`KolaPass prêt sur http://0.0.0.0:${PORT} (données : ${store.file})`);
  if (store.read().users.length === 0) {
    console.log(process.env.SETUP_CODE ? 'Premier démarrage : créez le compte administrateur avec votre SETUP_CODE.' : `Premier démarrage : code d'installation = ${setupCode}`);
  }
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    store.flush();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
