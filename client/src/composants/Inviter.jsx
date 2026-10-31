import { useState } from "react";
import { useLangue } from "../i18n/langue.jsx";
import { inviter } from "../matrix/salons.js";
import { messageErreur } from "../matrix/connexion.js";
import Fenetre from "./Fenetre.jsx";

export default function Inviter({ client, salon, onFermer }) {
  const { t } = useLangue();
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState(null);

  async function valider(e) {
    e.preventDefault();
    setErreur(null);
    try {
      await inviter(client, salon.roomId, saisie);
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <Fenetre titre={t("inviter_titre")} onFermer={onFermer}>
      <form className="champs" onSubmit={valider}>
        {erreur && <p className="alerte">{t(erreur)}</p>}
        <label>
          {t("connexion_identifiant")}
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="agent3" required autoFocus />
        </label>
        <div className="actions">
          <button type="button" className="bouton" onClick={onFermer}>{t("annuler")}</button>
          <button className="bouton bouton-vert">{t("inviter_valider")}</button>
        </div>
      </form>
    </Fenetre>
  );
}
