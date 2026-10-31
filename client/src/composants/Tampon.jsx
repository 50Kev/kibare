import { useLangue } from "../i18n/langue.jsx";

export default function Tampon({ niveau }) {
  const { t } = useLangue();
  if (niveau === "normal") return null;
  return <span className={`tampon tampon-${niveau}`}>{t(`niveau_${niveau}`)}</span>;
}
