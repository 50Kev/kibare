import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal, MessageSquare, ShieldHalf, ShieldAlert, ChevronUp } from "lucide-react";
import { useLangue } from "../i18n/langue.jsx";
import { DUREES, NIVEAUX } from "../matrix/classification.js";
import { envoyerTexte } from "../matrix/messages.js";
import { envoyerFichier } from "../matrix/fichiers.js";

const ICONES = { normal: MessageSquare, restreint: ShieldHalf, confidentiel: ShieldAlert };

export default function Composeur({ client, salonId }) {
  const { t } = useLangue();
  const [texte, setTexte] = useState("");
  const [niveau, setNiveau] = useState("normal");
  const [duree, setDuree] = useState(DUREES[1].ms);
  const [menu, setMenu] = useState(false);
  const [erreur, setErreur] = useState(null);
  const champFichier = useRef(null);
  const zone = useRef(null);
  const Icone = ICONES[niveau];
  const dureeChoisie = niveau === "normal" ? undefined : duree;

  useEffect(() => {
    if (!menu) return;
    const fermer = (e) => !zone.current?.contains(e.target) && setMenu(false);
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [menu]);

  async function envoyer() {
    const propre = texte.trim();
    if (!propre) return;
    setTexte("");
    setErreur(null);
    try {
      await envoyerTexte(client, salonId, propre, niveau, dureeChoisie);
    } catch {
      setErreur("message_echec");
    }
  }

  async function joindre(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErreur(null);
    try {
      await envoyerFichier(client, salonId, fichier, niveau, dureeChoisie);
    } catch (err) {
      setErreur(err.message === "fichier_trop_lourd" ? "fichier_trop_lourd" : "message_echec");
    }
  }

  function touche(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      envoyer();
    }
  }

  return (
    <div className={`composeur composeur-${niveau}`}>
      {niveau !== "normal" && (
        <div className={`regles regles-${niveau}`}>
          <Icone size={16} />
          <span>{t(`regles_${niveau}`)}</span>
          <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} aria-label={t("composer_duree")}>
            {DUREES.map((d) => (
              <option key={d.ms} value={d.ms}>{t(d.cle)}</option>
            ))}
          </select>
        </div>
      )}
      {erreur && <p className="alerte petite">{t(erreur)}</p>}

      <div className="saisie">
        <div className="niveau-zone" ref={zone}>
          <button
            type="button"
            className={`choix-niveau choix-${niveau}`}
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            title={t("niveau_menu_titre")}
          >
            <Icone size={18} />
            <span className="choix-texte">{t(`niveau_court_${niveau}`)}</span>
            <ChevronUp size={14} className="choix-fleche" />
          </button>
          {menu && (
            <div className="menu-niveaux" role="menu">
              <p>{t("niveau_menu_titre")}</p>
              {Object.keys(NIVEAUX).map((n) => {
                const I = ICONES[n];
                return (
                  <button
                    key={n}
                    role="menuitemradio"
                    aria-checked={n === niveau}
                    className={`niveau-btn-${n}${n === niveau ? " choisi" : ""}`}
                    onClick={() => {
                      setNiveau(n);
                      setMenu(false);
                    }}
                  >
                    <span className="niveau-pastille"><I size={18} /></span>
                    <span>
                      <strong>{t(`niveau_${n}`)}</strong>
                      <small>{t(`niveau_aide_${n}`)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="champ-saisie">
          <textarea
            rows={1}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={touche}
            placeholder={t("composer_placeholder")}
          />
          <button className="joindre" type="button" title={t("composer_joindre")} onClick={() => champFichier.current?.click()}>
            <Paperclip size={20} />
          </button>
          <input ref={champFichier} type="file" hidden onChange={joindre} />
        </div>
        <button className="bouton-envoi" type="button" onClick={envoyer} title={t("composer_envoyer")} disabled={!texte.trim()}>
          <SendHorizontal size={21} />
        </button>
      </div>
    </div>
  );
}
