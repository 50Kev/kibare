import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { MsgType } from "matrix-js-sdk";
import { useLangue } from "../i18n/langue.jsx";
import { ouvrirFichier } from "../matrix/fichiers.js";

function taille(octets = 0) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

export default function PieceJointe({ client, contenu }) {
  const { t } = useLangue();
  const [image, setImage] = useState(null);
  const [erreur, setErreur] = useState(false);
  const estImage = contenu.msgtype === MsgType.Image;

  useEffect(() => {
    if (!estImage) return;
    let adresse;
    ouvrirFichier(client, contenu)
      .then((blob) => {
        adresse = URL.createObjectURL(blob);
        setImage(adresse);
      })
      .catch(() => setErreur(true));
    return () => adresse && URL.revokeObjectURL(adresse);
  }, [client, contenu, estImage]);

  async function telecharger() {
    try {
      const blob = await ouvrirFichier(client, contenu);
      const adresse = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = adresse;
      lien.download = contenu.body || "fichier";
      lien.click();
      setTimeout(() => URL.revokeObjectURL(adresse), 2000);
    } catch {
      setErreur(true);
    }
  }

  if (erreur) return <p className="piece-erreur">{t("fichier_erreur")}</p>;
  if (estImage && image) return <img className="piece-image" src={image} alt={contenu.body} />;

  return (
    <button className="piece" onClick={telecharger}>
      <FileText size={26} />
      <span>
        <strong>{contenu.body}</strong>
        <small>{taille(contenu.info?.size)}</small>
      </span>
      <Download size={18} />
    </button>
  );
}
