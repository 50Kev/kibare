import { useState } from "react";
import { useSalons } from "../crochets/useSalons.js";
import { useInactivite } from "../crochets/useInactivite.js";
import BarreLaterale from "./BarreLaterale.jsx";
import FilSalon from "./FilSalon.jsx";
import NouveauSalon from "./NouveauSalon.jsx";
import Inviter from "./Inviter.jsx";
import Transfert from "./Transfert.jsx";

const DELAI_VERROU = 10 * 60 * 1000;

export default function Messagerie({ client, onQuitter, onVerrouiller }) {
  useInactivite(DELAI_VERROU, () => onVerrouiller("verrou_inactivite"));
  const { salons, invitations } = useSalons(client);
  const [salonId, setSalonId] = useState(null);
  const [fenetre, setFenetre] = useState(null);
  const [aTransferer, setATransferer] = useState(null);

  const salon = salons.find((s) => s.roomId === salonId) || null;

  return (
    <div className={salon ? "messagerie avec-salon" : "messagerie"}>
      <BarreLaterale
        client={client}
        salons={salons}
        invitations={invitations}
        actif={salonId}
        onChoisir={setSalonId}
        onNouveau={() => setFenetre("nouveau")}
        onQuitter={onQuitter}
        onVerrouiller={() => onVerrouiller(null)}
      />
      <FilSalon
        client={client}
        salon={salon}
        onRetour={() => setSalonId(null)}
        onInviter={() => setFenetre("inviter")}
        onNouveau={() => setFenetre("nouveau")}
        onTransferer={(ev) => {
          setATransferer(ev);
          setFenetre("transfert");
        }}
      />

      {fenetre === "nouveau" && (
        <NouveauSalon
          client={client}
          onFermer={() => setFenetre(null)}
          onCree={(id) => {
            setFenetre(null);
            setSalonId(id);
          }}
        />
      )}
      {fenetre === "inviter" && salon && (
        <Inviter client={client} salon={salon} onFermer={() => setFenetre(null)} />
      )}
      {fenetre === "transfert" && aTransferer && (
        <Transfert
          client={client}
          evenement={aTransferer}
          salons={salons.filter((s) => s.roomId !== salonId)}
          onFermer={() => {
            setFenetre(null);
            setATransferer(null);
          }}
        />
      )}
    </div>
  );
}
