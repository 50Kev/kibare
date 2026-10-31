import { Forward, Clock, ShieldAlert, AlertTriangle, Check, CircleAlert } from "lucide-react";
import { MsgType } from "matrix-js-sdk";
import { useLangue } from "../i18n/langue.jsx";
import { lireNiveau, regles, estExpire, tempsRestant } from "../matrix/classification.js";
import Tampon from "./Tampon.jsx";
import Filigrane from "./Filigrane.jsx";
import PieceJointe from "./PieceJointe.jsx";
import { Visage, couleurPersonne } from "./Pagne.jsx";

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function duree(ms) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `${heures} h`;
  return `${Math.round(heures / 24)} j`;
}

const FICHIERS = [MsgType.File, MsgType.Image, MsgType.Audio, MsgType.Video];

export default function Bulle({ client, ev, auteur, moi, suite, maintenant, masquer, onTransferer }) {
  const { t } = useLangue();
  const mien = ev.getSender() === moi;
  const classes = ["ligne", mien ? "mienne" : "", suite ? "suite" : ""].join(" ");
  const visage = !mien && (suite ? <span className="visage-vide" /> : <Visage id={ev.getSender()} nom={auteur} taille={30} />);

  if (ev.isDecryptionFailure()) {
    return (
      <div className={classes}>
        {visage}
        <div className="bulle bulle-illisible">
          <AlertTriangle size={16} />
          <span>{t("message_illisible")}</span>
        </div>
      </div>
    );
  }

  const contenu = ev.getContent();
  if (estExpire(contenu, maintenant)) return null;

  const niveau = lireNiveau(contenu);
  const regle = regles(contenu);
  const reste = tempsRestant(contenu, maintenant);
  const statut = ev.status;
  const flou = masquer && regle.filigrane;

  const bloquerCopie = (e) => {
    if (!regle.copie) {
      e.preventDefault();
      alert(t("copie_interdite"));
    }
  };

  return (
    <div className={classes}>
      {visage}
      <article
        className={`bulle niveau-${niveau}${regle.copie ? "" : " sans-copie"}${flou ? " floute" : ""}`}
        title={flou ? t("masque_hors_fenetre") : undefined}
        onCopy={bloquerCopie}
        onCut={bloquerCopie}
        onContextMenu={regle.copie ? undefined : (e) => e.preventDefault()}
      >
        {regle.filigrane && <Filigrane agent={moi} />}
        {(niveau !== "normal" || (!mien && !suite)) && (
          <header>
            {!mien && !suite && <strong className="auteur" style={{ color: couleurPersonne(ev.getSender()) }}>{auteur}</strong>}
            <Tampon niveau={niveau} />
          </header>
        )}

        {FICHIERS.includes(contenu.msgtype) ? (
          <PieceJointe client={client} contenu={contenu} />
        ) : (
          <p className="texte">{contenu.body}</p>
        )}

        <footer>
          {reste !== null && (
            <span className="compte-a-rebours">
              <Clock size={12} />
              {t("message_expire_dans", { temps: duree(reste) })}
            </span>
          )}
          {statut === "sending" || statut === "encrypting" ? (
            <span>{t("message_envoi")}</span>
          ) : statut === "not_sent" ? (
            <span className="echec"><CircleAlert size={12} />{t("message_echec")}</span>
          ) : (
            <time>{heure.format(ev.getDate() || new Date())}</time>
          )}
          {mien && !statut && <Check size={13} className="envoye" />}
          {regle.transfert ? (
            <button className="mini" onClick={() => onTransferer(ev)} title={t("message_transferer")}>
              <Forward size={14} />
            </button>
          ) : (
            <span className="cadenas" title={t("transfert_interdit")}><ShieldAlert size={14} /></span>
          )}
        </footer>
      </article>
    </div>
  );
}
