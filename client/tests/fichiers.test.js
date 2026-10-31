import { describe, it, expect, vi } from "vitest";
import { decryptAttachment } from "matrix-encrypt-attachment";
import { envoyerFichier, TAILLE_MAX } from "../src/matrix/fichiers.js";
import { retirerBourrage, BLOC_FICHIER, CHAMP_TAILLE } from "../src/matrix/securite.js";

const SECRET = "Note de service : budget 2027 de la direction";

function fauxClient() {
  const envoi = {};
  return {
    envoi,
    uploadContent: vi.fn(async (blob, opts) => {
      envoi.octets = new Uint8Array(await blob.arrayBuffer());
      envoi.opts = opts;
      return { content_uri: "mxc://test/abc" };
    }),
    sendMessage: vi.fn(async (_salon, contenu) => {
      envoi.contenu = contenu;
      return { event_id: "$x" };
    }),
  };
}

describe("envoi de fichier chiffre", () => {
  it("le serveur ne recoit jamais le contenu en clair", async () => {
    const client = fauxClient();
    const fichier = new File([SECRET], "budget-2027.txt", { type: "text/plain" });
    await envoyerFichier(client, "!s:test", fichier, "normal");

    const recu = new TextDecoder().decode(client.envoi.octets);
    expect(recu).not.toContain("budget");
    expect(client.envoi.opts.type).toBe("application/octet-stream");
    expect(client.envoi.opts.includeFilename).toBe(false);
  });

  it("le destinataire peut dechiffrer avec la cle du message", async () => {
    const client = fauxClient();
    await envoyerFichier(client, "!s:test", new File([SECRET], "n.txt", { type: "text/plain" }), "normal");
    const { file } = client.envoi.contenu;
    expect(file.url).toBe("mxc://test/abc");
    expect(client.envoi.octets.length % BLOC_FICHIER).toBe(0);
    const clair = await decryptAttachment(client.envoi.octets.buffer, file);
    const vrai = retirerBourrage(new Uint8Array(clair), client.envoi.contenu[CHAMP_TAILLE]);
    expect(new TextDecoder().decode(vrai)).toBe(SECRET);
  });

  it("refuse un fichier trop lourd", async () => {
    const client = fauxClient();
    const gros = { size: TAILLE_MAX + 1, type: "text/plain", name: "gros.txt" };
    await expect(envoyerFichier(client, "!s:test", gros, "normal")).rejects.toThrow("fichier_trop_lourd");
    expect(client.uploadContent).not.toHaveBeenCalled();
  });
});
