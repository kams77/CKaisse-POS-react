# Déploiement client-serveur de KolaPass

Ce guide installe KolaPass de bout en bout :

- le **serveur**, qui garde toutes les données ;
- les **postes web** des guichets, des organisateurs et de l'administrateur ;
- l'**application Android « KolaPass Scan »** des agents de contrôle (portiques, quais).

---

## 1. Comment ça fonctionne

```
                    ┌──────────────────────────────────────────┐
                    │  SERVEUR KolaPass (un seul)              │
                    │  Node.js · port 3000 · data/kolapass.json│
                    │  (+ Caddy en HTTPS sur 443, conseillé)   │
                    └───────────────▲──────────────────────────┘
                                    │  HTTPS (ou HTTP sur le réseau local)
          ┌─────────────────────────┼─────────────────────────────┐
          │                         │                             │
  Navigateur (PC/tablette)   Navigateur (PC)             Téléphones Android
  Guichet / organisateur     Administrateur              « KolaPass Scan »
  vente, plages, reversements comptes, paramètres,       agents : scan des QR
                             sauvegardes                 (fonctionne aussi hors ligne)
```

- **Un seul serveur fait foi.** Un billet ne peut entrer qu'une fois, quel que soit le nombre de portes ou de téléphones.
- **Les postes ne stockent rien d'important.** Seule exception : la file des scans faits hors connexion, envoyée dès que le réseau revient.
- **Aucune base de données à installer.** Les données tiennent dans un seul fichier, `data/kolapass.json`. Le serveur en garde une copie par jour dans `data/sauvegardes/` (les 14 dernières).

---

## 2. Choisir où installer le serveur

| Situation | Solution | HTTPS | Accès depuis Internet |
|---|---|---|---|
| Essai rapide, un seul site, réseau Wi-Fi local | **A. PC Windows / Linux** | non | non |
| Bureau équipé d'un NAS Synology | **B. Synology (Docker)** | oui, via le proxy inversé du NAS | possible |
| Plusieurs sites (port, guichets en ville), vente en ligne | **C. Serveur VPS Linux + Caddy** (conseillé) | oui, automatique | oui |

Côté matériel :

- **Machine** : 1 cœur, 1 Go de RAM et 2 Go de disque suffisent pour des dizaines de milliers de billets.
- **Réseau** : il faut une adresse **fixe**, c'est-à-dire une IP fixe sur le réseau local ou un nom de domaine. Les téléphones et les postes s'y connectent.

---

## 3. Installer le serveur

### A. PC Windows ou Linux (réseau local)

