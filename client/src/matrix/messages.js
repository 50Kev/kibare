import { EventType, MsgType } from "matrix-js-sdk";
import { etiqueter, estExpire, regles } from "./classification.js";
import { bourrer } from "./securite.js";

export async function envoyerTexte(client, salonId, texte, niveau, duree) {
  const contenu = etiqueter({ msgtype: MsgType.Text, body: texte }, niveau, Date.now(), duree);
  return client.sendMessage(salonId, bourrer(contenu));
}

export function evenementsAffichables(salon) {
  return salon
    .getLiveTimeline()
    .getEvents()
    .filter((ev) => !ev.isRedacted())
    .filter((ev) => ev.getType() === EventType.RoomMessage || ev.isDecryptionFailure());
}

// chaque auteur supprime ses propres messages arrives a expiration
export async function supprimerExpires(client, salon, maintenant = Date.now()) {
  const moi = client.getUserId();
  const aSupprimer = evenementsAffichables(salon).filter(
    (ev) => ev.getSender() === moi && ev.getId()?.startsWith("$") && estExpire(ev.getContent(), maintenant),
  );
  for (const ev of aSupprimer) {
    try {
      await client.redactEvent(salon.roomId, ev.getId(), undefined, { reason: "expiration" });
    } catch (e) {
      console.warn("suppression ratee", ev.getId(), e);
    }
  }
}

export async function transferer(client, ev, salonCibleId) {
  const contenu = ev.getContent();
  if (!regles(contenu).transfert) throw new Error("transfert_interdit");
  const copie = { ...contenu };
  delete copie["m.relates_to"];
  return client.sendMessage(salonCibleId, bourrer(copie));
}
