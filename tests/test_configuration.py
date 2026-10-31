"""Verifications sans serveur : la configuration livree respecte le socle de securite."""

import json
import os
import re
from pathlib import Path

import pytest
import yaml

import kibare_admin
import preparer

RACINE = Path(__file__).resolve().parent.parent
SERVEUR = RACINE / "serveur"
ENV = {
    "DOMAINE": "messagerie.gouv.bf", "MDP_POSTGRES": "pg", "SECRET_OIDC": "oidc",
    "HOTE_BASE": "base", "ECOUTE": "0.0.0.0", "KEYCLOAK_INTERNE": "https://idp.kibare.interne:8443",
}


@pytest.fixture
def homeserver(tmp_path, monkeypatch):
    monkeypatch.setattr(preparer, "generer_cle", lambda config: None)
    preparer.main({**ENV, "DOSSIER": str(tmp_path), "MODELES": str(SERVEUR / "synapse")})
    return yaml.safe_load((tmp_path / "homeserver.yaml").read_text()), tmp_path


def test_aucune_inscription_ni_mot_de_passe(homeserver):
    conf, _ = homeserver
    assert conf["enable_registration"] is False
    assert conf["password_config"]["enabled"] is False


def test_aucun_service_exterieur(homeserver):
    conf, _ = homeserver
    assert conf["trusted_key_servers"] == []
    assert conf["federation_domain_whitelist"] == []
    assert conf["report_stats"] is False
    assert all(r["names"] == ["client"] for l in conf["listeners"] for r in l["resources"])


def test_metadonnees_reduites(homeserver):
    conf, _ = homeserver
    assert conf["presence"]["enabled"] is False
    assert conf["require_auth_for_profile_requests"] is True
    assert conf["limit_profile_requests_to_users_who_share_rooms"] is True
    assert conf["user_directory"]["search_all_users"] is False
    assert conf["url_preview_enabled"] is False
    assert conf["encryption_enabled_by_default_for_room_type"] == "all"
    journal = yaml.safe_load((SERVEUR / "synapse" / "log.config").read_text())
    assert journal["loggers"]["synapse.access"]["level"] == "ERROR"


def test_sso_exige_le_role_agent(homeserver):
    conf, _ = homeserver
    oidc = conf["oidc_providers"][0]
    assert oidc["pkce_method"] == "always"
    assert {"attribute": "roles", "value": "agent"} in oidc["attribute_requirements"]
    assert oidc["issuer"] == "https://messagerie.gouv.bf/auth/realms/kibare"
    assert conf["sso"]["client_whitelist"] == ["https://messagerie.gouv.bf/"]


def test_secrets_stables_et_proteges(homeserver, monkeypatch):
    conf, dossier = homeserver
    premier = json.loads((dossier / "secrets.json").read_text())
    monkeypatch.setattr(preparer, "generer_cle", lambda config: None)
    preparer.main({**ENV, "DOSSIER": str(dossier), "MODELES": str(SERVEUR / "synapse")})
    assert json.loads((dossier / "secrets.json").read_text()) == premier
    assert (dossier / "secrets.json").stat().st_mode & 0o077 == 0
    assert (dossier / "homeserver.yaml").stat().st_mode & 0o077 == 0


def test_preparer_refuse_les_reglages_douteux(tmp_path):
    with pytest.raises(SystemExit):
        preparer.main({**ENV, "SECRET_OIDC": "", "DOSSIER": str(tmp_path), "MODELES": str(SERVEUR / "synapse")})
    with pytest.raises(SystemExit):
        preparer.remplir("x: \"@@A@@\"", {"A": 'mal"forme'})
    with pytest.raises(SystemExit):
        preparer.remplir("x: @@OUBLIE@@", {})


def test_compose_isole_les_services():
    compose = yaml.safe_load((RACINE / "docker-compose.yml").read_text())
    assert compose["networks"]["interne"]["internal"] is True
    for nom, service in compose["services"].items():
        image = service.get("image")
        if image:
            assert re.search(r":v?\d+\.\d+", image), f"{nom} : version non figee"
        if nom != "web":
            assert service["networks"] == ["interne"], f"{nom} ne doit voir que le reseau interne"
            assert "ports" not in service
    assert compose["services"]["web"]["ports"] == ["80:80", "443:443"]


def test_royaume_keycloak():
    royaume = json.loads((SERVEUR / "keycloak" / "realm-kibare.json").read_text())
    assert royaume["registrationAllowed"] is False
    assert royaume["bruteForceProtected"] is True
    assert int(re.search(r"length\((\d+)\)", royaume["passwordPolicy"]).group(1)) >= 12
    flux = {f["alias"]: f for f in royaume["authenticationFlows"]}
    formulaires = {e["authenticator"]: e["requirement"] for e in flux["formulaires kibare"]["authenticationExecutions"]}
    assert royaume["browserFlow"] == "navigateur kibare"
    assert formulaires == {"auth-username-password-form": "REQUIRED", "auth-otp-form": "REQUIRED"}
    clients = {c["clientId"]: c for c in royaume["clients"]}
    assert clients["synapse"]["attributes"]["pkce.code.challenge.method"] == "S256"
    assert all(c["directAccessGrantsEnabled"] is False for c in clients.values())
    assert [u["username"] for u in royaume["users"]] == ["service-account-kibare-outil"]
    assert {r["name"] for r in royaume["roles"]["realm"]} == {"agent", "administrateur"}


