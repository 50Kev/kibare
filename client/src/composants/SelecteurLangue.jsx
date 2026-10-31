import { Languages } from "lucide-react";
import { LANGUES, useLangue } from "../i18n/langue.jsx";

export default function SelecteurLangue({ clair = false }) {
  const { langue, changer, t } = useLangue();
  return (
    <label className={clair ? "langue langue-clair" : "langue"}>
      <Languages size={16} aria-hidden="true" />
      <span className="masque">{t("langue")}</span>
      <select value={langue} onChange={(e) => changer(e.target.value)}>
        {LANGUES.map((l) => (
          <option key={l.code} value={l.code}>{l.nom}</option>
        ))}
      </select>
    </label>
  );
}
