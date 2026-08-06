import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) résout son worker via un chemin relatif ("./pdf.worker.mjs")
  // au runtime. Si Next.js bundle ce module, ce chemin ne pointe plus vers rien
  // (erreur "Setting up fake worker failed"). En le laissant en dépendance externe,
  // il est require() normalement depuis node_modules et la résolution reste correcte.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
