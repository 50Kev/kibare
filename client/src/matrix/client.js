import { createClient, ClientEvent, HttpApiEvent, SyncState } from "matrix-js-sdk";
import { PREFIXE_CRYPTO } from "../config.js";
import { effacerSession } from "./session.js";
import { exigerServeurSur } from "./securite.js";
import {
  rappelsCoffre,
  verifierPhrase,
  preparerIdentite,
  memoriserAppareil,
  oublierAppareil,
} from "./identite.js";

let client = null;
let sessionActive = null;
let departVolontaire = false;

// une base de cles par agent et par appareil, rien n'est jamais partage
export function prefixePour(session) {
  return `${PREFIXE_CRYPTO}-${`${session.userId}-${session.deviceId}`.replace(/[^a-z0-9]/gi, "_")}`;
}

export function clientActuel() {
  return client;
}

function attendreSynchro(c) {
  return new Promise((resolve, reject) => {
    const suivre = (etat, _avant, donnees) => {
      if (etat === SyncState.Prepared || etat === SyncState.Syncing) {
        c.off(ClientEvent.Sync, suivre);
        resolve();
      } else if (etat === SyncState.Error && donnees?.error?.errcode) {
        c.off(ClientEvent.Sync, suivre);
        reject(donnees.error);
      }
    };
    c.on(ClientEvent.Sync, suivre);
    c.startClient({ initialSyncLimit: 40, lazyLoadMembers: true, disablePresence: true });
  });
}

export async function demarrer(session, phrase, mode, { quandRevoque }) {
  exigerServeurSur(session.baseUrl);
  const coffre = rappelsCoffre();
  coffre.retenir(phrase);

  const c = createClient({
    baseUrl: session.baseUrl,
    userId: session.userId,
    deviceId: session.deviceId,
    accessToken: session.accessToken,
    cryptoCallbacks: coffre.callbacks,
  });

  // sur un nouvel appareil on teste la phrase avant de creer quoi que ce soit
  if (mode === "deverrouiller") await verifierPhrase(c, phrase);

  try {
    // la phrase chiffre aussi la base de cles locale : sans elle, un telephone vole ne donne rien
    await c.initRustCrypto({ cryptoDatabasePrefix: prefixePour(session), storagePassword: phrase });
  } catch (err) {
    if (mode === "ouvrir") throw new Error("phrase_incorrecte");
    throw err;
  }

  let dejaRevoque = false;
  c.on(HttpApiEvent.SessionLoggedOut, async (err) => {
    if (departVolontaire || dejaRevoque) return;
    dejaRevoque = true;
    await nettoyer(c, session);
    quandRevoque(err);
  });

  client = c;
  sessionActive = session;

  try {
    await attendreSynchro(c);
    await preparerIdentite(c, phrase, mode);
  } catch (err) {
    c.stopClient();
    client = null;
    throw err;
  } finally {
    coffre.oublier();
  }

  memoriserAppareil(session);
  return c;
}

async function nettoyer(c, s) {
  if (client === c) {
    client = null;
    sessionActive = null;
  }
  if (!c || !s) return;
  c.stopClient();
  try {
    await c.clearStores({ cryptoDatabasePrefix: prefixePour(s) });
  } catch (e) {
    console.warn("nettoyage incomplet", e);
  }
  oublierAppareil(s);
  effacerSession();
}

// utilise quand l'appareil n'a pas pu demarrer : session refusee ou trop d'echecs de phrase
export async function effacerAppareil(session) {
  const c = createClient({ baseUrl: session.baseUrl });
  try {
    await c.clearStores({ cryptoDatabasePrefix: prefixePour(session) });
  } catch (e) {
    console.warn("effacement incomplet", e);
  }
  oublierAppareil(session);
  effacerSession();
}

export function verrouiller() {
  client?.stopClient();
  client = null;
  sessionActive = null;
}

export async function seDeconnecter() {
  if (!client) return;
  departVolontaire = true;
  try {
    await client.logout(true);
  } catch {
    // si le serveur ne repond pas on efface quand meme en local
  }
  await nettoyer(client, sessionActive);
  departVolontaire = false;
}
