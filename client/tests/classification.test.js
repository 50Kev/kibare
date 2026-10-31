import { describe, it, expect } from "vitest";
import { CHAMP, etiqueter, lireNiveau, regles, estExpire, tempsRestant } from "../src/matrix/classification.js";

const base = { msgtype: "m.text", body: "reunion a 10h" };

describe("classification des messages", () => {
  it("laisse un message normal tel quel", () => {
    expect(etiqueter(base, "normal")).toEqual(base);
  });

  it("ajoute le niveau et la date d'expiration", () => {
    const c = etiqueter(base, "confidentiel", 1000, 500);
    expect(c[CHAMP]).toEqual({ niveau: "confidentiel", expire_a: 1500 });
    expect(c.body).toBe("reunion a 10h");
  });

  it("refuse un niveau qui n'existe pas", () => {
    expect(() => etiqueter(base, "secret")).toThrow();
  });

  it("traite un niveau inconnu recu comme confidentiel", () => {
    expect(lireNiveau({ ...base, [CHAMP]: { niveau: "nimporte" } })).toBe("confidentiel");
    expect(lireNiveau({ ...base, [CHAMP]: null })).toBe("confidentiel");
  });

  it("interdit le transfert et la copie selon le niveau", () => {
    expect(regles(base).transfert).toBe(true);
    expect(regles(etiqueter(base, "restreint")).transfert).toBe(false);
    const conf = regles(etiqueter(base, "confidentiel"));
    expect(conf.transfert).toBe(false);
    expect(conf.copie).toBe(false);
  });

  it("detecte l'expiration", () => {
    const c = etiqueter(base, "restreint", 0, 1000);
    expect(estExpire(c, 999)).toBe(false);
    expect(estExpire(c, 1000)).toBe(true);
    expect(tempsRestant(c, 400)).toBe(600);
    expect(estExpire(base, Date.now())).toBe(false);
  });
});
