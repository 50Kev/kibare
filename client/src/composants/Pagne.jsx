// chaque groupe recoit son propre motif tisse, tire de son nom : on reconnait un groupe d'un coup d'oeil
const TISSAGES = [
  ["#D62631", "#F6C21C", "#0E6B43"],
  ["#2B3A8C", "#FFFFFF", "#C9731E"],
  ["#0E6B43", "#F6C21C", "#0A2E1F"],
  ["#C9731E", "#0A2E1F", "#F6C21C"],
  ["#D62631", "#0A2E1F", "#FFFFFF"],
  ["#2B3A8C", "#F6C21C", "#D62631"],
];
const PERSONNES = ["#D62631", "#0E6B43", "#2B3A8C", "#C9731E", "#7A2E8C", "#0F7C8C"];

export function empreinte(texte = "") {
  let h = 0;
  for (const c of texte) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return h;
}

export function couleurPersonne(id) {
  return PERSONNES[empreinte(id) % PERSONNES.length];
}

export function initiales(nom = "") {
  return nom
    .replace(/^[@#!]/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");
}

export function motif(nom) {
  const h = empreinte(nom);
  const [a, b, c] = TISSAGES[h % TISSAGES.length];
  const large = 5 + (h % 4);
  const fin = 2 + ((h >> 3) % 2);
  const bandes = `repeating-linear-gradient(90deg, ${a} 0 ${large}px, ${b} ${large}px ${large + fin}px, ${c} ${large + fin}px ${2 * large + fin}px, ${b} ${2 * large + fin}px ${2 * large + 2 * fin}px)`;
  const trame = "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px)";
  return `${trame}, ${bandes}`;
}

export default function Pagne({ nom, taille = 44, rond = false }) {
  return (
    <span className={rond ? "pagne rond" : "pagne"} style={{ width: taille, height: taille, backgroundImage: motif(nom) }} aria-hidden="true">
      <span className="pagne-lettres" style={{ fontSize: taille * 0.34 }}>{initiales(nom)}</span>
    </span>
  );
}

export function Visage({ id, nom, taille = 32 }) {
  return (
    <span className="visage" style={{ width: taille, height: taille, background: couleurPersonne(id), fontSize: taille * 0.4 }} aria-hidden="true">
      {initiales(nom || id)}
    </span>
  );
}
