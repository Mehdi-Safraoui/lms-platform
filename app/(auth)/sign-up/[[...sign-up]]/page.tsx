import { SignUp } from "@clerk/nextjs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams;

  // Un apprenant invité arrive ici via un lien d'invitation Clerk (ticket, voir
  // app/api/org/apprenants/invite/route.ts) : il rejoint une Organization existante,
  // il ne doit donc PAS suivre NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL
  // (=/create-organization, réservé à l'auto-inscription d'un nouvel admin_tenant —
  // voir ARCHITECTURE.md, chemin B). forceRedirectUrl="/" prend le pas sur cette
  // variable d'env pour ce rendu précis et laisse WaitForSync router selon le rôle.
  const isInvitationTicket = typeof params.__clerk_ticket === "string";

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      {isInvitationTicket ? <SignUp forceRedirectUrl="/" /> : <SignUp />}
    </div>
  );
}
