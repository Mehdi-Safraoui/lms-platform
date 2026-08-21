import { SignUp } from "@clerk/nextjs";
import AcceptInvitationFlow from "./AcceptInvitationFlow";
import styles from "./acceptInvitation.module.css";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams;

  // Un apprenant (ou un admin) invité arrive ici via un lien d'invitation
  // Clerk (ticket, voir app/api/org/apprenants/invite/route.ts et
  // app/api/admin/tenants/route.ts) : il rejoint une Organization existante.
  // Le composant prébuilt <SignUp/> ne gère pas correctement ce cas — voir
  // le commentaire détaillé dans AcceptInvitationFlow.tsx — donc on bascule
  // sur un flux personnalisé dès qu'un ticket est présent dans l'URL.
  const isInvitationTicket = typeof params.__clerk_ticket === "string";

  return (
    <div className={styles.wrap}>
      {isInvitationTicket ? <AcceptInvitationFlow /> : <SignUp />}
    </div>
  );
}
