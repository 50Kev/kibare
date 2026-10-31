const CLE = "kibare.session";

export function lireSession() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE));
    if (s && s.accessToken && s.userId && s.deviceId && s.baseUrl) return s;
  } catch {
    // session abimee, on repart de zero
  }
  return null;
}

export function sauverSession(s) {
  const propre = {
    baseUrl: s.baseUrl,
    userId: s.userId,
    deviceId: s.deviceId,
    accessToken: s.accessToken,
  };
  localStorage.setItem(CLE, JSON.stringify(propre));
}

export function effacerSession() {
  localStorage.removeItem(CLE);
}
