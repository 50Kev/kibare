import { createContext, useContext, useState } from "react";
import fr from "./fr.json";
import mos from "./mos.json";
import dyu from "./dyu.json";
import { traduire } from "./traduire.js";

const dictionnaires = { fr, mos, dyu };

export const LANGUES = [
  { code: "fr", nom: "Français" },
  { code: "mos", nom: "Mooré (bêta)" },
  { code: "dyu", nom: "Dioula (bêta)" },
];

const Contexte = createContext(null);

export function FournisseurLangue({ children }) {
  const [langue, setLangue] = useState(() => localStorage.getItem("kibare.langue") || "fr");

  function changer(code) {
    localStorage.setItem("kibare.langue", code);
    setLangue(code);
  }

  const t = (cle, valeurs) => traduire(dictionnaires, langue, cle, valeurs);

  return <Contexte.Provider value={{ langue, changer, t }}>{children}</Contexte.Provider>;
}

export function useLangue() {
  return useContext(Contexte);
}
