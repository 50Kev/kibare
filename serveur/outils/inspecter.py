"""Epreuve du jury "le serveur ne lit rien", utilisable sous Windows, Linux et macOS.

    python serveur/outils/inspecter.py "texte envoye pendant la demo"

Cherche le texte dans les evenements stockes par Synapse et dans les fichiers recus.
Hors Docker (poste de test) : KIBARE_LOCAL=1, KIBARE_DSN et KIBARE_MEDIAS.
"""

import os
import subprocess
import sys
from pathlib import Path

REQUETES = {
    "messages_chiffres": "SELECT count(*) FROM events WHERE type = 'm.room.encrypted';",
    "messages_en_clair": "SELECT count(*) FROM events WHERE type = 'm.room.message';",
    "texte_trouve_en_base": "SELECT count(*) FROM event_json WHERE json LIKE '%' || :'motif' || '%';",
}


def local():
    return os.environ.get("KIBARE_LOCAL") == "1"


def compter_sql(requete, motif):
    # le motif passe en variable psql et la requete par l'entree standard : aucun guillemet a echapper
    if local():
        commande = ["psql", os.environ["KIBARE_DSN"], "-At", "-v", f"motif={motif}"]
    else:
        commande = ["docker", "compose", "exec", "-T", "base", "psql", "-U", "kibare", "-d", "synapse", "-At", "-v", f"motif={motif}"]
    r = subprocess.run(commande, input=requete, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise SystemExit(f"interrogation de la base impossible : {r.stderr.strip()}")
    return int(r.stdout.strip() or 0)


def compter_fichiers(motif):
    if local():
        cible = motif.encode()
        return sum(1 for f in Path(os.environ["KIBARE_MEDIAS"]).rglob("*") if f.is_file() and cible in f.read_bytes())
    r = subprocess.run(["docker", "compose", "exec", "-T", "synapse", "grep", "-rlF", "--", motif, "/data/medias"],
                       capture_output=True, text=True, encoding="utf-8")
    # grep renvoie 1 quand il ne trouve rien, ce qui est le resultat attendu
    if r.returncode not in (0, 1):
        raise SystemExit(f"lecture des fichiers impossible : {r.stderr.strip()}")
    return len([l for l in r.stdout.splitlines() if l.strip()])


def inspecter(motif):
    resultats = {nom: compter_sql(sql, motif) for nom, sql in REQUETES.items()}
    resultats["texte_trouve_dans_les_fichiers"] = compter_fichiers(motif)
    propre = resultats["messages_en_clair"] == 0 and resultats["texte_trouve_en_base"] == 0 and resultats["texte_trouve_dans_les_fichiers"] == 0
    return resultats, propre


def main(argv):
    if len(argv) < 2 or not argv[1].strip():
        raise SystemExit('usage : python serveur/outils/inspecter.py "texte a chercher"')
    resultats, propre = inspecter(argv[1])
    for nom, valeur in resultats.items():
        print(f"{nom}: {valeur}")
    print("verdict: rien en clair" if propre else "verdict: TEXTE EN CLAIR TROUVE")
    return 0 if propre else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))
