import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "./styles.css";
import App from "./App.jsx";
import { FournisseurLangue } from "./i18n/langue.jsx";

createRoot(document.getElementById("racine")).render(
  <FournisseurLangue>
    <App />
  </FournisseurLangue>,
);
