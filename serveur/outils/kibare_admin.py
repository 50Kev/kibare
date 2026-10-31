"""Outil d'administration de Kibaré.

S'utilise depuis le serveur, sur le reseau interne :
    docker compose run --rm outil enroler agent4 --prenom Awa --nom Sawadogo --ministere Sante --fonction Medecin
    docker compose run --rm outil revoquer agent4
Les consoles d'administration ne sont pas exposees sur Internet, seul cet outil y accede.
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REALM = "kibare"
FORMAT_IDENTIFIANT = re.compile(r"^[a-z0-9._-]{3,32}$")
ROLES = ("agent", "administrateur")


class ErreurApi(Exception):
    def __init__(self, statut, corps):
        super().__init__(f"{statut} {corps}")
        self.statut = statut
        self.corps = corps


class Reglages:
    def __init__(self, env=os.environ):
        self.domaine = env.get("DOMAINE", "localhost")
        self.synapse = env.get("SYNAPSE_INTERNE", "http://synapse:8008").rstrip("/")
        self.keycloak = env.get("KEYCLOAK_INTERNE", "http://keycloak:8080").rstrip("/")
        self.secret_outil = env.get("SECRET_OUTIL", "")
        self.fichier_secrets = Path(env.get("FICHIER_SECRETS", "/synapse/secrets.json"))
        self.dossier_etat = Path(env.get("DOSSIER_ETAT", "/etat"))
        self.comptes_demo = Path(env.get("COMPTES_DEMO", "/keycloak/comptes-demo.json"))
        self.admin_keycloak = env.get("ADMIN_KEYCLOAK", "")
        self.mdp_admin_keycloak = env.get("MDP_ADMIN_KEYCLOAK", "")

    def mxid(self, identifiant):
        return f"@{identifiant}:{self.domaine}"


def appel(methode, url, jeton=None, corps=None, formulaire=None):
    entetes = {"Accept": "application/json"}
    donnees = None
    if jeton:
        entetes["Authorization"] = f"Bearer {jeton}"
    if corps is not None:
        donnees = json.dumps(corps).encode()
        entetes["Content-Type"] = "application/json"
    elif formulaire is not None:
        donnees = urllib.parse.urlencode(formulaire).encode()
        entetes["Content-Type"] = "application/x-www-form-urlencoded"
    requete = urllib.request.Request(url, data=donnees, headers=entetes, method=methode)
    try:
        with urllib.request.urlopen(requete, timeout=20) as r:
            brut = r.read()
            return json.loads(brut) if brut else None
    except urllib.error.HTTPError as e:
        raise ErreurApi(e.code, e.read().decode(errors="replace")) from None


def verifier_identifiant(identifiant):
    if not FORMAT_IDENTIFIANT.match(identifiant):
        raise SystemExit("identifiant invalide : 3 a 32 caracteres, minuscules, chiffres, point, tiret ou souligne")
    return identifiant


def mot_de_passe_provisoire(longueur=16):
    # respecte la politique du royaume : majuscule, minuscule, chiffre, 12 caracteres au moins
    alphabet = string.ascii_letters + string.digits
    while True:
        mdp = "".join(secrets.choice(alphabet) for _ in range(longueur))
        if any(c.isupper() for c in mdp) and any(c.islower() for c in mdp) and any(c.isdigit() for c in mdp):
            return mdp


# Keycloak

def jeton_keycloak(r):
    url = f"{r.keycloak}/auth/realms/{REALM}/protocol/openid-connect/token"
    rep = appel("POST", url, formulaire={
        "grant_type": "client_credentials",
        "client_id": "kibare-outil",
        "client_secret": r.secret_outil,
    })
    return rep["access_token"]


def jeton_admin_keycloak(r):
    if not r.admin_keycloak or not r.mdp_admin_keycloak:
        raise SystemExit("ADMIN_KEYCLOAK et MDP_ADMIN_KEYCLOAK sont necessaires pour cette commande")
    url = f"{r.keycloak}/auth/realms/master/protocol/openid-connect/token"
    rep = appel("POST", url, formulaire={
        "grant_type": "password",
        "client_id": "admin-cli",
        "username": r.admin_keycloak,
        "password": r.mdp_admin_keycloak,
    })
    return rep["access_token"]


def kc(r, jeton, methode, chemin, corps=None):
    return appel(methode, f"{r.keycloak}/auth/admin/realms/{REALM}{chemin}", jeton, corps)


def trouver_agent(r, jeton, identifiant):
    trouves = kc(r, jeton, "GET", f"/users?exact=true&username={urllib.parse.quote(identifiant)}")
    if not trouves:
        raise SystemExit(f"aucun agent enrole sous l'identifiant {identifiant}")
    return trouves[0]


# Synapse

def enregistrer_admin_synapse(r):
    # inscription par secret partage, procedure documentee de Synapse : HMAC-SHA1 du module hmac de Python
    secret = json.loads(r.fichier_secrets.read_text())["SECRET_PARTAGE"]
    url = f"{r.synapse}/_synapse/admin/v1/register"
    nonce = appel("GET", url)["nonce"]
    nom, mdp = "kibare-admin", secrets.token_urlsafe(32)
    message = b"\x00".join([nonce.encode(), nom.encode(), mdp.encode(), b"admin"])
    mac = hmac.new(secret.encode(), message, hashlib.sha1).hexdigest()
    rep = appel("POST", url, corps={"nonce": nonce, "username": nom, "password": mdp, "admin": True, "mac": mac})
    return rep["access_token"]


def jeton_synapse(r):
    fichier = r.dossier_etat / "jeton_synapse"
    if fichier.exists():
        return fichier.read_text().strip()
    r.dossier_etat.mkdir(parents=True, exist_ok=True)
    jeton = enregistrer_admin_synapse(r)
    fichier.write_text(jeton)
    fichier.chmod(0o600)
    return jeton


def syn(r, methode, chemin, corps=None):
    return appel(methode, f"{r.synapse}{chemin}", jeton_synapse(r), corps)


# commandes

def enroler(r, identifiant, prenom, nom, ministere, fonction, administrateur=False):
    verifier_identifiant(identifiant)
    jeton = jeton_keycloak(r)
    mdp = mot_de_passe_provisoire()
    kc(r, jeton, "POST", "/users", {
        "username": identifiant,
        "enabled": True,
        "firstName": prenom,
        "lastName": nom,
        "attributes": {"ministere": [ministere], "fonction": [fonction]},
        "requiredActions": ["UPDATE_PASSWORD", "CONFIGURE_TOTP"],
        "credentials": [{"type": "password", "value": mdp, "temporary": True}],
    })
    agent = trouver_agent(r, jeton, identifiant)
    roles = ["agent", "administrateur"] if administrateur else ["agent"]
    representations = [kc(r, jeton, "GET", f"/roles/{nom_role}") for nom_role in roles]
    kc(r, jeton, "POST", f"/users/{agent['id']}/role-mappings/realm", representations)
    return {"identifiant": identifiant, "mot_de_passe_provisoire": mdp, "roles": roles}


def revoquer(r, identifiant):
    debut = time.monotonic()
    jeton = jeton_keycloak(r)
    agent = trouver_agent(r, jeton, identifiant)

    # d'abord fermer la porte d'entree, ensuite couper les sessions ouvertes
    agent["enabled"] = False
    kc(r, jeton, "PUT", f"/users/{agent['id']}", agent)
    kc(r, jeton, "POST", f"/users/{agent['id']}/logout")

    synapse = "desactive"
    try:
        syn(r, "POST", f"/_synapse/admin/v1/deactivate/{urllib.parse.quote(r.mxid(identifiant))}", {"erase": False})
    except ErreurApi as e:
        if e.statut != 404:
            raise
        synapse = "jamais connecte"
    return {"identifiant": identifiant, "keycloak": "desactive", "synapse": synapse,
            "duree_ms": round((time.monotonic() - debut) * 1000)}


def appareils(r, identifiant):
    rep = syn(r, "GET", f"/_synapse/admin/v2/users/{urllib.parse.quote(r.mxid(identifiant))}/devices")
    return [{"appareil": d["device_id"], "nom": d.get("display_name"), "vu": d.get("last_seen_ts")} for d in rep["devices"]]


def retirer_appareil(r, identifiant, appareil):
    mxid = urllib.parse.quote(r.mxid(identifiant))
    syn(r, "DELETE", f"/_synapse/admin/v2/users/{mxid}/devices/{urllib.parse.quote(appareil)}")
    return {"identifiant": identifiant, "appareil": appareil, "etat": "retire"}


def lister(r):
    jeton = jeton_keycloak(r)
    resultat = []
    for u in kc(r, jeton, "GET", "/users?max=1000&briefRepresentation=false"):
        if u["username"].startswith("service-account-"):
            continue
        roles = [x["name"] for x in kc(r, jeton, "GET", f"/users/{u['id']}/role-mappings/realm") if x["name"] in ROLES]
        types = {c["type"] for c in kc(r, jeton, "GET", f"/users/{u['id']}/credentials")}
        otp = "otp" in types or "CONFIGURE_TOTP" in u.get("requiredActions", [])
        resultat.append({
            "identifiant": u["username"],
            "actif": u["enabled"],
            "roles": roles,
            "ministere": (u.get("attributes", {}).get("ministere") or [""])[0],
            "second_facteur": "oui" if "otp" in types else ("a configurer" if otp else "ABSENT"),
        })
    return resultat


def demo(r):
    jeton = jeton_admin_keycloak(r)
    comptes = json.loads(r.comptes_demo.read_text())
    kc(r, jeton, "POST", "/partialImport", comptes)
    lignes = []
    for u in comptes["users"]:
        mdp = next(c["value"] for c in u["credentials"] if c["type"] == "password")
        brut = json.loads(next(c["secretData"] for c in u["credentials"] if c["type"] == "otp"))["value"]
        cle = base64.b32encode(brut.encode()).decode().rstrip("=")
        lignes.append({"identifiant": u["username"], "mot_de_passe": mdp, "cle_totp": cle, "roles": u["realmRoles"]})
    return lignes


def afficher(donnees):
    print(json.dumps(donnees, indent=2, ensure_ascii=False))


def principal(argv=None):
    p = argparse.ArgumentParser(prog="kibare_admin", description="Administration des agents Kibaré")
    sous = p.add_subparsers(dest="commande", required=True)

    e = sous.add_parser("enroler", help="creer le compte d'un agent")
    e.add_argument("identifiant")
    e.add_argument("--prenom", required=True)
    e.add_argument("--nom", required=True)
    e.add_argument("--ministere", required=True)
    e.add_argument("--fonction", required=True)
    e.add_argument("--administrateur", action="store_true")

    sous.add_parser("revoquer", help="couper tout acces d'un agent").add_argument("identifiant")
    sous.add_parser("appareils", help="voir les appareils d'un agent").add_argument("identifiant")
    a = sous.add_parser("retirer-appareil", help="couper un seul appareil (telephone perdu)")
    a.add_argument("identifiant")
    a.add_argument("appareil")
    sous.add_parser("lister", help="tous les agents, leurs roles et leur second facteur")
    sous.add_parser("demo", help="charger les comptes fictifs du jury")

    args = p.parse_args(argv)
    r = Reglages()
    try:
        if args.commande == "enroler":
            afficher(enroler(r, args.identifiant, args.prenom, args.nom, args.ministere, args.fonction, args.administrateur))
        elif args.commande == "revoquer":
            afficher(revoquer(r, args.identifiant))
        elif args.commande == "appareils":
            afficher(appareils(r, args.identifiant))
        elif args.commande == "retirer-appareil":
            afficher(retirer_appareil(r, args.identifiant, args.appareil))
        elif args.commande == "lister":
            afficher(lister(r))
        elif args.commande == "demo":
            afficher(demo(r))
    except ErreurApi as e:
        print(f"refus du serveur : {e.statut} {e.corps[:300]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(principal())
