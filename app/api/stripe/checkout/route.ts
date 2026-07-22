import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  if (!guard.tenantId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { priceId } = await req.json();
  if (!priceId) {
    return NextResponse.json({ error: "priceId requis" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, stripe_customer_id")
    .eq("id", guard.tenantId)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", guard.userId)
    .single();

  let customerId: string = tenant.stripe_customer_id ?? "";

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: tenant.name,
      metadata: { tenant_id: tenant.id },
    });
    customerId = customer.id;

    await supabase
      .from("tenants")
      .update({ stripe_customer_id: customerId })
      .eq("id", tenant.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/org?checkout=success`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { tenant_id: tenant.id },
  });

  return NextResponse.json({ url: session.url });
}
