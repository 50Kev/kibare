import { useEffect, useState } from "react";

// faux des que l'agent quitte la fenetre : changement d'onglet, outil de capture, autre application
export function useFenetreActive() {
  const [active, setActive] = useState(() => !document.hidden && document.hasFocus());

  useEffect(() => {
    const maj = () => setActive(!document.hidden && document.hasFocus());
    document.addEventListener("visibilitychange", maj);
    window.addEventListener("blur", maj);
    window.addEventListener("focus", maj);
    return () => {
      document.removeEventListener("visibilitychange", maj);
      window.removeEventListener("blur", maj);
      window.removeEventListener("focus", maj);
    };
  }, []);

  return active;
}
