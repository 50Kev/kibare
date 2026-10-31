import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "serveur" / "outils"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
