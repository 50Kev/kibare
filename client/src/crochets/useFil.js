import { useEffect, useState } from "react";
import { MatrixEventEvent, RoomEvent } from "matrix-js-sdk";
import { evenementsAffichables, supprimerExpires } from "../matrix/messages.js";

const BATTEMENT = 15 * 1000;

export function useFil(client, salon) {
  const [evenements, setEvenements] = useState([]);
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    if (!salon) {
      setEvenements([]);
      return;
    }
    const rafraichir = () => setEvenements([...evenementsAffichables(salon)]);
    const siCeSalon = (_ev, room) => {
      if (!room || room.roomId === salon.roomId) rafraichir();
    };
    const siDechiffre = (ev) => {
      if (ev.getRoomId() === salon.roomId) rafraichir();
    };

    client.on(RoomEvent.Timeline, siCeSalon);
    client.on(RoomEvent.Redaction, siCeSalon);
    client.on(RoomEvent.LocalEchoUpdated, siCeSalon);
    client.on(MatrixEventEvent.Decrypted, siDechiffre);
    rafraichir();

    return () => {
      client.off(RoomEvent.Timeline, siCeSalon);
      client.off(RoomEvent.Redaction, siCeSalon);
      client.off(RoomEvent.LocalEchoUpdated, siCeSalon);
      client.off(MatrixEventEvent.Decrypted, siDechiffre);
    };
  }, [client, salon]);

  useEffect(() => {
    const minuterie = setInterval(() => {
      const t = Date.now();
      setMaintenant(t);
      if (salon) supprimerExpires(client, salon, t);
    }, BATTEMENT);
    return () => clearInterval(minuterie);
  }, [client, salon]);

  return { evenements, maintenant };
}
