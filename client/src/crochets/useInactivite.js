import { useEffect, useRef } from "react";

const EVENEMENTS = ["pointerdown", "keydown", "wheel", "touchstart"];

export function useInactivite(delai, quandInactif) {
  const rappel = useRef(quandInactif);
  rappel.current = quandInactif;

  useEffect(() => {
    let minuterie;
    const relancer = () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => rappel.current(), delai);
    };
    EVENEMENTS.forEach((e) => window.addEventListener(e, relancer, { passive: true }));
    relancer();
    return () => {
      clearTimeout(minuterie);
      EVENEMENTS.forEach((e) => window.removeEventListener(e, relancer));
    };
  }, [delai]);
}
