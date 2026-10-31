import { describe, it, expect, beforeEach } from "vitest";
import { noterEchec, memoriserAppareil, appareilConnu, oublierAppareil, rappelsCoffre } from "../src/matrix/identite.js";

const m = new Map();
globalThis.localStorage ??= { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const session = { userId: "@agent1:test", deviceId: "ABC" };

describe("appareil et echecs", () => {
  beforeEach(() => oublierAppareil(session));
  it("compte les echecs et les remet a zero quand l'appareil s'ouvre", () => {
    expect(noterEchec(session)).toBe(1);
    expect(noterEchec(session)).toBe(2);
    memoriserAppareil(session);
    expect(appareilConnu(session)).toBe(true);
    expect(noterEchec(session)).toBe(1);
  });
});

describe("rappels du coffre", () => {
  it("rend une cle mise en cache puis l'oublie", async () => {
    const coffre = rappelsCoffre();
    const cle = new Uint8Array([1, 2, 3]);
    coffre.callbacks.cacheSecretStorageKey("k1", {}, cle);
    expect(await coffre.callbacks.getSecretStorageKey({ keys: { k1: {} } })).toEqual(["k1", cle]);
    coffre.oublier();
    expect(await coffre.callbacks.getSecretStorageKey({ keys: { k1: {} } })).toBe(null);
  });
});
