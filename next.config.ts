import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Épingle explicitement la racine du projet pour Turbopack — sans ça, un
  // lockfile qui traîne accidentellement dans un dossier parent (ex : résidu
  // d'un `npx` lancé depuis le mauvais répertoire) peut faire choisir ce
  // dossier parent comme racine, et Turbopack se met alors à scanner tout ce
  // dossier (potentiellement tout le profil utilisateur) au lieu du seul
  // projet — ralentissement massif constaté en pratique.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
