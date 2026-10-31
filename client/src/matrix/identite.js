import { createClient } from "matrix-js-sdk";
import { deriveRecoveryKeyFromPassphrase, OnlySignedDevicesIsolationMode } from "matrix-js-sdk/lib/crypto-api/index.js";

export const LONGUEUR_MIN = 10;
export const ECHECS_MAX = 5;

const cleAppareil = (s) => `kibare.appareil.${s.userId}.${s.deviceId}`;
const cleEchecs = (s) => `kibare.echecs.${s.userId}`;

export function appareilConnu(session) {
  return localStorage.getItem(cleAppareil(session)) === "1";
}

export function memoriserAppareil(session) {
  localStorage.setItem(cleAppareil(session), "1");
  localStorage.removeItem(cleEchecs(session));
}

export function oublierAppareil(session) {
  localStorage.removeItem(cleAppareil(session));
  localStorage.removeItem(cleEchecs(session));
}

export function noterEchec(session) {
  const n = Number(localStorage.getItem(cleEchecs(session)) || 0) + 1;
  localStorage.setItem(cleEchecs(session), String(n));
  return n;
}

// ouvrir : cet appareil a deja ses cles, la phrase les deverrouille
// deverrouiller : nouvel appareil, la phrase recupere l'identite depuis le coffre
// creer : premiere connexion de l'agent, il choisit sa phrase
export async function modePhrase(session) {
  if (appareilConnu(session)) return "ouvrir";
  const c = createClient({ baseUrl: session.baseUrl, userId: session.userId, accessToken: session.accessToken });
  const cle = await c.secretStorage.getDefaultKeyId();
  return cle ? "deverrouiller" : "creer";
}

async function cleDepuisPhrase(phrase, info) {
  const p = info?.passphrase;
  if (!p?.salt || !p?.iterations) return null;
  return deriveRecoveryKeyFromPassphrase(phrase, p.salt, p.iterations, p.bits);
}

export async function verifierPhrase(client, phrase) {
  const trouve = await client.secretStorage.getKey();
  if (!trouve) throw new Error("coffre_absent");
  const [, info] = trouve;
  const cle = await cleDepuisPhrase(phrase, info);
  if (!cle || !(await client.secretStorage.checkKey(cle, info))) throw new Error("phrase_incorrecte");
}

// le SDK nous demande la cle du coffre quand il en a besoin, on la tire de la phrase
export function rappelsCoffre() {
  const cles = new Map();
  let phrase = null;
  return {
    retenir(p) { phrase = p; },
    oublier() { phrase = null; cles.clear(); },
    callbacks: {
      cacheSecretStorageKey: (id, _info, cle) => cles.set(id, cle),
      getSecretStorageKey: async ({ keys }) => {
        for (const [id, info] of Object.entries(keys)) {
          if (cles.has(id)) return [id, cles.get(id)];
          if (!phrase) continue;
          const cle = await cleDepuisPhrase(phrase, info);
          if (cle) {
            cles.set(id, cle);
            return [id, cle];
          }
        }
        return null;
      },
    },
  };
}

export async function preparerIdentite(client, phrase, mode) {
  const crypto = client.getCrypto();

  // les cles d'un salon ne partent que vers des appareils signes par leur proprietaire,
  // un appareil ajoute en douce par le serveur ne recoit rien
  crypto.setDeviceIsolationMode(new OnlySignedDevicesIsolationMode());

  if (mode === "creer") {
    await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys: (faire) => faire(null) });
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: () => crypto.createRecoveryKeyFromPassphrase(phrase),
      setupNewSecretStorage: true,
      setupNewKeyBackup: true,
    });
    await attendreSignature(client);
    return;
  }

  if (mode === "deverrouiller") {
    await crypto.bootstrapCrossSigning({});
    await crypto.crossSignDevice(client.getDeviceId());
    await attendreSignature(client);
    await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
    await crypto.checkKeyBackupAndEnable();
    await crypto.restoreKeyBackup();
    return;
  }

  await crypto.checkKeyBackupAndEnable();
}

async function attendreSignature(client, delai = 15000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    if (await appareilSigne(client)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("appareil_non_signe");
}

export async function appareilSigne(client) {
  const statut = await client.getCrypto().getDeviceVerificationStatus(client.getUserId(), client.getDeviceId());
  return Boolean(statut?.signedByOwner);
}
