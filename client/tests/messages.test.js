import { describe, it, expect, vi } from "vitest";
import { transferer, supprimerExpires } from "../src/matrix/messages.js";
import { etiqueter } from "../src/matrix/classification.js";

function faux(contenu, auteur = "@a:test", id = "$1") {
  return {
    getContent: () => contenu,
    getSender: () => auteur,
    getId: () => id,
    getType: () => "m.room.message",
    isRedacted: () => false,
    isDecryptionFailure: () => false,
  };
}

const salon = (evs) => ({ roomId: "!s:test", getLiveTimeline: () => ({ getEvents: () => evs }) });

describe("transfert", () => {
  it("refuse de transferer un message classifie", async () => {
    const client = { sendMessage: vi.fn() };
    const ev = faux(etiqueter({ msgtype: "m.text", body: "x" }, "restreint"));
    await expect(transferer(client, ev, "!autre:test")).rejects.toThrow("transfert_interdit");
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("transfere un message normal sans sa relation", async () => {
    const client = { sendMessage: vi.fn() };
    const ev = faux({ msgtype: "m.text", body: "x", "m.relates_to": { rel_type: "m.thread" } });
    await transferer(client, ev, "!autre:test");
    const [cible, envoye] = client.sendMessage.mock.calls[0];
    expect(cible).toBe("!autre:test");
    expect(envoye.body).toBe("x");
    expect(envoye["m.relates_to"]).toBeUndefined();
    expect(envoye["bf.gov.bourrage"]).toBeDefined();
  });
});

describe("expiration", () => {
  it("supprime seulement mes messages expires", async () => {
    const client = { getUserId: () => "@moi:test", redactEvent: vi.fn().mockResolvedValue({}) };
    const expire = etiqueter({ msgtype: "m.text", body: "a" }, "confidentiel", 0, 10);
    const evs = [
      faux(expire, "@moi:test", "$mien"),
      faux(expire, "@autre:test", "$autre"),
      faux(etiqueter({ msgtype: "m.text", body: "b" }, "confidentiel", 0, 10_000), "@moi:test", "$frais"),
    ];
    await supprimerExpires(client, salon(evs), 100);
    expect(client.redactEvent).toHaveBeenCalledTimes(1);
    expect(client.redactEvent.mock.calls[0][1]).toBe("$mien");
  });
});
