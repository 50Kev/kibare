import { describe, it, expect } from "vitest";
import {
  serveurAutorise, exigerServeurSur, bourrer, bourrerOctets, retirerBourrage,
  BLOC_TEXTE, BLOC_FICHIER, CHAMP_BOURRAGE,
} from "../src/matrix/securite.js";

describe("adresse du serveur", () => {
  it("accepte https et le poste local", () => {
    expect(serveurAutorise("https://messagerie.gouv.bf")).toBe(true);
    expect(serveurAutorise("http://localhost:8008")).toBe(true);
    expect(serveurAutorise("http://127.0.0.1:8008")).toBe(true);
  });
  it("refuse http sur le reseau et les adresses invalides", () => {
    expect(serveurAutorise("http://10.0.0.5:8008")).toBe(false);
    expect(serveurAutorise("http://messagerie.gouv.bf")).toBe(false);
    expect(serveurAutorise("pas une adresse")).toBe(false);
    expect(() => exigerServeurSur("http://192.168.1.10")).toThrow("serveur_non_securise");
  });
});

describe("bourrage des messages", () => {
  const taille = (c) => new TextEncoder().encode(JSON.stringify(c)).length;
  it("donne une taille multiple de 256 octets", () => {
    for (const body of ["oui", "a".repeat(255), "é".repeat(300), "Réunion demain à 9 h au cabinet"]) {
      const c = bourrer({ msgtype: "m.text", body });
      expect(taille(c) % BLOC_TEXTE).toBe(0);
      expect(c.body).toBe(body);
    }
  });
  it("un mot et une phrase courte ont la meme taille", () => {
    expect(taille(bourrer({ msgtype: "m.text", body: "oui" }))).toBe(taille(bourrer({ msgtype: "m.text", body: "Nous refusons la proposition" })));
  });
  it("ne garde pas un ancien bourrage", () => {
    const c = bourrer(bourrer({ msgtype: "m.text", body: "x" }));
    expect(taille(c) % BLOC_TEXTE).toBe(0);
    expect(c[CHAMP_BOURRAGE].length).toBeLessThan(BLOC_TEXTE);
  });
});

describe("bourrage des fichiers", () => {
  it("arrondit au bloc de 64 Ko et se retire sans perte", () => {
    const octets = new TextEncoder().encode("contenu du rapport");
    const bourre = bourrerOctets(octets);
    expect(bourre.length).toBe(BLOC_FICHIER);
    expect(new TextDecoder().decode(retirerBourrage(bourre, octets.length))).toBe("contenu du rapport");
  });
  it("ignore une taille absente ou absurde", () => {
    const b = bourrerOctets(new Uint8Array(10));
    expect(retirerBourrage(b, undefined).length).toBe(BLOC_FICHIER);
    expect(retirerBourrage(b, BLOC_FICHIER + 1).length).toBe(BLOC_FICHIER);
    expect(retirerBourrage(b, -3).length).toBe(BLOC_FICHIER);
  });
});
