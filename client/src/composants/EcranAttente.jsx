import { useLangue } from "../i18n/langue.jsx";
import Embleme from "./Embleme.jsx";
import BandeFaso from "./BandeFaso.jsx";

export default function EcranAttente() {
  const { t } = useLangue();
  return (
    <div className="plein-ecran attente">
      <BandeFaso epaisseur={12} />
      <div className="attente-centre">
        <div className="pulse"><Embleme taille={72} /></div>
        <p>{t("chargement")}</p>
        <small>{t("chargement_cles")}</small>
      </div>
    </div>
  );
}
