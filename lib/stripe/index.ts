import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

export const PLANS = {
  decouverte: {
    name: "Découverte",
    priceId: process.env.STRIPE_PRICE_DECOUVERTE!,
    price: "49€",
    period: "/ mois",
    description: "Idéal pour commencer et explorer la plateforme.",
    features: [
      "Jusqu'à 5 apprenants",
      "Accès au catalogue de formations",
      "Aperçu des leçons (mode preview)",
      "Tableau de bord basique",
    ],
  },
  creation: {
    name: "Création",
    priceId: process.env.STRIPE_PRICE_CREATION!,
    price: "149€",
    period: "/ mois",
    description: "Pour les équipes qui forment activement.",
    features: [
      "Jusqu'à 30 apprenants",
      "Accès complet à toutes les formations",
      "Quiz et attestations",
      "Suivi de progression",
      "Support prioritaire",
    ],
  },
  entreprise: {
    name: "Entreprise",
    priceId: process.env.STRIPE_PRICE_ENTREPRISE!,
    price: "Sur devis",
    period: "",
    description: "Pour les grandes organisations avec des besoins spécifiques.",
    features: [
      "Apprenants illimités",
      "Analytics avancés",
      "SSO & intégrations",
      "SLA garanti",
      "Accompagnement dédié",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;
