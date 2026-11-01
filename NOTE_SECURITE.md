# Note de sécurité de Kibaré

## 1. Ce que nous protégeons, contre qui

Nous protégeons le contenu des échanges de service (messages, fichiers, noms des groupes) et l'accès à la messagerie. Les menaces prises en compte :

- **un serveur curieux ou compromis** : un administrateur système, un intrus sur le serveur ou une copie de la base ne doit rien pouvoir lire ;
- **un écoutant sur le réseau** : Wi-Fi public, opérateur, équipement intermédiaire ;
- **un usurpateur** : personne non enrôlée, mot de passe volé, faux appareil ajouté au compte d'un agent ;
- **un agent qui part ou perd son téléphone** ;
- **la fuite d'un message classifié** par transfert, copie ou capture.

## 2. Protections en place

**Chiffrement de bout en bout.** Protocole Matrix : Olm entre appareils, Megolm pour les groupes, via matrix-sdk-crypto-wasm (code de la fondation Matrix). Les fichiers sont chiffrés en AES-256-CTR avant envoi par matrix-encrypt-attachment, avec vérification d'empreinte SHA-256 à l'ouverture. Aucune cryptographie n'a été écrite par l'équipe. Le serveur impose le chiffrement sur tout nouveau salon.

**Hébergement souverain.** `docker compose up -d` installe toute la pile. Synapse, Keycloak et PostgreSQL sont sur un réseau Docker interne **sans passerelle vers Internet** ; seul le proxy Caddy est exposé, en https avec une autorité de certification locale. Pas de fédération, aucun serveur de clés extérieur (pas même matrix.org), aucune statistique envoyée. Même le lien interne entre Synapse et Keycloak passe en https, avec l'autorité locale dont seule la racine publique est partagée.

**Identité vérifiée.** Inscription fermée et connexion par mot de passe désactivée dans Synapse : la seule entrée est Keycloak, où chaque agent est créé par l'administration. Mot de passe (12 caractères, majuscule, minuscule, chiffre) **et** code TOTP obligatoires pour tous ; l'agent configure son code et change son mot de passe provisoire à la première connexion. Blocage après 5 échecs. Synapse refuse tout compte sans le rôle `agent` (rôles `agent` et `administrateur`). Côté client, chaque appareil est signé par la clé d'identité de l'agent, protégée par sa phrase de sécurité ; les clés de groupe ne partent jamais vers un appareil non signé.

**Révocation immédiate.** `outil revoquer` désactive le compte dans Keycloak, ferme ses sessions, puis le désactive dans Synapse, qui supprime tous ses appareils et le retire de tous les groupes. Mesuré : moins d'une seconde avant que l'application de l'agent efface ses clés et affiche « Accès retiré ». Les autres membres créent une nouvelle clé de groupe sans ses appareils. Pour un téléphone perdu sans départ de l'agent, `outil retirer-appareil` coupe ce seul appareil.

**Administration fermée.** Les consoles de Synapse et de Keycloak et les routes de fédération renvoient 404 depuis l'extérieur ; l'outil d'administration passe par le réseau interne avec un compte de service limité à la gestion des utilisateurs.

**Classification.** Diffusion restreinte et Confidentiel : tampon, interdiction de transfert, copie bloquée, filigrane au nom du lecteur, floutage quand on quitte la fenêtre, expiration automatique. Le niveau est dans le contenu chiffré : le serveur ne le voit pas.

## 3. Ce que le serveur voit malgré tout, et ce que nous faisons pour le réduire

| Ce qu'il voit | Réduction |
|---|---|
| Qui appartient à quel groupe | Groupes privés sur invitation, annuaire limité aux personnes qui partagent un groupe, profils invisibles sans compte |
| Quand un agent envoie un message, à quel groupe | Présence désactivée, pas d'accusé de lecture ni d'indicateur de frappe envoyés |
| La taille des messages et des fichiers | Bourrage : messages arrondis à 256 octets, fichiers à 64 Ko, avant chiffrement |
| Le nom des groupes, des fichiers | Envoyés **chiffrés** (le nom d'un salon Matrix est normalement en clair) ; fichiers stockés sans nom ni type |
| Adresses IP, appareils | IP gardées 1 jour, journaux d'accès supprimés chez Caddy, journaux Synapse sans requêtes, appareils inactifs supprimés après 30 jours, messages supprimés purgés après 1 jour |

Vérifié par test : après un échange, ni le texte, ni le niveau, ni le nom du groupe, ni le nom ou le contenu du fichier n'apparaissent dans la base PostgreSQL ou le dossier des fichiers (`inspecter.py`).

## 4. Limites connues

- **Métadonnées d'acheminement** : le serveur doit savoir à qui livrer, il connaît donc les membres des groupes et les heures d'envoi.
- **Photo de l'écran** : impossible à empêcher dans un navigateur ; le filigrane rend la fuite traçable.
- **Client modifié** : un destinataire qui modifie son application peut ignorer les règles de classification ; le serveur ne peut pas les imposer puisqu'il ne lit rien.
- **Première rencontre** : l'identité d'un collègue est acceptée sans vérification humaine la première fois ; suite prévue : annuaire officiel signé par l'administration.
- **Phrase oubliée** : personne ne peut la retrouver ; l'historique est alors perdu sur un nouvel appareil.
- **Écrans de connexion** : les pages de Keycloak (mot de passe et code) restent en français ; le mooré et le dioula sont des brouillons automatiques en cours de relecture.
- **Certificats** : l'autorité locale de Caddy doit être installée sur les postes ; en production, utiliser l'infrastructure de clés de l'État.
- **Synapse et Keycloak** : leur sécurité dépend de mises à jour régulières.
