"""Lanceur Kibare pour le poste local : un menu et des commandes simples.

Appele par les fichiers .bat, il marche aussi sous Linux et macOS :
    python scripts-windows/lanceur.py menu
    python scripts-windows/lanceur.py demarrer
"""

import os
import platform
import secrets
import shutil
import ssl
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CLIENT = RACINE / "client"
ENV = RACINE / ".env"
CERTIFICAT = RACINE / "kibare-ca.crt"
WINDOWS = platform.system() == "Windows"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# petits outils

def titre(texte):
    print(f"\n=== {texte} ===")


def ok(texte):
    print(f"  [ok] {texte}")


def alerte(texte):
    print(f"  [!] {texte}")


def demander(question, defaut=None):
    suffixe = f" [{defaut}]" if defaut else ""
    reponse = input(f"{question}{suffixe} : ").strip()
    return reponse or (defaut or "")


def confirmer(question):
    return demander(f"{question} (o/n)", "n").lower() in ("o", "oui", "y", "yes")


def programme(nom):
    # sous Windows, npm et npx sont des .cmd : on passe par leur chemin complet
    return shutil.which(nom)


def lancer(commande, dossier=RACINE, verifier=True, **options):
    print(f"  > {' '.join(str(c) for c in commande)}")
    r = subprocess.run(commande, cwd=dossier, **options)
    if verifier and r.returncode != 0:
        raise SystemExit(f"la commande a echoue (code {r.returncode})")
    return r


def compose(*args, **options):
    return lancer(["docker", "compose", *args], **options)


def lire_env():
    valeurs = {}
    if ENV.exists():
        for ligne in ENV.read_text(encoding="utf-8").splitlines():
            if "=" in ligne and not ligne.lstrip().startswith("#"):
                cle, valeur = ligne.split("=", 1)
                valeurs[cle.strip()] = valeur.strip()
    return valeurs


def domaine():
    return lire_env().get("DOMAINE", "localhost")


def exiger_env():
    if not ENV.exists():
        raise SystemExit("le fichier .env n'existe pas : lancez d'abord l'etape 'creer le fichier .env'")


# commandes

def verifier():
    titre("Outils necessaires")
    manque = False
    for nom, args, role in [
        ("docker", ["--version"], "lancer le serveur"),
        ("node", ["--version"], "construire et tester le client"),
        ("npm", ["--version"], "installer les dependances du client"),
        ("git", ["--version"], "publier le depot"),
    ]:
        chemin = programme(nom)
        if not chemin:
            alerte(f"{nom} introuvable ({role})")
            manque = True
            continue
        version = subprocess.run([chemin, *args], capture_output=True, text=True).stdout.strip().splitlines()
        ok(f"{nom} : {version[0] if version else 'present'}")
    ok(f"python : {platform.python_version()}")
    if programme("docker"):
        r = subprocess.run(["docker", "compose", "version"], capture_output=True, text=True)
        ok("docker compose : " + r.stdout.strip()) if r.returncode == 0 else alerte("docker compose indisponible")
        r = subprocess.run(["docker", "info"], capture_output=True, text=True)
        if r.returncode != 0:
            alerte("Docker est installe mais ne tourne pas : demarrez Docker Desktop")
            manque = True
    print("\nTout est pret." if not manque else "\nInstallez ce qui manque avant de continuer.")


def creer_env():
    titre("Fichier .env (secrets du serveur)")
    if ENV.exists() and not confirmer("Un .env existe deja. Le remplacer par de nouveaux secrets ? Les donnees existantes ne s'ouvriraient plus"):
        print("  .env conserve.")
        return
    print("  L'adresse devient le nom du serveur et ne pourra plus changer sans tout effacer.")
    print("  Pour des telephones, donnez l'adresse IP de ce PC sur le reseau (ipconfig), pas localhost.")
    dom = demander("Adresse du serveur", "localhost")
    lignes = [
        "# genere par le lanceur, ne jamais publier ce fichier",
        f"DOMAINE={dom}",
        f"MDP_POSTGRES={secrets.token_urlsafe(32)}",
        f"SECRET_OIDC={secrets.token_urlsafe(32)}",
        f"SECRET_OUTIL={secrets.token_urlsafe(32)}",
        "ADMIN_KEYCLOAK=gardien",
        f"MDP_ADMIN_KEYCLOAK={secrets.token_urlsafe(24)}",
    ]
    ENV.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    (CLIENT / ".env").write_text(f"VITE_SERVEUR=https://{dom}\n", encoding="utf-8")
    ok(".env cree avec des secrets aleatoires")
    ok(f"client/.env pointe vers https://{dom}")


def installer():
    titre("Dependances du client (npm)")
    npm = programme("npm")
    if not npm:
        raise SystemExit("npm introuvable : installez Node.js 22")
    lancer([npm, "install"], dossier=CLIENT)
    titre("Dependances des tests (pip)")
    lancer([sys.executable, "-m", "pip", "install", "-r", str(RACINE / "tests" / "requirements.txt")])
    ok("dependances installees")


