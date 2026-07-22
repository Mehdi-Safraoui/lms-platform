import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_DECOUVERTE ?? ""]: "decouverte",
  [process.env.STRIPE_PRICE_CREATION ?? ""]: "creation",
  [process.env.STRIPE_PRICE_ENTREPRISE ?? ""]: "entreprise",
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

      const { error } = await supabase
        .from("tenants")
        .update({
          subscription_plan: plan,
          subscription_status: "active",
          stripe_subscription_id: subscriptionId,
        })
        .eq("id", tenantId);

      if (error) console.error("[stripe webhook] checkout.session.completed update error:", error);
      else console.log(`[stripe webhook] tenant ${tenantId} → plan=${plan} active`);
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
