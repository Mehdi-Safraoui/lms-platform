import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { notifySubscriptionActivated } from "@/lib/notifications";

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_DECOUVERTE ?? ""]: "decouverte",
  [process.env.STRIPE_PRICE_CREATION ?? ""]: "creation",
  [process.env.STRIPE_PRICE_ENTREPRISE ?? ""]: "entreprise",
};

// Même valeurs que le backfill de la migration 20260823000004 — gardées en
// phase ici pour qu'un tenant qui active/change d'offre reparte avec le bon
// quota, pas seulement les tenants déjà existants au moment de la migration.
const QUOTA_BY_PLAN: Record<string, number> = {
  decouverte: 0,
  creation: 30,
  entreprise: 100,
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "stripe-signature manquant" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe webhook] signature invalide:", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const tenantId = session.metadata?.tenant_id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (!tenantId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id ?? "";
      const plan = PRICE_TO_PLAN[priceId] ?? null;

      const { data: updatedTenant, error } = await supabase
        .from("tenants")
        .update({
          subscription_plan: plan,
          subscription_status: "active",
          stripe_subscription_id: subscriptionId,
          cancel_at_period_end: false,
          ai_generation_quota: plan ? QUOTA_BY_PLAN[plan] : null,
          ai_generation_used: 0,
        })
        .eq("id", tenantId)
        .select("name")
        .single();

      if (error) {
        console.error("[stripe webhook] checkout.session.completed update error:", error);
      } else {
        console.log(`[stripe webhook] tenant ${tenantId} → plan=${plan} active`);
        try {
          await notifySubscriptionActivated(tenantId, updatedTenant?.name ?? "Votre entreprise", plan);
        } catch (notifError) {
          console.error("[stripe webhook] notifySubscriptionActivated error:", notifError);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;

      if (!customerId) break;

      const { error } = await supabase
        .from("tenants")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId);

      if (error) console.error("[stripe webhook] invoice.payment_failed update error:", error);
      else console.log(`[stripe webhook] customer ${customerId} → past_due`);
      break;
    }

    case "customer.subscription.updated": {
      // Le Customer Portal est configuré en mode "at_period_end" (vérifié via
      // stripe.billingPortal.configurations.list()) : annuler ne supprime pas
      // l'abonnement tout de suite, ça programme juste cancel_at_period_end
      // pour la fin de la période payée — status reste "active" jusque-là, et
      // seul cet event (jamais customer.subscription.deleted, qui n'arrive
      // qu'à l'échéance réelle) permet de le savoir avant. Sans ce handler,
      // rien ne distingue "actif, se renouvelle normalement" de "actif, mais
      // ne se renouvellera pas" tant que la période n'est pas terminée.
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

      if (!customerId) break;

      // Un changement de plan via le Portail Stripe (upgrade/downgrade) déclenche
      // ce même event, jamais checkout.session.completed (réservé au tout premier
      // abonnement) — sans relire le prix ici, subscription_plan et le quota IA
      // restaient figés sur l'ancien plan après un changement fait depuis le
      // portail. ai_generation_used n'est volontairement pas remis à zéro ici
      // (seulement à un nouveau checkout) pour éviter un contournement du quota
      // par un downgrade/upgrade successif.
      const newPriceId = subscription.items.data[0]?.price.id ?? "";
      const newPlan = PRICE_TO_PLAN[newPriceId] ?? null;

      const { error } = await supabase
        .from("tenants")
        .update({
          subscription_status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          ...(newPlan && { subscription_plan: newPlan, ai_generation_quota: QUOTA_BY_PLAN[newPlan] }),
        })
        .eq("stripe_customer_id", customerId);

      if (error) console.error("[stripe webhook] subscription.updated update error:", error);
      else
        console.log(
          `[stripe webhook] customer ${customerId} → status=${subscription.status} cancel_at_period_end=${subscription.cancel_at_period_end}`
        );
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

      if (!customerId) break;

      const { error } = await supabase
        .from("tenants")
        .update({
          subscription_status: "canceled",
          subscription_plan: null,
          stripe_subscription_id: null,
          cancel_at_period_end: false,
        })
        .eq("stripe_customer_id", customerId);

      if (error) console.error("[stripe webhook] subscription.deleted update error:", error);
      else console.log(`[stripe webhook] customer ${customerId} → canceled`);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
