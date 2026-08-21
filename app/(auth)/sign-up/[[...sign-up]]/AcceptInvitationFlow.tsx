"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import styles from "./acceptInvitation.module.css";

/**
 * Le composant prébuilt <SignUp/> de Clerk ne gère pas correctement les
 * tickets d'invitation d'Organization (st: "organization_invitation") : même
 * avec forceRedirectUrl fourni, la finalisation de l'inscription se fait côté
 * pages hébergées Clerk (accounts.dev/default-redirect) plutôt que dans l'app
 * — vérifié en conditions réelles, et documenté par Clerk comme nécessitant
 * un flux personnalisé (voir accept-organization-invitations dans leurs docs).
 * Ce composant réimplémente donc ce flux à la main, avec l'API "Future"
 * (signUp/signIn.create + .finalize) exposée par useSignUp()/useSignIn() dans
 * cette version du SDK :
 * - __clerk_status=sign_up → l'email invité n'a pas encore de compte Clerk,
 *   on demande prénom/nom/mot de passe puis on complète signUp.create().
 * - __clerk_status=sign_in → l'email invité a déjà un compte Clerk existant
 *   (ex. admin ré-invité comme apprenant), on connecte directement via le
 *   ticket, sans formulaire.
 * Dans les deux cas, finalize() active la session et navigue vers "/", qui
 * route déjà selon le rôle (voir app/page.tsx) — donc vers /apprenant pour
 * un apprenant, sans jamais repasser par les pages hébergées Clerk.
 *
 * Cas supplémentaire géré : si le navigateur a déjà une session Clerk active
 * (ex. quelqu'un qui vient de créer un compte admin clique le lien d'un
 * apprenant dans le même onglet) — Clerk ne peut pas traiter un ticket pour
 * une autre identité pendant qu'une session existe, et retombe sur ses pages
 * hébergées. On déconnecte donc systématiquement toute session active avant
 * de traiter le ticket, plutôt que de compter sur un test en navigation
 * privée — vérifié en conditions réelles comme cause de blocage.
 */
export default function AcceptInvitationFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");
  const status = searchParams.get("__clerk_status");

  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const signOutTriggered = React.useRef(false);
  const signInAttempted = React.useRef(false);

  React.useEffect(() => {
    if (!authLoaded || !isSignedIn || signOutTriggered.current) return;
    signOutTriggered.current = true;
    // Redéclenche cette même page (ticket toujours dans l'URL) une fois
    // déconnecté, pour repartir sur une session propre.
    void signOut({ redirectUrl: window.location.href });
  }, [authLoaded, isSignedIn, signOut]);

  // Navigation post-finalize commune aux deux flux (sign-in et sign-up) : pas
  // de tâche d'onboarding custom dans cette app, donc on navigue toujours
  // vers "/", qui route selon le rôle une fois la session active.
  function navigateHome({ session, decorateUrl }: { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string }) {
    if (session?.currentTask) return;
    const url = decorateUrl("/");
    if (url.startsWith("http")) window.location.href = url;
    else router.push(url);
  }

  React.useEffect(() => {
    // On attend confirmation qu'aucune session ne subsiste (authLoaded &&
    // !isSignedIn) avant de traiter le ticket, sinon Clerk le refuse.
    if (status !== "sign_in" || !ticket || !signIn || !authLoaded || isSignedIn || signInAttempted.current) return;
    signInAttempted.current = true;

    (async () => {
      const { error: createError } = await signIn.create({ strategy: "ticket", ticket });
      if (createError) {
        setError(createError.longMessage ?? createError.message);
        return;
      }
      if (signIn.status !== "complete") {
        setError("Connexion incomplète. Réessayez depuis le lien reçu par email.");
        return;
      }
      const { error: finalizeError } = await signIn.finalize({ navigate: navigateHome });
      if (finalizeError) setError(finalizeError.longMessage ?? finalizeError.message);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigateHome est stable en pratique (ne dépend que de router)
  }, [status, ticket, signIn, authLoaded, isSignedIn]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    // `submitting` bloque tout second appel pendant que le premier est en
    // cours — sans ça, le bouton se réactivait avant la fin de la redirection
    // (qui passe par "/" puis un routage par rôle, pas instantané), laissant
    // le temps à un double clic de renvoyer signUp.create() sur un ticket déjà
    // consommé par la première tentative ("already been accepted").
    if (!ticket || !signUp || isSignedIn || submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: createError } = await signUp.create({
      strategy: "ticket",
      ticket,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    });
    if (createError) {
      setError(createError.longMessage ?? createError.message);
      setSubmitting(false);
      return;
    }
    if (signUp.status !== "complete") {
      setError("Inscription incomplète. Vérifiez les champs et réessayez.");
      setSubmitting(false);
      return;
    }
    // Succès : on laisse submitting à true jusqu'à la redirection effective
    // (le bouton reste désactivé) — ne le réinitialise que si finalize échoue.
    const { error: finalizeError } = await signUp.finalize({ navigate: navigateHome });
    if (finalizeError) {
      setError(finalizeError.longMessage ?? finalizeError.message);
      setSubmitting(false);
    }
  }

  const brand = (
    <div className={styles.brand}>
      <div className={styles.brandMark}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14 13H2L8 2Z" fill="white" strokeWidth="0" />
        </svg>
      </div>
      <span className={styles.brandText}>
        ahead<span>·</span>
        <em>digital</em>
      </span>
    </div>
  );

  let content: React.ReactNode;

  if (!ticket) {
    content = <p className={styles.message}>Lien d&apos;invitation invalide ou expiré.</p>;
  } else if (!authLoaded || isSignedIn) {
    content = (
      <p className={styles.message}>
        {error ?? "Déconnexion de votre session actuelle pour accepter cette invitation…"}
      </p>
    );
  } else if (status === "sign_in") {
    content = <p className={styles.message}>{error ?? "Connexion en cours…"}</p>;
  } else {
    content = (
      <div className={styles.card}>
        <h1 className={styles.title}>Créer votre compte</h1>
        <p className={styles.subtitle}>
          Complétez vos informations pour rejoindre votre organisation sur LMS Platform.
        </p>
        <form onSubmit={handleSignUp} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="firstName">Prénom</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="lastName">Nom</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Mot de passe</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
              </button>
            </div>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {/* Requis par Clerk si la protection anti-bot (Smart CAPTCHA) est
              activée sur l'instance ; sans effet visuel sinon. */}
          <div id="clerk-captcha" />
          <button type="submit" className={styles.submit} disabled={submitting || !signUp}>
            {submitting ? "Création…" : "Créer mon compte"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {brand}
      {content}
    </>
  );
}
