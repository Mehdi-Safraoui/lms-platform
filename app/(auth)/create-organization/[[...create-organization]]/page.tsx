import { CreateOrganization } from "@clerk/nextjs";

export default function CreateOrganizationPage() {
  return (
    <>
      {/* skipInvitationScreen : l'écran d'invitation intégré de Clerk après
          création de l'Organization utilise organization.inviteMembers()
          (SDK client), qui ne supporte pas redirectUrl — un apprenant invité
          par ce biais atterrit sur les pages hébergées Clerk au lieu de l'app
          (vérifié en conditions réelles : ticket sans claim "rurl"). On force
          donc les invitations à passer uniquement par notre propre interface
          "Ajouter un apprenant" (app/api/org/apprenants/invite/route.ts), qui
          fixe explicitement ce redirectUrl. afterCreateOrganizationUrl="/"
          laisse WaitForSync gérer l'attente de la synchro webhook puis la
          redirection vers /org. */}
      <CreateOrganization afterCreateOrganizationUrl="/" skipInvitationScreen />
    </>
  );
}
