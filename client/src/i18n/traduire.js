export function traduire(dictionnaires, langue, cle, valeurs = {}) {
  const texte = dictionnaires[langue]?.[cle] || dictionnaires.fr?.[cle] || cle;
  return texte.replace(/\{(\w+)\}/g, (_, nom) => String(valeurs[nom] ?? ""));
}
