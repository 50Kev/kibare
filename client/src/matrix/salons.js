import { EventType, Preset, Visibility, KnownMembership } from "matrix-js-sdk";
import { bourrer } from "./securite.js";

// le nom d'un salon Matrix est stocke en clair sur le serveur,
// on l'envoie donc comme un evenement chiffre dans le fil
export const TYPE_NOM = "bf.gov.nom_salon";

export function listerSalons(client) {
  return client
    .getRooms()
    .filter((s) => s.getMyMembership() === KnownMembership.Join)
    .sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
}

export function listerInvitations(client) {
  return client.getRooms().filter((s) => s.getMyMembership() === KnownMembership.Invite);
}

export function normaliserIdentifiant(saisie, monId) {
  const brut = saisie.trim().replace(/^@/, "");
  if (!brut) return null;
  if (brut.includes(":")) return "@" + brut;
  const domaine = monId.split(":").slice(1).join(":");
  return `@${brut}:${domaine}`;
}

export function nomSalon(salon) {
  const evs = salon.getLiveTimeline().getEvents();
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].getType() === TYPE_NOM && evs[i].getContent()?.nom) return evs[i].getContent().nom;
  }
  return salon.name;
}

function aUnNom(salon) {
  return salon.getLiveTimeline().getEvents().some((ev) => ev.getType() === TYPE_NOM && ev.getContent()?.nom);
}

// si le nom est loin dans l'historique, on remonte quelques pages pour le retrouver
export async function chargerNoms(client, salons, pagesMax = 4) {
  for (const salon of salons) {
    for (let i = 0; i < pagesMax && !aUnNom(salon); i++) {
      if (!salon.getLiveTimeline().getPaginationToken("b")) break;
      await client.scrollback(salon, 50);
    }
  }
}

// on verifie a intervalles reguliers : l'evenement "nouveau salon" du SDK peut arriver
// avant que l'etat du salon (dont le chiffrement) soit rempli
// nom a afficher : le nom chiffre, sinon les autres membres, jamais le texte anglais du SDK
export function libelleSalon(salon, t) {
  const evs = salon.getLiveTimeline().getEvents();
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].getType() === TYPE_NOM && evs[i].getContent()?.nom) return evs[i].getContent().nom;
  }
  const moi = salon.myUserId;
  const autres = salon.getJoinedMembers().filter((m) => m.userId !== moi).map((m) => m.name);
  if (autres.length) return autres.slice(0, 3).join(", ");
  return t("groupe_vide");
}

function attendreSalonChiffre(client, salonId, delai = 15000) {
  const fin = Date.now() + delai;
  return new Promise((resolve, reject) => {
    const verifier = () => {
      const salon = client.getRoom(salonId);
      if (salon && estChiffre(client, salon)) return resolve(salon);
      if (Date.now() > fin) return reject(new Error("salon_introuvable"));
      setTimeout(verifier, 200);
    };
    verifier();
  });
}

async function envoyerNom(client, salonId, nom) {
  // jamais d'envoi tant que le client ne sait pas que le salon est chiffre
  await attendreSalonChiffre(client, salonId);
  await client.sendEvent(salonId, TYPE_NOM, bourrer({ nom }));
}

export async function creerSalon(client, nom, saisieInvites) {
  const monId = client.getUserId();
  const invites = saisieInvites
    .split(/[,\s]+/)
    .map((s) => normaliserIdentifiant(s, monId))
    .filter((id) => id && id !== monId);

  const { room_id } = await client.createRoom({
    preset: Preset.PrivateChat,
    visibility: Visibility.Private,
    initial_state: [
      {
        type: EventType.RoomEncryption,
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
      {
        // un agent invite plus tard ne lit pas ce qui precede son invitation
        type: EventType.RoomHistoryVisibility,
        state_key: "",
        content: { history_visibility: "invited" },
      },
    ],
  });
  await envoyerNom(client, room_id, nom.trim());

  // on invite apres coup, puis on renvoie le nom une fois les invitations connues :
  // sinon la cle du nom part avant que les invites soient dans le salon
  for (const id of invites) await client.invite(room_id, id);
  if (invites.length) {
    await attendreInvites(client, room_id, invites);
    await envoyerNom(client, room_id, nom.trim());
  }
  return room_id;
}

function attendreInvites(client, salonId, ids, delai = 15000) {
  const fin = Date.now() + delai;
  return new Promise((resolve) => {
    const verifier = () => {
      const salon = client.getRoom(salonId);
      const tous = salon && ids.every((id) => ["invite", "join"].includes(salon.getMember(id)?.membership));
      if (tous || Date.now() > fin) return resolve(Boolean(tous));
      setTimeout(verifier, 200);
    };
    verifier();
  });
}

export async function inviter(client, salonId, saisie) {
  const id = normaliserIdentifiant(saisie, client.getUserId());
  if (!id) return;
  await client.invite(salonId, id);
  await attendreInvites(client, salonId, [id]);
  // le nouveau venu n'a pas la cle de l'ancien evenement de nom
  const salon = client.getRoom(salonId);
  const nom = salon && nomSalon(salon);
  if (nom && nom !== salon.name) await envoyerNom(client, salonId, nom);
}

export function accepter(client, salonId) {
  return client.joinRoom(salonId);
}

export function refuser(client, salonId) {
  return client.leave(salonId);
}

export function estChiffre(client, salon) {
  return Boolean(salon.currentState.getStateEvents(EventType.RoomEncryption, ""));
}
