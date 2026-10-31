import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// en production, la page n'execute que nos propres fichiers et ne parle qu'a notre serveur
function politiqueSecurite(serveur) {
  const origine = new URL(serveur).origin;
  const regles = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    `connect-src 'self' ${origine}`,
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "kibare-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${regles}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), politiqueSecurite(env.VITE_SERVEUR || "http://localhost:8008")],
    optimizeDeps: {
      exclude: ["@matrix-org/matrix-sdk-crypto-wasm"],
    },
    server: {
      port: 5173,
    },
  };
});
