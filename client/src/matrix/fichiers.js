import { MsgType } from "matrix-js-sdk";
import { encryptAttachment, decryptAttachment } from "matrix-encrypt-attachment";
import { etiqueter } from "./classification.js";
import { bourrer, bourrerOctets, retirerBourrage, CHAMP_TAILLE } from "./securite.js";

export const TAILLE_MAX = 25 * 1024 * 1024;

function genre(mime) {
  if (mime.startsWith("image/")) return MsgType.Image;
  if (mime.startsWith("audio/")) return MsgType.Audio;
  if (mime.startsWith("video/")) return MsgType.Video;
  return MsgType.File;
}

export async function envoyerFichier(client, salonId, fichier, niveau, duree) {
  if (fichier.size > TAILLE_MAX) throw new Error("fichier_trop_lourd");
  const mime = fichier.type || "application/octet-stream";

  // on complete jusqu'au bloc de 64 Ko suivant pour cacher la taille exacte
  const clair = bourrerOctets(new Uint8Array(await fichier.arrayBuffer()));
  const { data, info } = await encryptAttachment(clair.buffer);

  // le serveur recoit un bloc opaque, sans le vrai nom ni le vrai type
  const { content_uri } = await client.uploadContent(new Blob([data]), {
    type: "application/octet-stream",
    includeFilename: false,
  });

  const contenu = etiqueter(
    {
      msgtype: genre(mime),
      body: fichier.name,
      info: { mimetype: mime, size: fichier.size },
      file: { ...info, url: content_uri },
      [CHAMP_TAILLE]: fichier.size,
    },
    niveau,
    Date.now(),
    duree,
  );
  return client.sendMessage(salonId, bourrer(contenu));
}

export async function ouvrirFichier(client, contenu) {
  const { file, info } = contenu;
  if (!file?.url) throw new Error("fichier_absent");
  const adresse = client.mxcUrlToHttp(file.url, undefined, undefined, undefined, false, true, true);
  const reponse = await fetch(adresse, {
    headers: { Authorization: `Bearer ${client.getAccessToken()}` },
  });
  if (!reponse.ok) throw new Error("telechargement_impossible");
  const dechiffre = new Uint8Array(await decryptAttachment(await reponse.arrayBuffer(), file));
  const clair = retirerBourrage(dechiffre, contenu[CHAMP_TAILLE]);
  return new Blob([clair], { type: info?.mimetype || "application/octet-stream" });
}
