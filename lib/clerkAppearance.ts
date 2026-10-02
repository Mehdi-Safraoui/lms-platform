import { frFR } from "@clerk/localizations";

/**
 * Apparence commune des composants Clerk (connexion, inscription, création
 * d'entreprise, profil) : couleurs et polices du monde « ligne de métro »
 * (voir DESIGN.md), registre calme. Appliquée une fois sur <ClerkProvider>.
 * Le cadre autour du widget est dans app/(auth)/layout.tsx.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1d46e5",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "#17183b",
    colorMutedForeground: "#4b5276",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#17183b",
    colorBorder: "#d6dcea",
    colorNeutral: "#17183b",
    colorDanger: "#b4232a",
    colorSuccess: "#16794a",
    colorRing: "rgba(29, 70, 229, 0.35)",
    colorShadow: "rgba(23, 24, 59, 0.08)",
    fontFamily: "var(--font-text), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-text), system-ui, sans-serif",
    fontSize: "15px",
    borderRadius: "10px",
  },
  options: {
    // Le cadre de la page porte déjà le logo et la marque : le widget reste à plat.
    elevation: "flush" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    headerTitle: {
      fontFamily: "var(--font-display), sans-serif",
      fontSize: "28px",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      color: "#17183b",
    },
    headerSubtitle: { fontSize: "15px", color: "#4b5276" },
    formFieldLabel: { fontWeight: 600, color: "#17183b" },
    // Bordure des champs : voir app/(auth)/auth.module.css (Clerk atténue colorBorder).
    formFieldInput: { height: "44px" },
    // Bouton plat (sans le dégradé ni l'ombre par défaut de Clerk).
    formButtonPrimary: {
      height: "44px",
      fontSize: "15px",
      fontWeight: 700,
      textTransform: "none" as const,
      boxShadow: "none",
      backgroundImage: "none",
      "&::after": { display: "none" },
      "&:hover": { backgroundColor: "#1838b8" },
    },
    footerActionLink: { fontWeight: 700, color: "#1d46e5" },
    identityPreviewEditButton: { color: "#1d46e5" },
  },
};

/**
 * Textes Clerk en français, avec le vocabulaire de l'app : on parle
 * d'« entreprise » plutôt que d'« organisation ».
 */
export const clerkLocalization = {
  ...frFR,
  signIn: {
    ...frFR.signIn,
    start: {
      ...frFR.signIn?.start,
      title: "Connexion",
      subtitle: "Retrouvez vos formations là où vous les avez laissées.",
    },
    password: {
      ...frFR.signIn?.password,
      subtitle: "Pour accéder à Ahead Learning.",
    },
  },
  signUp: {
    ...frFR.signUp,
    start: {
      ...frFR.signUp?.start,
      title: "Créer votre compte",
      subtitle: "Pour démarrer Ahead Learning dans votre entreprise.",
    },
  },
  createOrganization: {
    ...frFR.createOrganization,
    title: "Créer votre espace entreprise",
    formButtonSubmit: "Créer l'espace",
  },
  formFieldLabel__organizationName: "Nom de l'entreprise",
  formFieldInputPlaceholder__organizationName: "Nom de votre entreprise",
  // Absent de la traduction française fournie par Clerk.
  formFieldInputPlaceholder__signUpPassword: "Choisissez un mot de passe",
};
