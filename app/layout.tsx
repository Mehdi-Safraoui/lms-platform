import type { Metadata } from "next";
import { Martel_Sans, Winky_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/clerkAppearance";
import "./globals.css";

// Toute l'app (monde « ligne de métro ») : Winky Sans pour les titres et la
// signalétique, Martel Sans pour le texte.
const winky = Winky_Sans({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const martel = Martel_Sans({
  variable: "--font-text",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ahead LMS",
  description: "Plateforme de formation en ligne multi-tenant",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in" appearance={clerkAppearance} localization={clerkLocalization}>
      <html lang="fr" className={`${winky.variable} ${martel.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
