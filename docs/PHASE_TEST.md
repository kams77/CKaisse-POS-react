# Phase de test KolaPass — données saisies par l'administrateur

Le but est de vérifier, avec de vraies personnes et de vrais téléphones, que KolaPass fait trois choses :

- il vend et imprime des billets justes ;
- il refuse toute deuxième entrée ;
- il garde une trace de chaque action.

Il n'y a **aucune donnée de démonstration** : l'administrateur crée tout à la main.

## 0. Préparation (administrateur, 15 min)

1. Démarrez le serveur (voir le README) et notez son adresse, par exemple `http://192.168.1.20:3000`.
2. Ouvrez cette adresse et créez le compte **administrateur** avec le code d'installation.
3. Dans **Administration → Paramètres** :
   - nom de l'organisation ;
   - taux du jour (CDF, XOF, EUR) ;
   - portiques (`Porte A`, `Porte B`…) ;
   - commission par défaut ;
   - remise maximale des organisateurs ;
   - un code promo de test, par exemple `TEST10` à 10 %.
4. Dans **Administration → Comptes**, créez au moins :
   - 1 organisateur ;
   - 2 agents de contrôle (un par porte).

   Notez le mot de passe provisoire affiché : il ne s'affiche qu'une fois.
5. Remettez à chacun son identifiant et son mot de passe provisoire. À la première connexion, chacun choisit son propre mot de passe.

## 1. Scénarios à dérouler

Cochez chaque ligne et notez tout écart dans le tableau de la section 3.

### A. Comptes et droits
- [ ] L'organisateur ne voit ni « Administration » ni « Rentabilité ».
- [ ] L'agent ne voit que **Portique**, **Billets** et **Journal**. Il ne voit ni les montants ni les numéros de téléphone.
- [ ] Après 5 mauvais mots de passe, le compte est bloqué 15 minutes. L'administrateur peut le **débloquer**.
- [ ] « Réinitialiser » donne un nouveau mot de passe provisoire. L'ancien ne fonctionne plus.
- [ ] Un compte **désactivé** ne peut plus se connecter, et ses sessions ouvertes sont fermées.

### B. Événement et vente (organisateur)
- [ ] Créer un événement : titre, lieu, date, et prix et jauge pour au moins une catégorie. Les catégories sans jauge restent fermées.
- [ ] Vendre 1 billet en **Espèces**. Le prix affiché est celui de la catégorie.
- [ ] Vendre 2 billets avec le code promo `TEST10`. Le prix enregistré est bien réduit de 10 %.
- [ ] Un code promo inventé est refusé.
- [ ] Vendre plus de billets qu'il ne reste de places : refusé.
- [ ] Ouvrir un billet : le **QR code s'affiche** et un téléphone le lit (appareil photo ou application de lecture QR).

### C. Plage de billets imprimés (organisateur)
- [ ] Générer une plage de 10 billets, numérotés de 1 à 10, pour un revendeur.
- [ ] Imprimer la planche. Les QR sont lisibles sur papier.
- [ ] Les codes d'entrée sont **aléatoires** : on ne peut pas deviner le billet n° 11.

### D. Portique (agents, sur 2 téléphones en même temps)
- [ ] Agent 1, Porte A : scanner un billet vendu → **ACCÈS VALIDE**.
- [ ] Agent 2, Porte B : scanner **le même billet** → **refusé (doublon)**, avec l'heure et la porte de la première entrée.
- [ ] Scanner un billet bloqué par l'organisateur → **refusé**.
- [ ] Taper un code inventé → **refusé**.
- [ ] Choisir « Événement contrôlé = X » et scanner un billet d'un autre événement → **refusé**.
- [ ] Le **journal des scans** montre chaque passage, avec l'agent et la porte.

### E. Coupure réseau (agent)
- [ ] Synchroniser avant de couper : ouvrir le portique quand le réseau fonctionne encore, pour que le téléphone reçoive la liste des billets.
- [ ] Passer en **Mode Stade (hors-ligne)** puis couper le Wi-Fi ou les données.
- [ ] Scanner un billet valide → accepté. Le scanner une deuxième fois → **refusé sur le même téléphone**.
- [ ] Ne rechargez pas la page tant que le réseau est coupé : l'application a besoin du serveur pour s'ouvrir. Si cela arrive, rien n'est perdu : la file des scans hors-ligne réapparaît dès que le serveur répond.
- [ ] Rétablir le réseau → **Synchroniser maintenant**. Le serveur rejoue les scans, et un billet déjà entré à une autre porte apparaît comme doublon dans le journal.

### F. Reversement et sauvegarde
- [ ] L'organisateur demande un reversement **supérieur** à son solde → refusé.
- [ ] Il demande un reversement possible → statut « En attente de l'administrateur ».
- [ ] L'administrateur effectue le transfert, puis clique sur **Marquer payé** avec la référence. Le statut devient « Payé ».
- [ ] L'administrateur **télécharge une sauvegarde** (fichier `.json`) et la range en lieu sûr.
- [ ] Redémarrer le serveur ou le NAS : toutes les données sont toujours là.

## 2. Pendant l'événement test

- Un agent par porte, chacun connecté avec **son** compte : le journal indique qui a scanné.
- Gardez un téléphone de secours chargé, avec un compte agent connecté.
- En cas de doute sur un billet : **Billets** → rechercher le code → voir l'historique.

## 3. Fiche d'anomalie

| N° | Date / heure | Rôle | Écran | Ce qui a été fait | Résultat attendu | Résultat obtenu | Capture |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |

## 4. Fin de test

1. L'administrateur télécharge une sauvegarde finale.
2. Si vous voulez repartir de zéro pour la production, arrêtez le serveur, renommez le dossier `data/` (sans le supprimer, il sert d'archive), puis redémarrez : le serveur revient à l'installation.
