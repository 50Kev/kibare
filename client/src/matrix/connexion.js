import { createClient } from "matrix-js-sdk";
import { SERVEUR, NOM_APPAREIL } from "../config.js";
import { exigerServeurSur } from "./securite.js";

function clientAnonyme() {
  exigerServeurSur(SERVEUR);
  return createClient({ baseUrl: SERVEUR });
}

function versSession(reponse) {
  return {
    baseUrl: SERVEUR,
    userId: reponse.user_id,
    deviceId: reponse.device_id,
    accessToken: reponse.access_token,
  };
}

export async function methodesDisponibles() {
  const { flows } = await clientAnonyme().loginFlows();
  const types = flows.map((f) => f.type);
  return {
    motDePasse: types.includes("m.login.password"),
    sso: types.includes("m.login.sso"),
  };
}

export async function connexionMotDePasse(identifiant, motDePasse) {
  const reponse = await clientAnonyme().loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: identifiant.trim() },
    password: motDePasse,
    initial_device_display_name: NOM_APPAREIL,
  });
  return versSession(reponse);
}

export function adresseSso() {
  const retour = window.location.origin + window.location.pathname;
  return clientAnonyme().getSsoLoginUrl(retour, "sso");
}

export function jetonSsoRecu() {
  return new URLSearchParams(window.location.search).get("loginToken");
}

export async function terminerSso(jeton) {
  // le jeton ne sert qu'une fois, on le retire de l'adresse tout de suite
  window.history.replaceState({}, "", window.location.pathname);
  const reponse = await clientAnonyme().loginRequest({
    type: "m.login.token",
    token: jeton,
    initial_device_display_name: NOM_APPAREIL,
  });
  return versSession(reponse);
}

export function messageErreur(err) {
  const connus = ["serveur_non_securise", "phrase_incorrecte", "coffre_absent", "appareil_non_signe"];
  if (connus.includes(err?.message)) return err.message;
  const code = err?.errcode || err?.data?.errcode;
  if (code === "M_UNKNOWN_TOKEN") return "erreur_session";
  if (code === "M_FORBIDDEN") return "erreur_refuse";
  if (code === "M_USER_DEACTIVATED") return "erreur_desactive";
  if (code === "M_LIMIT_EXCEEDED") return "erreur_trop_essais";
  if (err?.name === "ConnectionError" || err instanceof TypeError) return "erreur_reseau";
  return "erreur_inconnue";
}
