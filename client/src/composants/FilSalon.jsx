import { useEffect, useRef } from "react";
import { ArrowLeft, UserPlus, Lock, LockOpen, MessageSquarePlus } from "lucide-react";
import { useLangue } from "../i18n/langue.jsx";
import { useFil } from "../crochets/useFil.js";
import { useFenetreActive } from "../crochets/useFenetreActive.js";
import { estChiffre, libelleSalon } from "../matrix/salons.js";
import { marquerLu } from "../matrix/lus.js";
import Bulle from "./Bulle.jsx";
import Composeur from "./Composeur.jsx";
import Illustration from "./Illustration.jsx";
import BandeFaso from "./BandeFaso.jsx";
import Pagne from "./Pagne.jsx";

const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const CINQ_MINUTES = 5 * 60 * 1000;

function libelleJour(date, t) {
  const auj = new Date();
  const hier = new Date(auj.getTime() - 86400000);
  if (date.toDateString() === auj.toDateString()) return t("jour_aujourdhui");
  if (date.toDateString() === hier.toDateString()) return t("jour_hier");
  return jour.format(date);
}

function membres(salon, moi, t) {
  const noms = salon.getJoinedMembers().filter((m) => m.userId !== moi).map((m) => m.name);
  return [...noms.slice(0, 4), t("vous")].join(", ");
}

export default function FilSalon({ client, salon, onRetour, onInviter, onTransferer, onNouveau }) {
  const { t } = useLangue();
  const { evenements, maintenant } = useFil(client, salon);
  const active = useFenetreActive();
  const bas = useRef(null);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
    // ouvrir la conversation vaut lecture, compte seulement sur cet appareil
    if (salon && active) {
      const dernier = evenements[evenements.length - 1];
      marquerLu(salon.roomId, Math.max(Date.now(), dernier?.getTs() || 0));
    }
  }, [evenements.length, salon?.roomId, active]);

  if (!salon) {
    return (
      <main className="fil fil-accueil">
        <div className="accueil-bureau">
          <Illustration />
          <h2>{t("accueil_bureau_titre")}</h2>
          <p>{t("accueil_bureau_texte")}</p>
          <button className="bouton bouton-vert" onClick={onNouveau}>
            <MessageSquarePlus size={18} />
            {t("salons_nouveau")}
          </button>
        </div>
        <p className="accueil-pied"><Lock size={14} />{t("accueil_bureau_pied")}</p>
        <BandeFaso epaisseur={8} />
      </main>
    );
  }

  const chiffre = estChiffre(client, salon);
  const moi = client.getUserId();
  const nom = libelleSalon(salon, t);
  let jourPrecedent = null;

  return (
    <main className="fil">
      <header className="fil-entete">
        <button className="icone-bouton clair retour" onClick={onRetour} aria-label="Retour">
          <ArrowLeft size={22} />
        </button>
        <Pagne nom={nom} taille={42} rond />
        <div className="fil-titre">
          <h2>{nom}</h2>
          <small>{membres(salon, moi, t)}</small>
        </div>
        <span className={chiffre ? "etat-chiffre" : "etat-chiffre non"} title={chiffre ? t("fil_chiffre") : t("fil_non_chiffre")}>
          {chiffre ? <Lock size={18} /> : <LockOpen size={18} />}
        </span>
        <button className="icone-bouton clair" onClick={onInviter} title={t("fil_inviter")}>
          <UserPlus size={21} />
        </button>
      </header>

      <div className="fil-messages">
        <div className="notice-chiffrement">
          <Lock size={13} />
          <p>{t("fil_notice")}</p>
        </div>
        {evenements.map((ev, i) => {
          const date = ev.getDate() || new Date();
          const cleJour = date.toDateString();
          const separateur = cleJour !== jourPrecedent;
          jourPrecedent = cleJour;
          const avant = evenements[i - 1];
          const suite = !separateur && avant && avant.getSender() === ev.getSender() && date - (avant.getDate() || 0) < CINQ_MINUTES;
          return (
            <div key={ev.getId() || ev.getTxnId()}>
              {separateur && <div className="separateur-jour"><span>{libelleJour(date, t)}</span></div>}
              <Bulle
                client={client}
                ev={ev}
                auteur={salon.getMember(ev.getSender())?.name || ev.getSender()}
                moi={moi}
                suite={suite}
                maintenant={maintenant}
                masquer={!active}
                onTransferer={onTransferer}
              />
            </div>
          );
        })}
        <div ref={bas} />
      </div>

      <Composeur client={client} salonId={salon.roomId} />
    </main>
  );
}
