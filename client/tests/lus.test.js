import { describe, it, expect } from "vitest";
import { marquerLu, compterNonLus } from "../src/matrix/lus.js";

const m = new Map();
globalThis.localStorage ??= { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };

const ev = (auteur, ts, type = "m.room.message") => ({
  getSender: () => auteur, getTs: () => ts, getType: () => type,
  isRedacted: () => false, isDecryptionFailure: () => false,
});
const salon = (evs) => ({ roomId: "!s:test", getLiveTimeline: () => ({ getEvents: () => evs }) });

describe("non lus", () => {
  it("compte les messages des autres apres la derniere lecture", () => {
    const s = salon([ev("@a:t", 10), ev("@moi:t", 20), ev("@a:t", 30), ev("@a:t", 40, "bf.gov.nom_salon")]);
    expect(compterNonLus(s, "@moi:t")).toBe(2);
    marquerLu("!s:test", 25);
    expect(compterNonLus(s, "@moi:t")).toBe(1);
  });
  it("ne recule jamais la date de lecture", () => {
    marquerLu("!s:test", 100);
    marquerLu("!s:test", 50);
    expect(compterNonLus(salon([ev("@a:t", 80)]), "@moi:t")).toBe(0);
  });
});
