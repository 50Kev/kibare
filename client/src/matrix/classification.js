export const CHAMP = "bf.gov.classification";

const HEURE = 3600 * 1000;

export const NIVEAUX = {
  normal: { transfert: true, copie: true, filigrane: false, duree: null },
  restreint: { transfert: false, copie: true, filigrane: true, duree: 7 * 24 * HEURE },
  confidentiel: { transfert: false, copie: false, filigrane: true, duree: 24 * HEURE },
};

export const DUREES = [
  { cle: "duree_1h", ms: HEURE },
  { cle: "duree_24h", ms: 24 * HEURE },
  { cle: "duree_7j", ms: 7 * 24 * HEURE },
];

export function etiqueter(contenu, niveau, maintenant = Date.now(), duree) {
  const regle = NIVEAUX[niveau];
  if (!regle) throw new Error(`niveau inconnu : ${niveau}`);
  if (niveau === "normal") return contenu;
  const d = duree ?? regle.duree;
  return {
    ...contenu,
    [CHAMP]: { niveau, expire_a: d ? maintenant + d : null },
  };
}

// un niveau qu'on ne connait pas est traite comme le plus strict,
// sinon un client modifie pourrait faire sauter les regles
export function lireNiveau(contenu) {
  const etiquette = contenu?.[CHAMP];
  if (etiquette === undefined) return "normal";
  return NIVEAUX[etiquette?.niveau] ? etiquette.niveau : "confidentiel";
}

export function regles(contenu) {
  return NIVEAUX[lireNiveau(contenu)];
}

export function estExpire(contenu, maintenant = Date.now()) {
  const fin = contenu?.[CHAMP]?.expire_a;
  return typeof fin === "number" && maintenant >= fin;
}

export function tempsRestant(contenu, maintenant = Date.now()) {
  const fin = contenu?.[CHAMP]?.expire_a;
  if (typeof fin !== "number") return null;
  return Math.max(0, fin - maintenant);
}
