import { CreateOrganization } from "@clerk/nextjs";

export default function CreateOrganizationPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      {/* L'écran d'invitation intégré de Clerk s'affiche automatiquement après la
          création de l'Organization (email + rôle + bouton "passer cette étape") —
          pas besoin de le réimplémenter. afterCreateOrganizationUrl="/" laisse
          WaitForSync gérer l'attente de la synchro webhook puis la redirection vers /org. */}
      <CreateOrganization afterCreateOrganizationUrl="/" />
    </div>
  );
}
