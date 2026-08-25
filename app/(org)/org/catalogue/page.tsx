import { redirect } from "next/navigation";

// La liste du catalogue Ahead est désormais fusionnée dans /org/formations
// (filtre "Ahead") — voir app/(org)/org/formations/page.tsx. Cette route reste
// pour ne pas casser d'anciens liens/marque-pages. /org/catalogue/[id] (fiche
// de contenu en lecture seule) reste inchangée, toujours utilisée depuis là.
export default function CataloguePage() {
  redirect("/org/formations");
}
