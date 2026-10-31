import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { demarrer } from "../../src/matrix/client.js";
import { modePhrase } from "../../src/matrix/identite.js";
import { creerSalon, accepter, nomSalon } from "../../src/matrix/salons.js";
import { envoyerTexte } from "../../src/matrix/messages.js";
import { envoyerFichier, ouvrirFichier } from "../../src/matrix/fichiers.js";

// lance par tests/test_pile.py du volet A, avec deux sessions obtenues par Keycloak et le second facteur
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const SESSIONS = process.env.KIBARE_SESSIONS ? JSON.parse(process.env.KIBARE_SESSIONS) : null;
const PHRASES = ["phrase pile agent un 2026", "phrase pile agent deux 2026"];
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function jusqua(test, delai = 30000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const r = await test();
    if (r) return r;
    await attendre(300);
  }
  throw new Error("delai depasse");
}

it.skipIf(!SESSIONS)("echange chiffre a travers toute la pile", async () => {
  const clients = [];
  for (const [i, s] of SESSIONS.entries()) {
    clients.push(await demarrer(s, PHRASES[i], await modePhrase(s), { quandRevoque() {} }));
  }
  const [a1, a2] = clients;
  const salonId = await creerSalon(a1, "Pile-groupe-cabinet", a2.getUserId());
  await jusqua(() => a2.getRoom(salonId));
  await accepter(a2, salonId);
  await jusqua(() => a1.getRoom(salonId)?.getJoinedMemberCount() === 2);
  // l'invite doit pouvoir lire le nom chiffre du groupe
  await jusqua(() => nomSalon(a2.getRoom(salonId)) === "Pile-groupe-cabinet");

  await envoyerTexte(a1, salonId, "Pile-secret-instruction-5520", "confidentiel");
  await envoyerFichier(a1, salonId, new File(["Pile-fichier-contenu-8812"], "pile-note.txt", { type: "text/plain" }), "normal");

  const trouve = (f) => a2.getRoom(salonId)?.getLiveTimeline().getEvents().find(f);
  await jusqua(() => trouve((e) => e.getContent()?.body === "Pile-secret-instruction-5520"));
  const fichier = await jusqua(() => trouve((e) => e.getContent()?.body === "pile-note.txt"));
  expect(await (await ouvrirFichier(a2, fichier.getContent())).text()).toBe("Pile-fichier-contenu-8812");
  clients.forEach((c) => c.stopClient());
}, 120000);
