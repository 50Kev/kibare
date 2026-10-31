#!/bin/sh
# Epreuve du jury "le serveur ne lit rien" : cherche un texte dans la base et dans les fichiers stockes.
# usage : ./serveur/outils/inspecter.sh "texte envoye pendant la demo"
# hors Docker (poste de test) : KIBARE_LOCAL=1 KIBARE_DSN=... KIBARE_MEDIAS=... ./serveur/outils/inspecter.sh "texte"
set -eu
MOTIF="${1:?indiquer le texte a chercher}"

sql() {
	if [ "${KIBARE_LOCAL:-0}" = 1 ]; then
		psql "$KIBARE_DSN" -At -v motif="$MOTIF"
	else
		docker compose exec -T base psql -U kibare -d synapse -At -v motif="$MOTIF"
	fi
}

fichiers() {
	if [ "${KIBARE_LOCAL:-0}" = 1 ]; then
		grep -rlF -- "$MOTIF" "$KIBARE_MEDIAS" | wc -l
	else
		docker compose exec -T synapse sh -c 'grep -rlF -- "$1" /data/medias | wc -l' _ "$MOTIF"
	fi
}

chiffres=$(echo "SELECT count(*) FROM events WHERE type = 'm.room.encrypted';" | sql)
clairs=$(echo "SELECT count(*) FROM events WHERE type = 'm.room.message';" | sql)
en_base=$(echo "SELECT count(*) FROM event_json WHERE json LIKE '%' || :'motif' || '%';" | sql)
en_fichier=$(fichiers | tr -d ' ')

echo "messages_chiffres: $chiffres"
echo "messages_en_clair: $clairs"
echo "texte_trouve_en_base: $en_base"
echo "texte_trouve_dans_les_fichiers: $en_fichier"
if [ "$clairs" = 0 ] && [ "$en_base" = 0 ] && [ "$en_fichier" = 0 ]; then
	echo "verdict: rien en clair"
else
	echo "verdict: TEXTE EN CLAIR TROUVE"
	exit 1
fi
