import { describe, it, expect } from "vitest";
import { normaliserIdentifiant } from "../src/matrix/salons.js";
import { traduire } from "../src/i18n/traduire.js";

describe("identifiants", () => {
  it("complete avec le domaine de l'agent connecte", () => {
    expect(normaliserIdentifiant("agent2", "@agent1:gouv.bf")).toBe("@agent2:gouv.bf");
    expect(normaliserIdentifiant("@agent3:autre.bf", "@agent1:gouv.bf")).toBe("@agent3:autre.bf");
    expect(normaliserIdentifiant("  ", "@agent1:gouv.bf")).toBe(null);
  });
});

describe("traductions", () => {
  const d = { fr: { salut: "Bonjour {nom}" }, mos: { salut: "" } };
  it("retombe sur le francais quand la traduction manque", () => {
    expect(traduire(d, "mos", "salut", { nom: "Awa" })).toBe("Bonjour Awa");
  });
});
