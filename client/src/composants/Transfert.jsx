import { useState } from "react";
import { useLangue } from "../i18n/langue.jsx";
import { transferer } from "../matrix/messages.js";
import { libelleSalon } from "../matrix/salons.js";
import Fenetre from "./Fenetre.jsx";

export default function Transfert({ client, evenement, salons, onFermer }) {
  const { t } = useLangue();
  const [erreur, setErreur] = useState(null);

  async function envoyerVers(salonId) {
    try {
      await transferer(client, evenement, salonId);
      onFermer();
    } catch (err) {
      setErreur(err.message === "transfert_interdit" ? "transfert_interdit" : "erreur_inconnue");
    }
  }

  return (
    <Fenetre titre={t("transfert_titre")} onFermer={onFermer}>
      {erreur && <p className="alerte">{t(erreur)}</p>}
      <div className="liste-cibles">
        {salons.map((s) => (
          <button key={s.roomId} className="salon" onClick={() => envoyerVers(s.roomId)}>
            <strong>{libelleSalon(s, t)}</strong>
          </button>
        ))}
      </div>
    </Fenetre>
  );
}
