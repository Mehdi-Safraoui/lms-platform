import type { Metadata } from "next";
import { Barlow, Martel_Sans, Plus_Jakarta_Sans, Winky_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Espace apprenant (ligne de métro) : Winky Sans pour la signalétique
// (titres, plaques, stations), Martel Sans pour la lecture.
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
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="fr" className={`${jakarta.variable} ${barlow.variable} ${winky.variable} ${martel.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
