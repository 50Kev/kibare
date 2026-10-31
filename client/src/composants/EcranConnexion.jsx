import { useEffect, useState } from "react";
import { KeyRound, Lock, UserCheck, Server, LogIn, Smartphone } from "lucide-react";
import { useLangue } from "../i18n/langue.jsx";
import {
  methodesDisponibles,
  connexionMotDePasse,
  adresseSso,
  messageErreur,
} from "../matrix/connexion.js";
import BandeFaso from "./BandeFaso.jsx";
import Embleme from "./Embleme.jsx";
import Illustration from "./Illustration.jsx";
import SelecteurLangue from "./SelecteurLangue.jsx";

export default function EcranConnexion({ erreurInitiale, onConnecte }) {
  const { t } = useLangue();
  const [methodes, setMethodes] = useState(null);
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(erreurInitiale);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    methodesDisponibles()
      .then(setMethodes)
      .catch((err) => {
        setErreur(messageErreur(err));
        setMethodes({ motDePasse: false, sso: false });
      });
  }, []);

  async function valider(e) {
    e.preventDefault();
    setErreur(null);
    setOccupe(true);
    try {
      const session = await connexionMotDePasse(identifiant, motDePasse);
      setMotDePasse("");
      await onConnecte(session);
    } catch (err) {
      setErreur(messageErreur(err));
      setOccupe(false);
    }
  }

  const aucune = methodes && !methodes.sso && !methodes.motDePasse;

  return (
    <div className="connexion">
      <section className="connexion-vitrine">
        <BandeFaso epaisseur={14} />
        <div className="vitrine-contenu">
          <div className="marque">
            <Embleme taille={52} />
            <div>
              <strong>{t("app_nom")}</strong>
              <span>{t("app_devise")}</span>
            </div>
          </div>
          <Illustration />
          <h1>{t("accueil_titre")}</h1>
          <p>{t("accueil_texte")}</p>
          <ul className="atouts">
            <li><Lock size={18} />{t("accueil_point_1")}</li>
            <li><UserCheck size={18} />{t("accueil_point_2")}</li>
            <li><Server size={18} />{t("accueil_point_3")}</li>
          </ul>
        </div>
      </section>

      <section className="connexion-formulaire">
        <div className="formulaire-haut">
          <SelecteurLangue />
        </div>
        <div className="formulaire-carte">
          <BandeFaso epaisseur={8} />
          <h2>{t("connexion_titre")}</h2>

          {erreur && <p className="alerte" role="alert">{t(erreur)}</p>}
          {aucune && !erreur && <p className="alerte">{t("connexion_aucune_methode")}</p>}

          {methodes?.sso && (
            <>
              <a className="bouton bouton-plein bouton-large" href={adresseSso()}>
                <KeyRound size={18} />
                {t("connexion_sso")}
              </a>
              <p className="aide">{t("connexion_sso_aide")}</p>
            </>
          )}

          {methodes?.sso && methodes?.motDePasse && <div className="separateur"><span>{t("connexion_ou")}</span></div>}

          {methodes?.motDePasse && (
            <form onSubmit={valider} className="champs">
              <label>
                {t("connexion_identifiant")}
                <input
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                {t("connexion_mdp")}
                <input
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="bouton bouton-vert bouton-large" disabled={occupe}>
                <LogIn size={18} />
                {occupe ? t("connexion_en_cours") : t("connexion_valider")}
              </button>
            </form>
          )}

          <div className="etapes">
            <h3>{t("etapes_titre")}</h3>
            <ol>
              <li><span className="etape-icone"><UserCheck size={18} /></span>{t("etape_1")}</li>
              <li><span className="etape-icone"><Smartphone size={18} /></span>{t("etape_2")}</li>
              <li><span className="etape-icone"><KeyRound size={18} /></span>{t("etape_3")}</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
