# Kibaré, la messagerie souveraine de l'administration

Kibaré est une messagerie instantanée pour les agents publics du Burkina Faso : messages, groupes et fichiers chiffrés de bout en bout, sur un serveur hébergé par l'État. Seuls les agents enrôlés par l'administration peuvent y entrer, avec un mot de passe et un code à usage unique.

## Architecture

```
navigateur de l'agent  --https-->  Caddy  --réseau interne sans Internet-->  Synapse  ->  PostgreSQL
(client Kibaré, chiffre                    |                                   Keycloak  ->  PostgreSQL
 et déchiffre en local)                    +-- consoles d'administration fermées
```

Le chiffrement se fait **dans le navigateur** avec le protocole Matrix (Olm et Megolm). Le serveur ne reçoit et ne stocke que du chiffré, il ne possède aucune clé. Keycloak gère l'enrôlement, le second facteur et les rôles ; Synapse n'accepte que les agents qui ont le rôle `agent`.

## Niveau d'engagement open source

**Créer** : une application nouvelle (client web et outillage du serveur) reposant sur des bibliothèques éprouvées de la fondation Matrix.

## Technologies et licences

| Composant | Licence | Projet |
|---|---|---|
| Synapse 1.163.0 | AGPL-3.0 | github.com/element-hq/synapse |
| Keycloak 26.8.1 | Apache-2.0 | github.com/keycloak/keycloak |
| PostgreSQL 16 | PostgreSQL License | postgresql.org |
| Caddy 2.10 | Apache-2.0 | github.com/caddyserver/caddy |
| matrix-js-sdk, matrix-sdk-crypto-wasm, matrix-encrypt-attachment | Apache-2.0 | github.com/matrix-org |
| React, Vite, Vitest | MIT | react.dev, vitejs.dev, vitest.dev |
| lucide-react | ISC | github.com/lucide-icons/lucide |
| Bricolage Grotesque | OFL-1.1 | github.com/fontsource/font-files |
| Python, pytest, PyYAML, requests, pyotp | PSF, MIT | python.org, pytest.org |
| NLLB-200 de Meta (outil de traduction, non livré) | CC-BY-NC-4.0 | brouillons mooré et dioula |
| Kibaré (notre code) | MIT | fichier LICENSE |

## Installation

Prérequis : Docker avec Compose, et `curl`. Une seule commande :

```
./installer.sh                        # serveur sur https://localhost
./installer.sh 192.168.1.20 --demo    # adresse vue par les téléphones du réseau, comptes fictifs du jury
```

Au premier lancement, le script génère des secrets aléatoires dans `.env`, lance `docker compose up -d --build`, attend que Kibaré réponde et, avec `--demo`, charge les comptes fictifs. Ensuite, `docker compose up -d` suffit pour redémarrer. Installation manuelle équivalente : copier `.env.example` en `.env`, remplacer chaque valeur par un secret long, puis `docker compose up -d`.

**Choisir l'adresse avant le premier lancement** : elle devient le nom du serveur Matrix (identifiants `@agent1:adresse`) et ne peut plus changer sans tout réinstaller. Pour une démonstration avec des téléphones, utiliser l'adresse IP du poste sur le réseau local, pas `localhost`.

Aucun service tiers n'est appelé : les certificats https viennent de l'autorité locale de Caddy, dont le certificat racine se récupère avec `docker compose cp web:/data/caddy/pki/authorities/local/root.crt kibare-ca.crt` pour l'installer sur les postes et téléphones. En production, utiliser un certificat de l'infrastructure de l'État.

Administration (depuis le serveur, sur le réseau interne) :

```
docker compose run --rm outil demo                    # comptes fictifs du jury
docker compose run --rm outil enroler agent4 --prenom Awa --nom Sawadogo --ministere Santé --fonction Médecin
docker compose run --rm outil revoquer agent4         # coupe tout, sur tous les appareils
docker compose run --rm outil appareils agent2
docker compose run --rm outil retirer-appareil agent2 ABCDEFGHIJ   # téléphone perdu
docker compose run --rm outil lister
python serveur/outils/inspecter.py "texte envoyé"     # le serveur ne lit rien (Windows, Linux, macOS)
```

## Comptes de démonstration (fictifs)

| Identifiant | Mot de passe | Clé TOTP (à saisir dans FreeOTP ou Aegis) | Rôle |
|---|---|---|---|
| agent1 | Demo-Agent1-2026 | NNUWEYLSMUWWIZLNN4WWCZ3FNZ2DC | agent |
| agent2 | Demo-Agent2-2026 | NNUWEYLSMUWWIZLNN4WWCZ3FNZ2DE | agent |
| agent3 | Demo-Agent3-2026 | NNUWEYLSMUWWIZLNN4WWCZ3FNZ2DG | agent |
| stagiaire | Demo-Stagiaire-2026 | NNUWEYLSMUWWIZLNN4WXG5DBM5UWC2LSMU | aucun (refusé) |

`docker compose run --rm outil demo` réaffiche ces clés. À la première ouverture, chaque agent choisit sa phrase de sécurité.

## Tests

```
pip install -r tests/requirements.txt
python -m pytest tests                       # configuration, sans serveur
KIBARE_PILE=1 KIBARE_CA=kibare-ca.crt python -m pytest tests   # sur la pile en marche
cd client && npm install && npm test         # client
```

## Sous Windows

Docker Desktop, Node.js 22, Python 3.12 et Git suffisent. Toutes les commandes ci-dessus fonctionnent dans PowerShell ; `inspecter.py` remplace `inspecter.sh`.

## Limites

Le serveur voit qui appartient à quel groupe et quand chacun écrit ; aucune application web ne peut empêcher une photo de l'écran ; les règles de classification sont appliquées par le client ; l'interface en mooré et en dioula est en bêta (traduction automatique en cours de relecture, le français s'affiche pour les textes non validés). Le détail est dans `NOTE_SECURITE.md`.