def test_comptes_de_demo_fictifs():
    demo = json.loads((SERVEUR / "keycloak" / "comptes-demo.json").read_text())
    for u in demo["users"]:
        assert u["lastName"] in ("Démo", "Sans rôle")
    sans_role = [u for u in demo["users"] if "agent" not in u["realmRoles"]]
    assert [u["username"] for u in sans_role] == ["stagiaire"]


def test_caddy_ferme_les_consoles_avant_tout():
    texte = (SERVEUR / "caddy" / "Caddyfile").read_text()
    position_interdit = texte.index("handle @interdit")
    assert all(position_interdit < m.start() for m in re.finditer(r"\bhandle /", texte))
    for chemin in ["/_synapse/admin/*", "/auth/admin/*", "/_matrix/federation/*"]:
        assert chemin in texte
    assert "local_certs" in texte and "output discard" in texte


def test_outil_identifiants_et_mots_de_passe():
    assert kibare_admin.verifier_identifiant("agent.ouedraogo") == "agent.ouedraogo"
    for mauvais in ["A", "Agent1", "agent 1", "../x", "a" * 33]:
        with pytest.raises(SystemExit):
            kibare_admin.verifier_identifiant(mauvais)
    for _ in range(200):
        mdp = kibare_admin.mot_de_passe_provisoire()
        assert len(mdp) >= 12 and re.search("[A-Z]", mdp) and re.search("[a-z]", mdp) and re.search("[0-9]", mdp)


def test_limites_de_connexion(homeserver):
    conf, _ = homeserver
    assert conf["rc_login"]["account"]["burst_count"] <= 10
    assert conf["rc_login"]["failed_attempts"]["burst_count"] <= 5
    assert conf["rc_login"]["address"]["burst_count"] >= 20


def test_contexte_docker_sans_secrets_ni_dependances_du_poste():
    regles = (RACINE / ".dockerignore").read_text().split()
    for interdit in [".env", "client/.env", "**/node_modules", ".git", "documents"]:
        assert interdit in regles


def test_fins_de_ligne_imposees():
    texte = (RACINE / ".gitattributes").read_text()
    assert "* text=auto eol=lf" in texte and "*.bat text eol=crlf" in texte


@pytest.mark.skipif(os.name == "nt", reason="script shell")
def test_installation_en_une_commande(tmp_path):
    import shutil, stat, subprocess
    faux = tmp_path / "faux"
    faux.mkdir()
    journal = tmp_path / "appels.log"
    for nom in ("docker", "curl"):
        script = faux / nom
        script.write_text(f'#!/bin/sh\necho "{nom} $*" >> "{journal}"\nexit 0\n')
        script.chmod(script.stat().st_mode | stat.S_IEXEC)
    depot = tmp_path / "depot"
    depot.mkdir()
    shutil.copy(RACINE / "installer.sh", depot / "installer.sh")
    env = {**os.environ, "PATH": f"{faux}{os.pathsep}{os.environ['PATH']}"}
    env.pop("DOMAINE", None)

    subprocess.run(["sh", "installer.sh", "192.168.1.20", "--demo"], cwd=depot, env=env, check=True, capture_output=True)
    contenu = (depot / ".env").read_text()
    valeurs = dict(l.split("=", 1) for l in contenu.splitlines() if "=" in l)
    assert valeurs["DOMAINE"] == "192.168.1.20"
    secrets_generes = [valeurs[c] for c in ("MDP_POSTGRES", "SECRET_OIDC", "SECRET_OUTIL", "MDP_ADMIN_KEYCLOAK")]
    assert all(len(s) == 64 for s in secrets_generes) and len(set(secrets_generes)) == 4
    assert (depot / ".env").stat().st_mode & 0o077 == 0
    appels = journal.read_text()
    assert "docker compose up -d --build" in appels and "docker compose run --rm outil demo" in appels

    # un second lancement garde les secrets, sinon la base ne s'ouvrirait plus
    subprocess.run(["sh", "installer.sh"], cwd=depot, env=env, check=True, capture_output=True)
    assert (depot / ".env").read_text() == contenu


def test_synapse_joint_keycloak_en_https(homeserver):
    # Synapse refuse un fournisseur OIDC dont les points ne sont pas en https
    conf, _ = homeserver
    fournisseur = conf["oidc_providers"][0]
    for cle in ["issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"]:
        assert fournisseur[cle].startswith("https://"), cle
    assert "skip_verification" not in fournisseur
    compose = yaml.safe_load((RACINE / "docker-compose.yml").read_text())
    assert compose["services"]["synapse"]["environment"]["SSL_CERT_FILE"] == "/ca/root.crt"
    assert "8443" not in str(compose["services"]["web"]["ports"])


def test_racine_publiee_lisible_sans_sa_cle():
    # Synapse ne tourne pas en root : la racine copiee doit etre lisible, et la cle jamais copiee
    script = (SERVEUR / "caddy" / "demarrer.sh").read_text()
    assert "chmod 644 /ca-publique/root.crt" in script
    assert "root.key" not in script
