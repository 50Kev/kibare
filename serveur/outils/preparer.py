"""Prepare la configuration de Synapse avant son premier demarrage.

Lit les reglages dans l'environnement, cree une seule fois les secrets internes,
produit homeserver.yaml a partir du modele et genere la cle de signature.
"""

import json
import os
import secrets
import subprocess
import sys
from pathlib import Path

OBLIGATOIRES = ["DOMAINE", "MDP_POSTGRES", "SECRET_OIDC", "HOTE_BASE", "ECOUTE", "KEYCLOAK_INTERNE"]
SECRETS_INTERNES = ["SECRET_PARTAGE", "SECRET_MACAROON", "SECRET_FORMULAIRE"]
UID_SYNAPSE = 991


def lire_reglages(env):
    manquants = [c for c in OBLIGATOIRES if not env.get(c)]
    if manquants:
        raise SystemExit("reglages manquants : " + ", ".join(manquants))
    return {c: env[c] for c in OBLIGATOIRES}


def secrets_persistants(fichier):
    # generes au premier passage puis relus, sinon chaque redemarrage casserait les sessions
    if fichier.exists():
        valeurs = json.loads(fichier.read_text(encoding="utf-8"))
    else:
        valeurs = {}
    for cle in SECRETS_INTERNES:
        valeurs.setdefault(cle, secrets.token_urlsafe(48))
    fichier.write_text(json.dumps(valeurs, indent=2), encoding="utf-8")
    fichier.chmod(0o600)
    return valeurs


def remplir(modele, valeurs):
    texte = modele
    for cle, valeur in valeurs.items():
        if '"' in valeur or "\n" in valeur:
            raise SystemExit(f"valeur interdite pour {cle} : pas de guillemet ni de retour a la ligne")
        texte = texte.replace(f"@@{cle}@@", valeur)
    if "@@" in texte:
        reste = texte[texte.index("@@"):].split("\n")[0]
        raise SystemExit(f"modele incomplet, il reste : {reste}")
    return texte


def generer_cle(config):
    subprocess.run(
        [sys.executable, "-m", "synapse.app.homeserver", "--generate-keys", "-c", str(config)],
        check=True,
    )


def donner_a_synapse(dossier):
    # seulement dans le conteneur, en root ; ailleurs (tests, Windows) rien a faire
    if not hasattr(os, "geteuid") or os.geteuid() != 0:
        return
    for chemin in [dossier, *dossier.rglob("*")]:
        os.chown(chemin, UID_SYNAPSE, UID_SYNAPSE)


def main(env=os.environ):
    dossier = Path(env.get("DOSSIER", "/data"))
    modeles = Path(env.get("MODELES", "/modeles"))
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "medias").mkdir(exist_ok=True)

    valeurs = lire_reglages(env)
    valeurs.update(secrets_persistants(dossier / "secrets.json"))
    # chemin avec des / : un chemin Windows casserait les guillemets du YAML (tests sous Windows)
    valeurs["DOSSIER"] = dossier.as_posix()

    config = dossier / "homeserver.yaml"
    config.write_text(remplir((modeles / "homeserver.modele.yaml").read_text(encoding="utf-8"), valeurs), encoding="utf-8")
    config.chmod(0o600)
    (dossier / "log.config").write_text((modeles / "log.config").read_text(encoding="utf-8"), encoding="utf-8")

    if not (dossier / f"{valeurs['DOMAINE']}.signing.key").exists():
        generer_cle(config)
    donner_a_synapse(dossier)
    print("configuration de Synapse prete")


if __name__ == "__main__":
    main()