def attendre_serveur(delai=420):
    # Synapse et Keycloak doivent repondre tous les deux : Keycloak demarre souvent apres Synapse
    urls = [f"https://{domaine()}/_matrix/client/v3/login",
            f"https://{domaine()}/auth/realms/kibare/.well-known/openid-configuration"]
    # verification locale de disponibilite seulement : le certificat vient de l'autorite locale de Caddy
    contexte = ssl._create_unverified_context()
    print(f"  attente de https://{domaine()} (Keycloak peut prendre deux minutes)", end="", flush=True)

    def repond(url):
        try:
            with urllib.request.urlopen(url, timeout=5, context=contexte) as r:
                return r.status == 200
        except Exception:
            return False

    fin = time.time() + delai
    while time.time() < fin:
        if all(repond(url) for url in urls):
            print(" pret")
            return True
        print(".", end="", flush=True)
        time.sleep(5)
    print()
    return False


def demarrer():
    exiger_env()
    titre("Demarrage du serveur")
    compose("up", "-d", "--build")
    if attendre_serveur():
        ok(f"Kibare est en ligne : https://{domaine()}/")
        print("  Etapes suivantes : charger les comptes de demo, recuperer le certificat.")
    else:
        alerte("le serveur ne repond pas encore : consultez les journaux")


def arreter():
    titre("Arret du serveur (les donnees sont gardees)")
    compose("down")


def etat():
    titre("Etat des services")
    compose("ps")


def journaux():
    service = demander("Service (base, synapse, keycloak, web, ou vide pour tous)", "")
    compose("logs", "--tail", "200", *([service] if service else []), verifier=False)


def effacer_tout():
    titre("Effacement complet")
    print("  Supprime la base, les comptes, les messages chiffres et les certificats.")
    if demander("Tapez EFFACER pour confirmer") != "EFFACER":
        print("  Annule.")
        return
    compose("down", "-v")
    ok("tout est efface")


def demo():
    exiger_env()
    titre("Comptes de demonstration")
    compose("run", "--rm", "outil", "demo")
    print("\n  Saisissez chaque cle TOTP dans FreeOTP ou Aegis (saisie manuelle, 6 chiffres, 30 secondes).")


def certificat():
    titre("Certificat https local")
    compose("cp", "web:/data/caddy/pki/authorities/local/root.crt", str(CERTIFICAT))
    ok(f"certificat copie dans {CERTIFICAT.name}")
    if WINDOWS and confirmer("L'installer comme autorite de confiance pour votre compte Windows"):
        lancer(["certutil", "-addstore", "-user", "Root", str(CERTIFICAT)], verifier=False)
    else:
        print("  Sur un telephone : envoyez-vous ce fichier et installez-le comme certificat d'autorite.")


def outil(*args):
    exiger_env()
    compose("run", "--rm", "outil", *args, verifier=False)


def enroler():
    titre("Enroler un agent")
    ident = demander("Identifiant (minuscules, chiffres, point, tiret)")
    args = ["enroler", ident,
            "--prenom", demander("Prenom"), "--nom", demander("Nom"),
            "--ministere", demander("Ministere"), "--fonction", demander("Fonction")]
    if confirmer("Lui donner aussi le role administrateur"):
        args.append("--administrateur")
    outil(*args)
    print("  Remettez le mot de passe provisoire en main propre. A la premiere connexion : code TOTP puis nouveau mot de passe.")


def revoquer():
    titre("Revoquer un agent")
    ident = demander("Identifiant de l'agent")
    if ident and confirmer(f"Couper tout acces de {ident} sur tous ses appareils"):
        outil("revoquer", ident)


def appareils():
    titre("Appareils d'un agent")
    ident = demander("Identifiant de l'agent")
    if not ident:
        return
    outil("appareils", ident)
    appareil = demander("Identifiant d'un appareil a retirer (vide pour aucun)", "")
    if appareil and confirmer(f"Retirer l'appareil {appareil}"):
        outil("retirer-appareil", ident, appareil)


def lister():
    titre("Agents enroles")
    outil("lister")


def inspecter():
    titre("Le serveur ne lit rien")
    motif = demander("Texte envoye pendant la demonstration")
    if motif:
        lancer([sys.executable, str(RACINE / "serveur" / "outils" / "inspecter.py"), motif], verifier=False)


def client_dev():
    titre("Client en mode developpement")
    npm = programme("npm")
    if not (CLIENT / ".env").exists():
        (CLIENT / ".env").write_text(f"VITE_SERVEUR=https://{domaine()}\n", encoding="utf-8")
    print("  Ouvrez http://localhost:5173 ; Ctrl+C pour arreter.")
    lancer([npm, "run", "dev"], dossier=CLIENT, verifier=False)


def construire():
    titre("Construction du client")
    lancer([programme("npm"), "run", "build"], dossier=CLIENT)
    ok("version de production dans client/dist")


