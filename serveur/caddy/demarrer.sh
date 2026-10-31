#!/bin/sh
# lance Caddy, puis publie le certificat racine de l'autorite locale (jamais sa cle)
# pour que Synapse puisse joindre Keycloak en https sur le reseau interne
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
pid=$!
trap 'kill -TERM "$pid"' TERM INT
racine=/data/caddy/pki/authorities/local/root.crt
i=0
while [ ! -s "$racine" ] && [ "$i" -lt 120 ]; do sleep 1; i=$((i + 1)); done
if [ -s "$racine" ]; then
	cp "$racine" /ca-publique/root.crt
	# certificat public : lisible par Synapse, qui ne tourne pas en root
	chmod 644 /ca-publique/root.crt
fi
wait "$pid"
