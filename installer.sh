#!/bin/sh
# Installation de Kibare en une seule commande.
#   ./installer.sh                         serveur sur https://localhost
#   ./installer.sh 192.168.1.20            adresse du serveur vue par les telephones du reseau
#   ./installer.sh 192.168.1.20 --demo     charge aussi les comptes fictifs du jury
# Les secrets sont generes au premier lancement puis conserves dans .env.
set -eu
cd "$(dirname "$0")"

DOMAINE="${DOMAINE:-localhost}"
DEMO=0
for argument in "$@"; do
	case "$argument" in
		--demo) DEMO=1 ;;
		*) DOMAINE="$argument" ;;
	esac
done

secret() {
	od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

if [ ! -f .env ]; then
	umask 077
	{
		echo "# genere par installer.sh, ne jamais publier ce fichier"
		echo "DOMAINE=$DOMAINE"
		echo "MDP_POSTGRES=$(secret)"
		echo "SECRET_OIDC=$(secret)"
		echo "SECRET_OUTIL=$(secret)"
		echo "ADMIN_KEYCLOAK=gardien"
		echo "MDP_ADMIN_KEYCLOAK=$(secret)"
	} > .env
	echo "secrets aleatoires generes dans .env"
else
	DEJA=$(sed -n 's/^DOMAINE=//p' .env)
	if [ -n "$DEJA" ] && [ "$DEJA" != "$DOMAINE" ] && [ "$#" -gt 0 ]; then
		echo "attention : .env existe deja avec DOMAINE=$DEJA, il est conserve"
	fi
	DOMAINE="${DEJA:-$DOMAINE}"
	echo ".env deja present, secrets conserves"
fi

docker compose up -d --build

printf "attente de https://%s (Keycloak peut prendre deux minutes)" "$DOMAINE"
essais=0
# Synapse et Keycloak doivent repondre tous les deux : Keycloak demarre souvent apres Synapse
until curl -ksf -o /dev/null "https://$DOMAINE/_matrix/client/v3/login" \
	&& curl -ksf -o /dev/null "https://$DOMAINE/auth/realms/kibare/.well-known/openid-configuration"; do
	essais=$((essais + 1))
	if [ "$essais" -gt 90 ]; then
		echo
		echo "le serveur ne repond pas : consultez docker compose logs"
		exit 1
	fi
	printf "."
	sleep 5
done
echo " pret"

if [ "$DEMO" = 1 ]; then
	docker compose run --rm outil demo
fi

echo "Kibare est en ligne : https://$DOMAINE/"
echo "Certificat a installer sur les postes et telephones :"
echo "  docker compose cp web:/data/caddy/pki/authorities/local/root.crt kibare-ca.crt"
