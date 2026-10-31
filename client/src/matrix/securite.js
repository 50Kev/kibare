export const CHAMP_BOURRAGE = "bf.gov.bourrage";
export const CHAMP_TAILLE = "bf.gov.taille_reelle";
export const BLOC_TEXTE = 256;
export const BLOC_FICHIER = 64 * 1024;

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];

// en dehors d'un poste de developpement, on ne parle qu'en https
export function serveurAutorise(adresse) {
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && HOTES_LOCAUX.includes(url.hostname);
}

export function exigerServeurSur(adresse) {
  if (!serveurAutorise(adresse)) throw new Error("serveur_non_securise");
}

// tous les messages ont une taille multiple de 256 octets avant chiffrement,
// le serveur ne peut plus deviner un "oui" d'un long rapport
export function bourrer(contenu) {
  const sans = { ...contenu, [CHAMP_BOURRAGE]: "" };
  const taille = new TextEncoder().encode(JSON.stringify(sans)).length;
  const manque = (BLOC_TEXTE - (taille % BLOC_TEXTE)) % BLOC_TEXTE;
  return { ...contenu, [CHAMP_BOURRAGE]: " ".repeat(manque) };
}

export function bourrerOctets(octets) {
  const cible = Math.ceil(Math.max(octets.length, 1) / BLOC_FICHIER) * BLOC_FICHIER;
  const sortie = new Uint8Array(cible);
  sortie.set(octets);
  return sortie;
}

export function retirerBourrage(octets, tailleReelle) {
  if (!Number.isInteger(tailleReelle) || tailleReelle < 0 || tailleReelle > octets.length) return octets;
  return octets.slice(0, tailleReelle);
}