1. Installez **Node.js 20 ou plus récent** (<https://nodejs.org>, version LTS).
2. Récupérez le projet : `git clone https://github.com/kams77/CKaisse-POS-react.git`. Vous pouvez aussi télécharger le ZIP depuis GitHub.
3. Ouvrez un terminal dans le dossier du projet, puis :

   ```bash
   npm install
   npm run build
   ```

4. Démarrez le serveur avec votre propre code d'installation :
   - Windows (PowerShell) :

     ```powershell
     $env:SETUP_CODE="mon-code-secret"; npm start
     ```

   - Linux :

     ```bash
     SETUP_CODE=mon-code-secret npm start
     ```

5. Donnez au PC une **IP fixe**. Dans la box ou le routeur, cherchez « réservation DHCP » et fixez par exemple `192.168.1.20`.
6. Ouvrez le **port 3000** dans le pare-feu.
   - Windows : *Pare-feu Windows Defender → Paramètres avancés → Règles de trafic entrant → Nouvelle règle → Port TCP 3000*.
7. Les autres appareils du Wi-Fi ouvrent `http://192.168.1.20:3000`.

> Pour que le serveur démarre tout seul avec Windows, deux possibilités :
>
> - le **Planificateur de tâches** : déclencheur « Au démarrage », action `npm start` dans le dossier du projet ;
> - **NSSM** (<https://nssm.cc>), qui le transforme en service.

### B. Synology (Container Manager)

1. Copiez le projet sur le NAS, par exemple dans `docker/kolapass`.
2. Dans `docker-compose.yml`, remplacez `CHANGEZ_MOI` par votre code d'installation.
3. Ouvrez *Container Manager → Projet → Créer*, choisissez ce dossier et lancez la construction.
4. Mettez en place le HTTPS :
   - *Panneau de configuration → Sécurité → Certificat* : créez un certificat Let's Encrypt pour votre nom DDNS (`monport.synology.me`).
   - *Portail de connexion → Avancé → Proxy inversé* : la source est `HTTPS monport.synology.me 443`, la destination `HTTP localhost 3000`.
5. Dans `docker-compose.yml`, ajoutez `COOKIE_SECURE: "true"` et `TRUST_PROXY: "true"`, puis relancez le projet.

### C. Serveur Linux / VPS avec HTTPS automatique (conseillé en production)

Il faut :

- un VPS sous Ubuntu 22.04 ou plus récent ;
- un **nom de domaine** (par exemple `billets.mondomaine.cd`) avec un enregistrement DNS **A** qui pointe vers l'IP du VPS.

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Le projet
git clone https://github.com/kams77/CKaisse-POS-react.git kolapass
cd kolapass/deploy
cp .env.example .env
nano .env            # DOMAINE, EMAIL, SETUP_CODE

# 3. Pare-feu : seuls SSH, HTTP et HTTPS sont ouverts
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# 4. Démarrage (KolaPass + Caddy, certificat Let's Encrypt obtenu tout seul)
docker compose -f docker-compose.https.yml up -d --build
docker compose -f docker-compose.https.yml logs -f      # Ctrl+C pour quitter
```

Le site répond sur `https://billets.mondomaine.cd`. Le port 3000 n'est **pas** exposé : seul Caddy reçoit le trafic. Les données sont dans `kolapass/deploy/data/`.

> **Serveur au bureau plutôt que VPS ?** Le même `docker-compose.https.yml` fonctionne. Il faut alors :
>
> - rediriger les ports 80 et 443 de la box vers le serveur ;
> - utiliser un nom DDNS (DuckDNS, No-IP…) si l'IP publique change.

### Variables de configuration

| Variable | Rôle | Valeur conseillée |
|---|---|---|
| `SETUP_CODE` | Code demandé **une seule fois**, à la création du compte administrateur | un code à vous, au moins 8 caractères |
| `PORT` | Port HTTP du serveur | `3000` |
| `DATA_DIR` | Dossier des données | `./data` (`/data` dans Docker) |
| `COOKIE_SECURE` | Cookie de session réservé au HTTPS | `true` dès que le site est en HTTPS |
| `TRUST_PROXY` | Lire la vraie IP des clients derrière Caddy, le Synology ou Nginx | `true` seulement derrière un proxy |

---

## 4. Premier démarrage (administrateur)

1. Ouvrez l'adresse du serveur et créez le **compte administrateur** avec le `SETUP_CODE`.
2. Remplissez **Administration → Paramètres** :
   - nom de l'organisation (affiché dans l'appli Android) ;
   - taux du jour et commission ;
   - **portiques**, par exemple `Quai 1`, `Quai 2`, `Porte A`. L'appli Android les propose dans sa liste.
3. Dans **Administration → Comptes**, créez :
   - les organisateurs ou guichetiers (rôle *Organisateur*) ;
   - **un compte par agent de contrôle** (rôle *Agent*).

   Notez le **mot de passe provisoire** de chaque compte : il ne s'affiche qu'une fois.
4. Remettez à chaque agent :
   - l'**adresse du serveur** ;
   - son **identifiant** et son mot de passe provisoire.

   À sa première connexion, l'agent choisit son propre mot de passe : au moins 10 caractères, avec des lettres et des chiffres.

---

## 5. Postes web (guichets, organisateurs, administration)

- **Navigateur** : Chrome, Edge ou Firefox récent, sur PC, tablette ou téléphone.
- **Raccourci** : ajoutez l'adresse du serveur aux favoris ou à l'écran d'accueil. Chrome : *⋮ → Ajouter à l'écran d'accueil*.
- **Imprimante de billets** : n'importe quelle imprimante reconnue par le système. Les billets s'impriment depuis la fiche du billet ou depuis une plage.
- **Envoi du billet au client** : depuis la fiche du billet, par **WhatsApp, SMS ou e-mail**. Le client reçoit un lien `https://…/billet?c=…&s=…` qui affiche son QR code. Le lien est signé : il ne peut pas être deviné.
- **Session** : chaque poste a la sienne. Un compte désactivé est déconnecté partout.

---

## 6. Application Android « KolaPass Scan » (agents)

### Récupérer l'APK

Chaque modification du dossier `android/` déclenche GitHub Actions, qui compile l'application et publie l'APK. Pour la récupérer :

- ouvrez <https://github.com/kams77/CKaisse-POS-react/releases> ;
- téléchargez le fichier `KolaPassScan-1.0.X.apk` de la version la plus récente.

L'application fonctionne sur **Android 7.0 ou plus récent**. Elle n'a pas besoin de Google Play : le lecteur de QR est intégré.

### Installer sur chaque téléphone

1. Ouvrez le lien de l'APK **sur le téléphone**. Vous pouvez aussi le copier par câble USB ou l'envoyer par WhatsApp.
2. Android demande d'autoriser l'installation depuis cette source (Chrome, Fichiers…) : acceptez.
3. Ouvrez **KolaPass Scan** et autorisez la **caméra**.

### Configurer (une fois par téléphone)

| Champ | Exemple |
|---|---|
| Adresse du serveur | `https://billets.mondomaine.cd`, ou `http://192.168.1.20:3000` sur le réseau local |
| Identifiant | `agentq1` |
| Mot de passe | le mot de passe provisoire, puis le mot de passe choisi |

Choisissez ensuite l'**événement** (ou « Tous les événements ») et la **porte** : ce choix reste mémorisé.

### Utilisation au portique

| Écran | Signification | Que faire |
|---|---|---|
| **Vert « ENTRÉE OK »** + bip court | Billet valide, entrée enregistrée | Laisser passer |
| **Orange « DÉJÀ ENTRÉ »** + double vibration | Billet déjà scanné, avec l'heure et la porte du 1er passage | Refuser, appeler le superviseur |
| **Rouge « BILLET INVALIDE / BLOQUÉ / AUTRE ÉVÉNEMENT »** | Faux billet, billet annulé ou mauvais événement | Refuser |

Autres commandes :

- **Saisir un code** : pour un QR abîmé, tapez le code imprimé (`E01-XXXXXXXXXX`).
- **Lampe** : pour les quais mal éclairés.
- **Synchro** : force l'envoi des scans en attente.
- Touchez l'écran de résultat pour scanner le billet suivant.

### Sans réseau (mode hors ligne)

- Toutes les 15 secondes, l'appli télécharge la liste des billets des événements en cours. Elle ne contient ni téléphone ni montant.
- Si le réseau tombe, la ligne d'état passe à **« HORS LIGNE »**. L'appli continue de contrôler avec cette liste et refuse un billet déjà scanné **sur ce téléphone**.
- Les entrées sont mises en file (« N en attente d'envoi ») et envoyées automatiquement au retour du réseau.
- Si deux téléphones hors ligne ont laissé entrer le même billet, le serveur garde le premier passage et signale l'autre dans le **journal des scans**.

> Conseil : avant l'ouverture des portes, vérifiez que chaque téléphone affiche **« ● En ligne »**, ce qui garantit une liste à jour.

### Mettre à jour l'application

Installez le nouvel APK par-dessus l'ancien.

- **Avec une clé de signature** enregistrée sur GitHub (voir ci-dessous), la mise à jour garde les réglages.
- **Sans clé**, chaque version est signée avec une clé de test différente. Il faut alors **désinstaller** l'ancienne version avant d'installer la nouvelle.

#### Clé de signature stable (à faire une fois)

1. Créez une clé sur un PC qui a Java installé (`keytool` est fourni avec Java) :

   ```bash
   keytool -genkeypair -keystore kolapass-release.jks -alias kolapass -keyalg RSA -keysize 2048 -validity 10000
   ```

   Gardez ce fichier et son mot de passe en lieu sûr. Perdre la clé oblige à réinstaller l'application sur tous les téléphones.
2. Encodez le fichier en base64 :
   - Linux / macOS : `base64 -w0 kolapass-release.jks`
   - Windows PowerShell : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("kolapass-release.jks"))`
3. Sur GitHub, ouvrez *Settings → Secrets and variables → Actions → New repository secret* et créez :
   - `KEYSTORE_BASE64` : le texte base64 ;
   - `KEYSTORE_PASSWORD` : le mot de passe de la clé ;
   - `KEY_ALIAS` : `kolapass` (facultatif, c'est la valeur par défaut).
4. Relancez la compilation : *Actions → Android (KolaPass Scan) → Run workflow*. Vous pouvez aussi pousser une modification.

### Compiler soi-même (facultatif)

Il faut Android Studio, ou le JDK 17 avec le SDK Android :

```bash
cd android
./gradlew assembleRelease
# APK : android/app/build/outputs/apk/release/app-release.apk
```

---

## 7. Sauvegardes et restauration

| Quoi | Où | Fréquence |
|---|---|---|
| Copie automatique | `data/sauvegardes/kolapass-AAAA-MM-JJ.json` (14 jours) | chaque jour |
| Copie manuelle | **Administration → Télécharger une sauvegarde** | avant chaque événement important |
| Copie hors du serveur | `deploy/sauvegarde.sh /mnt/disque-externe/kolapass` (dans `cron`) | toutes les heures, par exemple |

Exemple de ligne `cron` (`crontab -e`) :

```cron
0 * * * * /home/ubuntu/kolapass/deploy/sauvegarde.sh /mnt/sauvegardes/kolapass
```

Pour **restaurer** : **Administration → Restaurer…**, puis choisissez le fichier `.json`. **Toutes** les données actuelles sont remplacées et tout le monde est déconnecté.

Si le serveur ne démarre plus :

1. arrêtez-le ;
2. remplacez `data/kolapass.json` par la copie voulue ;
3. redémarrez.

---

## 8. Mettre à jour le serveur

```bash
cd kolapass
git pull
# Docker (Synology / VPS) :
cd deploy && docker compose -f docker-compose.https.yml up -d --build
# PC sans Docker :
npm install && npm run build && npm start
```

Les données (`data/`) sont conservées. Faites une **sauvegarde manuelle** avant chaque mise à jour.

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Android : « Serveur injoignable » | Mauvaise adresse, téléphone sur un autre réseau, pare-feu | Ouvrez l'adresse dans Chrome sur le téléphone : la page de connexion doit s'afficher. Vérifiez le port 3000 ou 443. |
| Android : « Redirection : vérifiez l'adresse » | `http://` saisi alors que le site est en HTTPS | Saisissez `https://…` |
| « Réponse inattendue : est-ce bien un serveur KolaPass ? » | Adresse d'une autre page, ou portail Wi-Fi captif | Corrigez l'adresse, connectez-vous au Wi-Fi |
| « Compte bloqué » | 5 mots de passe erronés | Attendez 15 minutes, ou faites débloquer le compte dans **Administration → Comptes** |
| « Session expirée » | Compte désactivé, mot de passe réinitialisé ou session de plus de 24 h | Reconnectez-vous |
| Le QR ne se lit pas | Écran du client trop sombre, reflet, QR abîmé | Faites monter la luminosité, allumez la lampe, ou utilisez **Saisir un code** |
| La caméra ne marche pas dans le **navigateur** | Le site n'est pas en HTTPS | Utilisez l'appli Android (elle marche aussi en HTTP), ou passez le site en HTTPS |
| « HORS LIGNE » en permanence | Réseau absent sur le quai | Continuez : les scans partent au retour du réseau. Gardez le même téléphone jusqu'à la synchronisation. |
| Certificat HTTPS absent (Caddy) | DNS pas encore propagé, ports 80/443 fermés | `docker compose -f docker-compose.https.yml logs caddy`, puis vérifiez le DNS et le pare-feu |
| Le serveur ne démarre pas : « SETUP_CODE contient encore la valeur d'exemple » | `CHANGEZ_MOI` laissé tel quel | Mettez votre propre code |

Journaux du serveur :

- Docker : `docker logs kolapass` ;
- PC : la fenêtre du terminal.

---

## 10. Liste de contrôle avant la mise en service

- [ ] Le site est en **HTTPS**, avec `COOKIE_SECURE=true` et `TRUST_PROXY=true` derrière un proxy.
- [ ] Le `SETUP_CODE` est personnel, et le compte administrateur est créé avec un mot de passe solide.
- [ ] Chaque agent a **son propre compte**, et les comptes inutiles sont désactivés.
- [ ] Les portiques sont configurés, l'appli est installée et connectée sur chaque téléphone, et chacun affiche « ● En ligne ».
- [ ] Un essai complet est fait : vente, envoi WhatsApp, scan vert, 2ᵉ scan orange, faux code rouge, scan hors ligne puis synchronisation.
- [ ] Une sauvegarde automatique hors serveur est en place, et une **restauration a été essayée** au moins une fois.
- [ ] L'APK est signé avec la clé stable (secret `KEYSTORE_BASE64`).