def tests():
    titre("Tests du client")
    r1 = lancer([programme("npx"), "vitest", "run"], dossier=CLIENT, verifier=False)
    titre("Tests de configuration du serveur")
    r2 = lancer([sys.executable, "-m", "pytest", "-q", "tests"], verifier=False)
    print("\nTous les tests passent." if r1.returncode == 0 and r2.returncode == 0 else "\nDes tests echouent : lisez les messages ci-dessus.")


def tests_pile():
    exiger_env()
    if not CERTIFICAT.exists():
        raise SystemExit("recuperez d'abord le certificat (kibare-ca.crt)")
    titre("Tests sur la pile en marche")
    env = {**os.environ, "KIBARE_PILE": "1", "KIBARE_CA": str(CERTIFICAT), "DOMAINE": domaine()}
    lancer([sys.executable, "-m", "pytest", "-v", "tests/test_pile.py"], env=env, verifier=False)


def avant_git():
    titre("Verification avant publication")
    git = programme("git")
    if not git or not (RACINE / ".git").exists():
        alerte("ce dossier n'est pas un depot Git (git init pour commencer)")
        return
    suivis = subprocess.run([git, "ls-files"], cwd=RACINE, capture_output=True, text=True).stdout.splitlines()
    locaux = (".env", "client/.env", "kibare-ca.crt", "comptes-demo.txt", "qr-comptes-demo.html",
              "diagnostic.bat", "lancement-auto.bat", "traduire-nllb.bat", "publier.bat", "commandes-diag.cmd",
              "LISEZMOI-LOCAL.txt")
    interdits = [f for f in suivis if f in locaux or f.startswith(("documents/", "_traduction/", "_to_delete/"))
                 or f.startswith("journal-") or "node_modules/" in f or "__pycache__/" in f]
    if interdits:
        alerte("ces fichiers ne doivent pas etre publies : " + ", ".join(interdits[:10]))
        print("  Retirez-les avec : git rm --cached <fichier>")
    else:
        ok("aucun secret, fichier de travail ni document interne n'est suivi par Git")
    for obligatoire in ["LICENSE", "README.md", "NOTE_SECURITE.md", "docker-compose.yml"]:
        ok(obligatoire) if obligatoire in suivis else alerte(f"{obligatoire} n'est pas encore suivi")


ACTIONS = [
    ("Verifier les outils installes", verifier),
    ("Creer le fichier .env (secrets)", creer_env),
    ("Installer les dependances", installer),
    ("Demarrer le serveur", demarrer),
    ("Charger les comptes de demonstration", demo),
    ("Recuperer le certificat https", certificat),
    ("Etat des services", etat),
    ("Journaux", journaux),
    ("Arreter le serveur", arreter),
    ("Enroler un agent", enroler),
    ("Revoquer un agent", revoquer),
    ("Appareils d'un agent (telephone perdu)", appareils),
    ("Lister les agents", lister),
    ("Le serveur ne lit rien (inspection)", inspecter),
    ("Lancer le client en developpement", client_dev),
    ("Construire le client", construire),
    ("Lancer les tests", tests),
    ("Lancer les tests sur la pile", tests_pile),
    ("Verifier avant publication Git", avant_git),
    ("Tout effacer (base comprise)", effacer_tout),
]

COMMANDES = {
    "verifier": verifier, "env": creer_env, "installer": installer, "demarrer": demarrer, "arreter": arreter,
    "etat": etat, "journaux": journaux, "effacer": effacer_tout, "demo": demo, "certificat": certificat,
    "enroler": enroler, "revoquer": revoquer, "appareils": appareils, "lister": lister, "inspecter": inspecter,
    "client": client_dev, "construire": construire, "tests": tests, "tests-pile": tests_pile, "avant-git": avant_git,
}


def menu():
    while True:
        print("\n" + "=" * 52)
        print("  KIBARE, la messagerie souveraine : que faire ?")
        print("=" * 52)
        for i, (libelle, _) in enumerate(ACTIONS, 1):
            print(f"  {i:2}. {libelle}")
        print("   0. Quitter")
        choix = input("\nVotre choix : ").strip()
        if choix in ("0", "q", ""):
            return
        if not choix.isdigit() or not 1 <= int(choix) <= len(ACTIONS):
            print("Choix inconnu.")
            continue
        try:
            ACTIONS[int(choix) - 1][1]()
        except SystemExit as e:
            if e.code not in (None, 0):
                alerte(str(e.code))
        except KeyboardInterrupt:
            print("\n  interrompu")
        input("\nEntree pour revenir au menu...")


def principal(argv):
    if len(argv) < 2 or argv[1] == "menu":
        return menu()
    commande = COMMANDES.get(argv[1])
    if not commande:
        print("commandes : menu, " + ", ".join(COMMANDES))
        return 1
    commande()


if __name__ == "__main__":
    sys.exit(principal(sys.argv))
