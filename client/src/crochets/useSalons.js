import { useEffect, useState } from "react";
import { ClientEvent, MatrixEventEvent, RoomEvent } from "matrix-js-sdk";
import { listerSalons, listerInvitations, chargerNoms } from "../matrix/salons.js";

export function useSalons(client) {
  const [etat, setEtat] = useState(() => ({
    salons: listerSalons(client),
    invitations: listerInvitations(client),
  }));

  useEffect(() => {
    const rafraichir = () =>
      setEtat({ salons: listerSalons(client), invitations: listerInvitations(client) });

    const evenements = [
      [ClientEvent.Room, rafraichir],
      [ClientEvent.DeleteRoom, rafraichir],
      [RoomEvent.MyMembership, rafraichir],
      [RoomEvent.Name, rafraichir],
      [RoomEvent.Timeline, rafraichir],
      [MatrixEventEvent.Decrypted, rafraichir],
    ];
    evenements.forEach(([nom, f]) => client.on(nom, f));
    rafraichir();
    chargerNoms(client, listerSalons(client)).then(rafraichir).catch(() => {});
    return () => evenements.forEach(([nom, f]) => client.off(nom, f));
  }, [client]);

  return etat;
}
