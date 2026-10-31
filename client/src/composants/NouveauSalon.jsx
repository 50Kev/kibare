import { useState } from "react";
import { useLangue } from "../i18n/langue.jsx";
import { creerSalon } from "../matrix/salons.js";
import { messageErreur } from "../matrix/connexion.js";
import Fenetre from "./Fenetre.jsx";

export default function NouveauSalon({ client, onFermer, onCree }) {
  const { t } = useLangue();
  const [nom, setNom] = useState("");
  const [invites, setInvites] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function valider(e) {
    e.preventDefault();
    setOccupe(true);
    setErreur(null);
    try {
      const id = await creerSalon(client, nom, invites);
      onCree(id);
    } catch (err) {
      setErreur(messageErreur(err));
      setOccupe(false);
    }
  }

  return (
    <Fenetre titre={t("nouveau_titre")} onFermer={onFermer}>
      <form className="champs" onSubmit={valider}>
        {erreur && <p className="alerte">{t(erreur)}</p>}
        <label>
          {t("nouveau_nom")}
          <input value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus />
        </label>
        <label>
          {t("nouveau_invites")}
          <input value={invites} onChange={(e) => setInvites(e.target.value)} placeholder="agent2, agent3" />
          <small>{t("nouveau_invites_aide")}</small>
        </label>
        <div className="actions">
          <button type="button" className="bouton" onClick={onFermer}>{t("annuler")}</button>
          <button className="bouton bouton-vert" disabled={occupe}>{t("nouveau_creer")}</button>
        </div>
      </form>
    </Fenetre>
  );
}
