import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { stripe } from "@/lib/stripe";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  if (!guard.tenantId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", guard.tenantId)
    .single();

  if (!tenant?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun abonnement Stripe associé" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${appUrl}/org/abonnement`,
  });

  return NextResponse.json({ url: session.url });
}
