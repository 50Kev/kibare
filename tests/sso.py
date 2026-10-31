"""Parcours de connexion d'un agent, comme le ferait un navigateur : Synapse, Keycloak, mot de passe, code TOTP."""

import base64
import html
import re
import time

import pyotp
import requests


_derniers = {}


def code_totp(cle_brute):
    # Keycloak refuse qu'un meme code serve deux fois : on attend la fenetre suivante si besoin
    totp = pyotp.TOTP(base64.b32encode(cle_brute.encode()).decode().rstrip("="))
    while totp.now() == _derniers.get(cle_brute):
        time.sleep(1)
    _derniers[cle_brute] = totp.now()
    return _derniers[cle_brute]


def action_du_formulaire(page, identifiant_formulaire):
    balise = re.search(r"<form[^>]*\bid=\"" + identifiant_formulaire + r"\"[^>]*>", page)
    if not balise:
        return None
    action = re.search(r'action="([^"]+)"', balise.group(0))
    return html.unescape(action.group(1)) if action else None


def champ_cache(page, nom):
    m = re.search(r'name="' + nom + r'"[^>]*value="([^"]*)"', page) or re.search(r'value="([^"]*)"[^>]*name="' + nom + '"', page)
    return html.unescape(m.group(1)) if m else None


def suivre(s, r):
    for _ in range(6):
        cible = r.headers.get("Location", "")
        if "loginToken=" in cible:
            return re.search(r"loginToken=([^&]+)", cible).group(1), r
        if r.status_code not in (301, 302, 303, 307) or not cible:
            return None, r
        r = s.get(requests.compat.urljoin(r.url, cible), allow_redirects=False)
    return None, r


def premiere_connexion(base, identifiant, provisoire, nouveau, verify=True):
    """Premiere connexion d'un agent enrole : il configure son code TOTP puis choisit son mot de passe."""
    s = requests.Session()
    s.verify = verify
    r = s.get(f"{base}/_matrix/client/v3/login/sso/redirect/oidc-keycloak", params={"redirectUrl": f"{base}/"})
    r = s.post(action_du_formulaire(r.text, "kc-form-login"), data={"username": identifiant, "password": provisoire, "credentialId": ""})
    secret = champ_cache(r.text, "totpSecret")
    action = action_du_formulaire(r.text, "kc-totp-settings-form")
    if not secret or not action:
        return None, None, r
    r = s.post(action, data={"totp": code_totp(secret), "totpSecret": secret, "userLabel": "test"}, allow_redirects=False)
    if r.status_code in (301, 302, 303):
        r = s.get(requests.compat.urljoin(r.url, r.headers["Location"]), allow_redirects=False)
    action = action_du_formulaire(r.text, "kc-passwd-update-form")
    if action:
        r = s.post(action, data={"password-new": nouveau, "password-confirm": nouveau}, allow_redirects=False)
    jeton, r = suivre(s, r)
    return jeton, secret, r


def connexion(base, identifiant, mot_de_passe, cle_totp=None, code=None, verify=True):
    """Renvoie (jeton_de_connexion ou None, derniere page) pour pouvoir verifier les refus."""
    s = requests.Session()
    s.verify = verify
    r = s.get(f"{base}/_matrix/client/v3/login/sso/redirect/oidc-keycloak", params={"redirectUrl": f"{base}/"})
    action = action_du_formulaire(r.text, "kc-form-login")
    if not action:
        return None, r
    r = s.post(action, data={"username": identifiant, "password": mot_de_passe, "credentialId": ""})
    action = action_du_formulaire(r.text, "kc-otp-login-form")
    if not action:
        return None, r
    otp = code if code is not None else code_totp(cle_totp)
    r = s.post(action, data={"otp": otp}, allow_redirects=False)
    return suivre(s, r)


def session_matrix(base, jeton, verify=True):
    for _ in range(8):
        r = requests.post(f"{base}/_matrix/client/v3/login", json={"type": "m.login.token", "token": jeton}, verify=verify)
        if r.status_code != 429:
            break
        # Synapse limite les connexions : on attend le delai qu'il indique
        time.sleep(r.json().get("retry_after_ms", 2000) / 1000 + 0.2)
    r.raise_for_status()
    d = r.json()
    return {"baseUrl": base, "userId": d["user_id"], "deviceId": d["device_id"], "accessToken": d["access_token"]}
