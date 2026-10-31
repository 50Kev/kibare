import { useEffect, useRef, useState } from "react";
import { demarrer, seDeconnecter, effacerAppareil, verrouiller } from "./matrix/client.js";
import { lireSession, sauverSession } from "./matrix/session.js";
import { jetonSsoRecu, terminerSso, messageErreur } from "./matrix/connexion.js";
import { noterEchec, ECHECS_MAX } from "./matrix/identite.js";
import EcranConnexion from "./composants/EcranConnexion.jsx";
import EcranPhrase from "./composants/EcranPhrase.jsx";
import EcranAttente from "./composants/EcranAttente.jsx";
import EcranRevoque from "./composants/EcranRevoque.jsx";
import Messagerie from "./composants/Messagerie.jsx";

export default function App() {
  const [ecran, setEcran] = useState("attente");
  const [session, setSession] = useState(null);
  const [client, setClient] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [note, setNote] = useState(null);
  const [echecs, setEchecs] = useState(0);
  const lance = useRef(false);

  function versPhrase(s, err = null, n = null) {
    setSession(s);
    setErreur(err);
    setNote(n);
    setEcran("phrase");
  }

  async function ouvrir(phrase, mode) {
    setEcran("attente");
    try {
      const c = await demarrer(session, phrase, mode, {
        quandRevoque: () => {
          setClient(null);
          setEcran("revoque");
        },
      });
      setEchecs(0);
      setClient(c);
      setEcran("messagerie");
    } catch (err) {
      const code = messageErreur(err);
      if (code === "phrase_incorrecte") {
        const n = noterEchec(session);
        setEchecs(n);
        if (n >= ECHECS_MAX) {
          await effacerAppareil(session);
          setErreur("erreur_trop_echecs");
          setEcran("connexion");
          return;
        }
        versPhrase(session, code);
        return;
      }
      if (code === "erreur_session") {
        await effacerAppareil(session);
        setEcran("revoque");
        return;
      }
      versPhrase(session, code);
    }
  }

  async function autreCompte(code, err) {
    if (err?.errcode === "M_UNKNOWN_TOKEN") {
      await effacerAppareil(session);
      setEcran("revoque");
      return;
    }
    if (!code) await seDeconnecterSession();
    setErreur(code);
    setEcran("connexion");
  }

  async function seDeconnecterSession() {
    if (session) await effacerAppareil(session);
  }

  async function quitter() {
    await seDeconnecter();
    setClient(null);
    setSession(null);
    setErreur(null);
    setEcran("connexion");
  }

  function verrouillerMaintenant(raison = null) {
    verrouiller();
    setClient(null);
    versPhrase(session, null, raison);
  }

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    const jeton = jetonSsoRecu();
    if (jeton) {
      terminerSso(jeton)
        .then((s) => {
          sauverSession(s);
          versPhrase(s);
        })
        .catch((err) => {
          setErreur(messageErreur(err));
          setEcran("connexion");
        });
      return;
    }
    const s = lireSession();
    if (s) versPhrase(s);
    else setEcran("connexion");
  }, []);

  if (ecran === "attente") return <EcranAttente />;
  if (ecran === "revoque") return <EcranRevoque onRetour={() => setEcran("connexion")} />;
  if (ecran === "phrase" && session) {
    return (
      <EcranPhrase
        key={`${session.deviceId}-${echecs}-${erreur}`}
        session={session}
        erreurInitiale={erreur}
        echecs={echecs}
        note={note}
        onValider={ouvrir}
        onAutreCompte={autreCompte}
      />
    );
  }
  if (ecran === "messagerie" && client) {
    return <Messagerie client={client} onQuitter={quitter} onVerrouiller={verrouillerMaintenant} />;
  }
  return (
    <EcranConnexion
      erreurInitiale={erreur}
      onConnecte={(s) => {
        sauverSession(s);
        versPhrase(s);
      }}
    />
  );
}
