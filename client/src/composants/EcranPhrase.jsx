import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useLangue } from "../i18n/langue.jsx";
import { modePhrase, LONGUEUR_MIN, ECHECS_MAX } from "../matrix/identite.js";
import { messageErreur } from "../matrix/connexion.js";
import BandeFaso from "./BandeFaso.jsx";
import SelecteurLangue from "./SelecteurLangue.jsx";

export default function EcranPhrase({ session, erreurInitiale, echecs = 0, note, onValider, onAutreCompte }) {
  const { t } = useLangue();
  const [mode, setMode] = useState(null);
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState(erreurInitiale);

  useEffect(() => {
    modePhrase(session)
      .then(setMode)
      .catch((err) => onAutreCompte(messageErreur(err), err));
  }, [session]);

  function valider(e) {
    e.preventDefault();
    if (mode === "creer") {
      if (phrase.length < LONGUEUR_MIN) return setErreur("phrase_trop_courte");
      if (phrase !== confirmation) return setErreur("phrase_differente");
    }
    const p = phrase;
    setPhrase("");
    setConfirmation("");
    onValider(p, mode);
  }

  return (
    <div className="plein-ecran verrou">
      <BandeFaso epaisseur={12} />
      <div className="formulaire-haut verrou-haut"><SelecteurLangue clair /></div>
      <div className="formulaire-carte verrou-carte">
        <BandeFaso epaisseur={8} />
        <div className="verrou-entete">
          <svg className="cle-illustration" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="56" fill="#E3EFE6" />
            <path d="M60 22l30 11v22c0 20-13 34-30 41-17-7-30-21-30-41V33z" fill="#0E6B43" />
            <circle cx="60" cy="54" r="11" fill="#F6C21C" />
            <rect x="56" y="62" width="8" height="20" rx="3" fill="#F6C21C" />
            <rect x="60" y="72" width="9" height="5" rx="2" fill="#F6C21C" />
            <circle cx="60" cy="54" r="4" fill="#0E6B43" />
          </svg>
          <div>
            <span className="etape-badge">{t("phrase_etape")}</span>
            <span className="badge badge-vert"><ShieldCheck size={13} />{session.userId}</span>
          </div>
        </div>
        {mode && (
          <>
            <h2>{t(`phrase_titre_${mode}`)}</h2>
            <p className="aide">{t(`phrase_texte_${mode}`)}</p>
            {note && <p className="alerte alerte-info">{t(note)}</p>}
            {erreur && <p className="alerte" role="alert">{t(erreur, { n: LONGUEUR_MIN })}</p>}
            {echecs > 0 && mode !== "creer" && (
              <p className="aide">{t("phrase_essais", { n: Math.max(0, ECHECS_MAX - echecs) })}</p>
            )}
            <form className="champs" onSubmit={valider}>
              <label>
                {t("phrase_champ")}
                <input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" autoFocus required />
                {mode === "creer" && <small>{t("phrase_aide", { n: LONGUEUR_MIN })}</small>}
              </label>
              {mode === "creer" && (
                <label>
                  {t("phrase_confirmer")}
                  <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" required />
                </label>
              )}
              <button className="bouton bouton-vert bouton-large">
                <KeyRound size={18} />
                {t("phrase_valider")}
              </button>
            </form>
            <button className="lien" onClick={() => onAutreCompte(null)}>{t("phrase_changer_compte")}</button>
          </>
        )}
      </div>
    </div>
  );
}
