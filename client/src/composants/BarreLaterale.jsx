import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, EllipsisVertical, Search, Check, X, Lock, LogOut, Siren, ShieldAlert, Plus } from "lucide-react";
import { EventType } from "matrix-js-sdk";
import { useLangue, LANGUES } from "../i18n/langue.jsx";
import { accepter, refuser, libelleSalon } from "../matrix/salons.js";
import { lireNiveau, estExpire } from "../matrix/classification.js";
import { compterNonLus } from "../matrix/lus.js";
import BandeFaso from "./BandeFaso.jsx";
import Pagne, { Visage } from "./Pagne.jsx";

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

function quand(d) {
  if (!d) return "";
  return d.toDateString() === new Date().toDateString() ? heure.format(d) : date.format(d);
}

function sansAccents(texte) {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function inviteur(salon, moi) {
  return salon.getMember(moi)?.events?.member?.getSender() || "";
}

function resume(salon, t, moi) {
  const messages = salon.timeline.filter(
    (ev) => (ev.getType() === EventType.RoomMessage || ev.isDecryptionFailure()) && !ev.isRedacted(),
  );
  const dernier = messages[messages.length - 1];
  if (!dernier) return { texte: "" };
  const mien = dernier.getSender() === moi;
  const base = { date: dernier.getDate(), mien };
  if (dernier.isDecryptionFailure()) return { ...base, texte: t("apercu_illisible") };
  const contenu = dernier.getContent();
  if (estExpire(contenu)) return { ...base, texte: "" };
  const niveau = lireNiveau(contenu);
  // jamais le texte d'un message classifie dans la liste
  if (niveau !== "normal") return { ...base, texte: t(`niveau_${niveau}`), niveau };
  return { ...base, texte: contenu?.body || "" };
}

function MenuPrincipal({ onNouveau, onVerrouiller, onQuitter }) {
  const { t, langue, changer } = useLangue();
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => !zone.current?.contains(e.target) && setOuvert(false);
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [ouvert]);

  const action = (f) => () => {
    setOuvert(false);
    f();
  };

  return (
    <div className="menu-zone" ref={zone}>
      <button className="icone-bouton clair" title={t("menu")} onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <EllipsisVertical size={20} />
      </button>
      {ouvert && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={action(onNouveau)}><MessageSquarePlus size={18} />{t("salons_nouveau")}</button>
          <button role="menuitem" onClick={action(onVerrouiller)}><Lock size={18} />{t("verrouiller")}</button>
          <div className="menu-langues">
            {LANGUES.map((l) => (
              <button key={l.code} className={l.code === langue ? "choisie" : ""} onClick={() => changer(l.code)}>{l.nom}</button>
            ))}
          </div>
          <button role="menuitem" onClick={action(onQuitter)}><LogOut size={18} />{t("deconnexion")}</button>
          <button role="menuitem" className="menu-danger" onClick={action(() => window.confirm(t("urgence_confirmer")) && onQuitter())}>
            <Siren size={18} />{t("urgence")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BarreLaterale({ client, salons, invitations, actif, onChoisir, onNouveau, onQuitter, onVerrouiller }) {
  const { t } = useLangue();
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const moi = client.getUserId();
  const monNom = client.getUser(moi)?.displayName || moi;

  const lignes = salons
    .map((s) => ({ salon: s, nom: libelleSalon(s, t), r: resume(s, t, moi), nonLus: s.roomId === actif ? 0 : compterNonLus(s, moi) }))
    .filter((l) => !recherche || sansAccents(l.nom).includes(sansAccents(recherche)))
    .filter((l) => filtre === "tous" || (filtre === "non_lus" ? l.nonLus > 0 : Boolean(l.r.niveau)));

  return (
    <aside className="barre">
      <header className="barre-entete">
        <Visage id={moi} nom={monNom} taille={40} />
        <div className="barre-titre">
          <strong>{t("app_nom")}</strong>
          <small>{monNom}</small>
        </div>
        <button className="icone-bouton clair bureau" title={t("salons_nouveau")} onClick={onNouveau}>
          <MessageSquarePlus size={20} />
        </button>
        <MenuPrincipal onNouveau={onNouveau} onVerrouiller={onVerrouiller} onQuitter={onQuitter} />
      </header>
      <BandeFaso epaisseur={6} />

      <div className="recherche">
        <Search size={17} />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("recherche")} />
      </div>
      <div className="filtres">
        {["tous", "non_lus", "classifies"].map((f) => (
          <button key={f} className={f === filtre ? "filtre choisi" : "filtre"} onClick={() => setFiltre(f)}>
            {t(`filtre_${f}`)}
          </button>
        ))}
      </div>

      <div className="liste">
        {invitations.map((s) => (
          <div key={s.roomId} className="invitation">
            <Visage id={inviteur(s, moi)} taille={46} />
            <span className="invitation-texte">{t("invitation_de", { agent: inviteur(s, moi) })}</span>
            <button className="icone-bouton ok" title={t("invitation_accepter")} onClick={() => accepter(client, s.roomId)}><Check size={18} /></button>
            <button className="icone-bouton non" title={t("invitation_refuser")} onClick={() => refuser(client, s.roomId)}><X size={18} /></button>
          </div>
        ))}

        {salons.length === 0 && (
          <button className="liste-vide" onClick={onNouveau}>
            <MessageSquarePlus size={20} />
            {t("salons_vide")}
          </button>
        )}
        {salons.length > 0 && lignes.length === 0 && <p className="aucun">{t("aucun_resultat")}</p>}

        {lignes.map(({ salon: s, nom, r, nonLus }) => (
          <button key={s.roomId} className={s.roomId === actif ? "discussion active" : "discussion"} onClick={() => onChoisir(s.roomId)}>
            <Pagne nom={nom} taille={50} rond />
            <span className="discussion-corps">
              <span className="discussion-ligne">
                <strong>{nom}</strong>
                <time className={nonLus ? "frais" : ""}>{quand(r.date)}</time>
              </span>
              <span className="discussion-ligne">
                <small className={r.niveau ? `apercu apercu-${r.niveau}` : "apercu"}>
                  {r.mien && !r.niveau && <Check size={15} className="coche" />}
                  {r.niveau && <ShieldAlert size={14} />}
                  {r.texte}
                </small>
                {nonLus > 0 && <span className="pastille-non-lus">{nonLus}</span>}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button className="fab" onClick={onNouveau} title={t("salons_nouveau")}>
        <Plus size={26} />
      </button>
    </aside>
  );
}
