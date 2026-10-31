import { useEffect } from "react";
import { X } from "lucide-react";

export default function Fenetre({ titre, onFermer, children }) {
  useEffect(() => {
    const echap = (e) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="fenetre" role="dialog" aria-modal="true" aria-label={titre}>
        <header>
          <h2>{titre}</h2>
          <button className="icone-bouton" onClick={onFermer} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
