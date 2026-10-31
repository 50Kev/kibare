import { ShieldOff } from "lucide-react";
import { useLangue } from "../i18n/langue.jsx";
import BandeFaso from "./BandeFaso.jsx";

export default function EcranRevoque({ onRetour }) {
  const { t } = useLangue();
  return (
    <div className="plein-ecran revoque">
      <BandeFaso epaisseur={12} />
      <div className="revoque-carte">
        <div className="revoque-icone"><ShieldOff size={40} /></div>
        <h1>{t("revoque_titre")}</h1>
        <p>{t("revoque_texte")}</p>
        <button className="bouton bouton-plein" onClick={onRetour}>{t("revoque_retour")}</button>
      </div>
    </div>
  );
}
