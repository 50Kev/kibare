"""Tests sur la pile en marche. A lancer apres docker compose up -d et le chargement des comptes de demo :
    KIBARE_PILE=1 KIBARE_CA=chemin/vers/root.crt python -m pytest tests/test_pile.py
"""

import json
import os
import shlex
import subprocess
import sys
import time
from pathlib import Path

import pytest
import requests

from sso import connexion, premiere_connexion, session_matrix

RACINE = Path(__file__).resolve().parent.parent
BASE = f"https://{os.environ.get('DOMAINE', 'localhost')}"
VERIFY = os.environ.get("KIBARE_CA", True)
OUTIL = shlex.split(os.environ.get("KIBARE_COMMANDE_OUTIL", "docker compose run --rm -T outil"))

pytestmark = pytest.mark.skipif(os.environ.get("KIBARE_PILE") != "1", reason="pile Kibaré non demarree")

DEMO = {
    "agent1": ("Demo-Agent1-2026", "kibare-demo-agent1"),
    "agent2": ("Demo-Agent2-2026", "kibare-demo-agent2"),
    "agent3": ("Demo-Agent3-2026", "kibare-demo-agent3"),
    "stagiaire": ("Demo-Stagiaire-2026", "kibare-demo-stagiaire"),
}


def poster(chemin, corps):
    for _ in range(8):
        r = requests.post(BASE + chemin, json=corps, verify=VERIFY)
        if r.status_code != 429:
            return r
        time.sleep(r.json().get("retry_after_ms", 2000) / 1000 + 0.2)
    return r


def outil(*args, attendu=0):
    r = subprocess.run([*OUTIL, *args], cwd=RACINE, capture_output=True, text=True, timeout=120)
    assert r.returncode == attendu, r.stderr
    return json.loads(r.stdout) if r.stdout.strip() else None


def entrer(identifiant):
    mdp, cle = DEMO[identifiant]
    jeton, page = connexion(BASE, identifiant, mdp, cle, verify=VERIFY)
    assert jeton, f"connexion de {identifiant} refusee : {page.status_code}"
    return session_matrix(BASE, jeton, verify=VERIFY)


def qui(session):
    return requests.get(f"{BASE}/_matrix/client/v3/account/whoami",
                        headers={"Authorization": f"Bearer {session['accessToken']}"}, verify=VERIFY)


def test_seule_porte_le_compte_agent():
    flux = requests.get(f"{BASE}/_matrix/client/v3/login", verify=VERIFY).json()["flows"]
    assert "m.login.password" not in [f["type"] for f in flux]
    r = poster("/_matrix/client/v3/login",
               {"type": "m.login.password", "identifier": {"type": "m.id.user", "user": "agent1"}, "password": "Demo-Agent1-2026"})
    assert r.status_code in (400, 403)
    assert poster("/_matrix/client/v3/register", {}).status_code == 403


def test_consoles_et_federation_fermees():
    for chemin in ["/_synapse/admin/v1/server_version", "/auth/admin/master/console/", "/_matrix/federation/v1/version", "/_matrix/key/v2/server"]:
        assert requests.get(BASE + chemin, verify=VERIFY, allow_redirects=False).status_code == 404, chemin


def test_entetes_de_securite():
    e = requests.get(BASE + "/", verify=VERIFY).headers
    assert "max-age" in e["Strict-Transport-Security"]
    assert e["X-Frame-Options"] == "DENY"
    assert "Server" not in e


def test_agent_enrole_avec_deux_facteurs():
    assert qui(entrer("agent1")).json()["user_id"] == "@agent1:" + BASE.split("//")[1]


def test_mauvais_code_totp_refuse():
    jeton, page = connexion(BASE, "agent1", DEMO["agent1"][0], code="000000", verify=VERIFY)
    assert jeton is None and "kc-otp-login-form" in page.text


def test_intrus_inconnu_refuse():
    jeton, page = connexion(BASE, "intrus", "Nimporte-Quoi-2026", "x", verify=VERIFY)
    assert jeton is None and "kc-otp-login-form" not in page.text


