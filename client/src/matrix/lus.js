import { EventType } from "matrix-js-sdk";

// les messages non lus sont comptes sur l'appareil seulement :
// aucun accuse de lecture ne part vers le serveur, qui ne sait donc pas quand on lit
const cle = (salonId) => `kibare.lu.${salonId}`;

export function marquerLu(salonId, horodatage = Date.now()) {
  const avant = Number(localStorage.getItem(cle(salonId)) || 0);
  if (horodatage > avant) localStorage.setItem(cle(salonId), String(horodatage));
}

export function compterNonLus(salon, moi) {
  const lu = Number(localStorage.getItem(cle(salon.roomId)) || 0);
  return salon
    .getLiveTimeline()
    .getEvents()
    .filter((ev) => ev.getSender() !== moi && !ev.isRedacted())
    .filter((ev) => ev.getType() === EventType.RoomMessage || ev.isDecryptionFailure())
    .filter((ev) => ev.getTs() > lu).length;
}
