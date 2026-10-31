import { useLangue } from "../i18n/langue.jsx";

export default function Filigrane({ agent }) {
  const { t } = useLangue();
  const texte = t("filigrane", { agent });
  return (
    <div className="filigrane-cadre" aria-hidden="true">
      <div className="filigrane">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i}>{texte}</span>
        ))}
      </div>
    </div>
  );
}
