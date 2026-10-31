import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createClient } from "matrix-js-sdk";
import { connexionMotDePasse, messageErreur } from "../../src/matrix/connexion.js";
import { demarrer, verrouiller } from "../../src/matrix/client.js";
import { modePhrase, appareilSigne } from "../../src/matrix/identite.js";
import { creerSalon, accepter, nomSalon } from "../../src/matrix/salons.js";
import { envoyerTexte } from "../../src/matrix/messages.js";
import { envoyerFichier, ouvrirFichier } from "../../src/matrix/fichiers.js";

if (!globalThis.localStorage) {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// a lancer avec un Synapse de test neuf :
// KIBARE_BASE=chemin/homeserver.db VITE_SERVEUR=http://127.0.0.1:8008 npm run test:serveur
const ACTIF = process.env.KIBARE_E2E === "1";
const BASE = process.env.KIBARE_BASE;
const SERVEUR = process.env.VITE_SERVEUR;
const SECRET = "Instruction-confidentielle-7731";
const NOM_GROUPE = "Cabinet-budget-2027";
const PHRASE1 = "baobab de koudougou 2026";
const PHRASE2 = "karite du sahel en saison";

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function jusqua(test, delai = 20000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const r = await test();
    if (r) return r;
    await attendre(300);
  }
  throw new Error("delai depasse");
}

function chercherDansLaBase(motif) {
  const requete = `import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute("select count(*) from event_json where json like ?", ("%"+sys.argv[2]+"%",)).fetchone()[0])`;
  return Number(String(execFileSync("python3", ["-c", requete, BASE, motif])).trim());
}

const trouver = (c, salonId, f) => c.getRoom(salonId)?.getLiveTimeline().getEvents().find(f);

describe.skipIf(!ACTIF)("contre un vrai serveur Synapse", () => {
  let a1, a2, s1, salonId, revoque = false;

  beforeAll(async () => {
    s1 = await connexionMotDePasse("agent1", "Demo-agent1-2026");
    expect(await modePhrase(s1)).toBe("creer");
    a1 = await demarrer(s1, PHRASE1, "creer", { quandRevoque: () => {} });
    const s2 = await connexionMotDePasse("agent2", "Demo-agent2-2026");
    a2 = await demarrer(s2, PHRASE2, "creer", { quandRevoque: () => { revoque = true; } });
  }, 90000);

  it("chaque appareil est signe par son agent", async () => {
    expect(await appareilSigne(a1)).toBe(true);
    expect(await appareilSigne(a2)).toBe(true);
  });

  it("un compte non enrole est rejete", async () => {
    const err = await connexionMotDePasse("intrus", "nimporte").catch((e) => e);
    expect(messageErreur(err)).toBe("erreur_refuse");
  });

  it("echange chiffre, rien en clair cote serveur", async () => {
    salonId = await creerSalon(a1, NOM_GROUPE, "agent2");
    await jusqua(() => a2.getRoom(salonId));
    await accepter(a2, salonId);
    await jusqua(() => a1.getRoom(salonId)?.getJoinedMemberCount() === 2);
    expect(nomSalon(a1.getRoom(salonId))).toBe(NOM_GROUPE);

    await envoyerTexte(a1, salonId, SECRET, "confidentiel");
    const recu = await jusqua(() => trouver(a2, salonId, (ev) => ev.getContent()?.body === SECRET));
    expect(recu.isEncrypted()).toBe(true);
    for (const motif of [SECRET, NOM_GROUPE, "bf.gov.classification", "bf.gov.bourrage"]) {
      expect(chercherDansLaBase(motif)).toBe(0);
    }
  }, 60000);

  it("fichier chiffre et bourre, rendu intact au destinataire", async () => {
    const texte = "Piece-jointe-secrete-4410";
    await envoyerFichier(a1, salonId, new File([texte], "note.txt", { type: "text/plain" }), "normal");
    const ev = await jusqua(() => trouver(a2, salonId, (e) => e.getContent()?.body === "note.txt"));
    const blob = await ouvrirFichier(a2, ev.getContent());
    expect(await blob.text()).toBe(texte);
    expect(chercherDansLaBase("note.txt")).toBe(0);
  }, 60000);

  it("un appareil non signe ne recoit pas les cles", async () => {
    const pirate = createClient({ baseUrl: SERVEUR });
    const r = await pirate.loginRequest({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: "agent2" },
      password: "Demo-agent2-2026",
    });
    const intrus = createClient({ baseUrl: SERVEUR, userId: r.user_id, deviceId: r.device_id, accessToken: r.access_token });
    await intrus.initRustCrypto({ cryptoDatabasePrefix: "intrus" });
    intrus.startClient({ initialSyncLimit: 20 });
    await jusqua(() => intrus.getRoom(salonId));
    await attendre(1500);

    await envoyerTexte(a1, salonId, "apres-appareil-intrus", "normal");
    await jusqua(() => trouver(a2, salonId, (e) => e.getContent()?.body === "apres-appareil-intrus"));
    const vu = await jusqua(() =>
      trouver(intrus, salonId, (e) => e.isEncrypted() && e.getSender() === a1.getUserId() && e.getTs() > Date.now() - 20000),
    );
    await attendre(3000);
    expect(vu.getContent()?.body).not.toBe("apres-appareil-intrus");
    intrus.stopClient();
  }, 60000);

  it("nouvel appareil : mauvaise phrase refusee, bonne phrase rend l'historique", async () => {
    const s1b = await connexionMotDePasse("agent1", "Demo-agent1-2026");
    expect(await modePhrase(s1b)).toBe("deverrouiller");
    const err = await demarrer(s1b, "pas la bonne phrase", "deverrouiller", { quandRevoque: () => {} }).catch((e) => e);
    expect(err.message).toBe("phrase_incorrecte");

    const a1b = await demarrer(s1b, PHRASE1, "deverrouiller", { quandRevoque: () => {} });
    expect(await appareilSigne(a1b)).toBe(true);
    const ancien = await jusqua(() => trouver(a1b, salonId, (ev) => ev.getContent()?.body === SECRET), 30000);
    expect(ancien.isDecryptionFailure()).toBe(false);
    a1b.stopClient();
  }, 90000);

  it("appareil connu : la phrase ouvre la base locale, une mauvaise non", async () => {
    a1.stopClient();
    verrouiller();
    expect(await modePhrase(s1)).toBe("ouvrir");
    const err = await demarrer(s1, "mauvaise phrase ici", "ouvrir", { quandRevoque: () => {} }).catch((e) => e);
    expect(err.message).toBe("phrase_incorrecte");
    a1 = await demarrer(s1, PHRASE1, "ouvrir", { quandRevoque: () => {} });
    expect(await appareilSigne(a1)).toBe(true);
  }, 90000);

  it("un agent revoque perd l'acces et ne recoit plus rien", async () => {
    const admin = createClient({ baseUrl: SERVEUR });
    const { access_token } = await admin.loginRequest({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: "admin" },
      password: "Demo-admin-2026",
    });
    const debut = Date.now();
    const rep = await fetch(`${SERVEUR}/_synapse/admin/v1/deactivate/@agent2:localhost`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ erase: false }),
    });
    expect(rep.ok).toBe(true);
    await jusqua(() => revoque, 45000);
    console.log(`revocation vue par le client en ${Date.now() - debut} ms`);
    await jusqua(() => a1.getRoom(salonId)?.getJoinedMemberCount() === 1);
    const err = await connexionMotDePasse("agent2", "Demo-agent2-2026").catch((e) => e);
    expect(messageErreur(err)).toMatch(/erreur_(refuse|desactive)/);
  }, 90000);
});