def test_compte_sans_role_agent_refuse():
    jeton, page = connexion(BASE, "stagiaire", *DEMO["stagiaire"], verify=VERIFY)
    assert jeton is None


def nouvel_agent():
    identifiant = f"essai{int(time.time() * 1000) % 10_000_000}"
    fiche = outil("enroler", identifiant, "--prenom", "Essai", "--nom", "Démo", "--ministere", "Test", "--fonction", "Test")
    return identifiant, fiche


def test_enrolement_impose_totp_puis_nouveau_mot_de_passe():
    identifiant, fiche = nouvel_agent()
    assert fiche["roles"] == ["agent"]
    ligne = next(a for a in outil("lister") if a["identifiant"] == identifiant)
    assert ligne["second_facteur"] == "a configurer" and ligne["ministere"] == "Test"

    # sans configurer le code, rien ne s'ouvre
    jeton, page = connexion(BASE, identifiant, fiche["mot_de_passe_provisoire"], "x", verify=VERIFY)
    assert jeton is None and "kc-totp-settings-form" in page.text

    jeton, secret, _ = premiere_connexion(BASE, identifiant, fiche["mot_de_passe_provisoire"], "Nouveau-Secret-2026x", verify=VERIFY)
    assert jeton and secret
    assert qui(session_matrix(BASE, jeton, verify=VERIFY)).status_code == 200
    assert next(a for a in outil("lister") if a["identifiant"] == identifiant)["second_facteur"] == "oui"
    # l'ancien mot de passe provisoire ne sert plus
    assert connexion(BASE, identifiant, fiche["mot_de_passe_provisoire"], secret, verify=VERIFY)[0] is None
    outil("revoquer", identifiant)


def test_telephone_perdu_un_seul_appareil_coupe():
    garde, perdu = entrer("agent2"), entrer("agent2")
    assert {a["appareil"] for a in outil("appareils", "agent2")} >= {garde["deviceId"], perdu["deviceId"]}
    outil("retirer-appareil", "agent2", perdu["deviceId"])
    assert qui(perdu).status_code == 401
    assert qui(garde).status_code == 200


def test_revocation_immediate_et_definitive():
    identifiant, fiche = nouvel_agent()
    jeton, secret, _ = premiere_connexion(BASE, identifiant, fiche["mot_de_passe_provisoire"], "Revoque-Bientot-2026", verify=VERIFY)
    s = session_matrix(BASE, jeton, verify=VERIFY)
    assert qui(s).status_code == 200
    rapport = outil("revoquer", identifiant)
    assert qui(s).status_code == 401
    assert rapport["duree_ms"] < 5000 and rapport["synapse"] == "desactive"
    assert connexion(BASE, identifiant, "Revoque-Bientot-2026", secret, verify=VERIFY)[0] is None


def test_echange_chiffre_rien_en_clair():
    if not (RACINE / "client" / "node_modules").exists():
        pytest.skip("client non installe : npm install dans client/")
    sessions = [entrer("agent1"), entrer("agent2")]
    env = {**os.environ, "KIBARE_SESSIONS": json.dumps(sessions), "VITE_SERVEUR": BASE}
    if isinstance(VERIFY, str):
        env["NODE_EXTRA_CA_CERTS"] = VERIFY
    r = subprocess.run(["npx", "vitest", "run", "tests/integration/pile.test.js"], cwd=RACINE / "client",
                       env=env, capture_output=True, text=True, timeout=240)
    assert r.returncode == 0, r.stdout[-2000:]
    commande = os.environ.get("KIBARE_COMMANDE_INSPECTER")
    inspecteur = shlex.split(commande) if commande else [sys.executable, "serveur/outils/inspecter.py"]
    for motif in ["Pile-secret-instruction-5520", "Pile-groupe-cabinet", "pile-note.txt", "Pile-fichier-contenu-8812"]:
        v = subprocess.run([*inspecteur, motif], cwd=RACINE, capture_output=True, text=True)
        assert v.returncode == 0 and "verdict: rien en clair" in v.stdout, v.stdout
