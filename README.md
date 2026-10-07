# KolaPass — billetterie et contrôle d'accès

Billets à QR code signé, vendus au guichet ou par plages, contrôlés au portique depuis plusieurs téléphones ou postes. Toutes les données sont sur **un seul serveur** : un billet ne peut entrer qu'une fois, même avec plusieurs portes.

> Les écrans caisse pharmacie/salon, stock et KolaPay (`src/App.tsx`) restent dans le dépôt mais ne font pas partie de la phase de test.

## Rôles

| Rôle | Peut faire |
|---|---|
| **Administrateur** | Tout. Il crée aussi les comptes, règle les paramètres (taux, codes promo, portiques, commission), valide les reversements et gère les sauvegardes. |
| **Organisateur** | Ses propres événements : création, vente de billets, plages, blocage d'un billet, demande de reversement. |
| **Agent de contrôle** | Portique (scan), liste des billets et journal des scans. Il ne voit ni les montants ni les téléphones. |

## Lancer sur un PC (Windows, macOS, Linux)

Il faut Node.js 20 ou plus récent (<https://nodejs.org>).

```bash
npm install
npm run build
npm start              # http://localhost:3000
```

Au premier démarrage, le **code d'installation** s'affiche dans la fenêtre du serveur. Pour choisir le vôtre, définissez la variable `SETUP_CODE` :

- Windows (PowerShell) : `$env:SETUP_CODE="mon-code"; npm start`
- macOS/Linux : `SETUP_CODE=mon-code npm start`

Ouvrez ensuite l'adresse affichée et créez le compte administrateur avec ce code.

Les autres postes du même réseau ouvrent `http://IP-DU-PC:3000`. Les données sont dans le dossier `data/`, avec une copie automatique par jour dans `data/sauvegardes/`.

Mode développement (rechargement à chaud) : `npm run dev`.

## Application Android des agents (« KolaPass Scan »)

Le dossier `android/` contient l'application native des agents de contrôle (portiques, quais). Elle permet :

- le scan des QR code par la caméra, avec un écran vert, orange ou rouge, un bip et une vibration ;
- la saisie manuelle du code et l'usage de la lampe ;
- le **contrôle hors ligne**, avec synchronisation automatique au retour du réseau.

GitHub Actions compile l'APK à chaque modification et le publie dans les [Releases](https://github.com/kams77/CKaisse-POS-react/releases). Installation et configuration : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md#6-application-android-kolapass-scan-agents).

## Billet envoyé au client

Depuis la fiche d'un billet, on peut l'envoyer par **WhatsApp, SMS ou e-mail**, ou copier son lien. Le client ouvre `…/billet?c=CODE&s=SIGNATURE` et voit son QR code. Le lien est signé et ne peut pas être deviné.

## Déploiement client-serveur

La procédure complète se trouve dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md). Elle couvre :

- l'installation du serveur : PC, Synology, ou VPS avec HTTPS automatique (`deploy/`) ;
- les postes web et les téléphones Android ;
- les sauvegardes, les mises à jour et le dépannage.

## Installer sur un Synology (Container Manager) ou un serveur Docker

1. Copiez le dossier du projet sur le NAS, par exemple dans `docker/kolapass`.
2. Dans `docker-compose.yml`, remplacez `CHANGEZ_MOI` par votre code d'installation.
3. Ouvrez **Container Manager → Projet → Créer**. Choisissez le dossier, puis le fichier `docker-compose.yml`, et lancez la construction.
4. Ouvrez `http://IP-DU-NAS:3000` et créez le compte administrateur.

Pour le scan avec la **caméra du téléphone**, le site doit être servi en **HTTPS** : sinon le navigateur refuse l'accès à la caméra.

- Sur le Synology, passez par **Panneau de configuration → Portail de connexion → Proxy inversé**, avec un certificat Let's Encrypt.
- Mettez ensuite `COOKIE_SECURE: "true"` et `TRUST_PROXY: "true"` dans `docker-compose.yml`.

La lecture automatique des QR fonctionne avec **Chrome sur Android**. Sur les autres appareils, utilisez une **douchette** (lecteur USB ou Bluetooth) dans le champ « Code du billet », ou tapez le code imprimé.

## Tests

```bash
npm run build
SETUP_CODE=code-test npm start &
BASE_URL=http://localhost:3000 SETUP_CODE=code-test npm run test:api       # 70 vérifications sur une base vierge
# (sur une autre base vierge) contrat d'API de l'application Android :
BASE_URL=http://localhost:3001 SETUP_CODE=code-test npm run test:android   # 23 vérifications
```

Le plan de la phase de test se trouve dans [docs/PHASE_TEST.md](docs/PHASE_TEST.md).

## Sécurité

- Mots de passe hachés (PBKDF2), session en cookie `HttpOnly`, protection contre la falsification de requêtes (CSRF).
- Blocage de 15 minutes après 5 erreurs de mot de passe.
- Mot de passe provisoire à changer à la première connexion.
- Billets à code aléatoire, signés par le serveur avec HMAC-SHA256. La clé ne quitte jamais le serveur.
- Prix, remises, capacités et entrées sont calculés et vérifiés **par le serveur**.
- Journal d'administration (comptes, paramètres, ventes, blocages, reversements) et journal des scans, que personne ne peut effacer.
