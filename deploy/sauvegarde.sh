#!/bin/sh
# Copie de sécurité du fichier de données KolaPass vers un autre dossier/disque.
# Usage : ./sauvegarde.sh /chemin/vers/dossier-de-sauvegarde   (à mettre dans cron, ex. toutes les heures)
set -eu
SRC="$(dirname "$0")/data/kolapass.json"
DEST="${1:?Indiquez le dossier de destination}"
mkdir -p "$DEST"
[ -f "$SRC" ] || { echo "Fichier introuvable : $SRC" >&2; exit 1; }
cp "$SRC" "$DEST/kolapass-$(date +%Y%m%d-%H%M).json"
# On garde 30 jours
find "$DEST" -name 'kolapass-*.json' -mtime +30 -delete
echo "Sauvegarde OK -> $DEST"
