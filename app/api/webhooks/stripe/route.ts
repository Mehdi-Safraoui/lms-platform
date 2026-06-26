/**
 * Route Handler — Webhook Stripe
 * Reçoit les événements Stripe (subscription created/updated/deleted, etc.)
 * et met à jour le statut d'abonnement du tenant en base.
 *
 * IMPORTANT : cette route doit être publique (non protégée par Clerk).
 * La vérification d'authenticité se fait via la signature Stripe (stripe-signature header).
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: implémenter lors de l'intégration Stripe
  return NextResponse.json({ received: true });
}
