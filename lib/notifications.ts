import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const SUBSCRIPTION_REQUEST_COOLDOWN_HOURS = 24;

const PLAN_LABEL: Record<string, string> = {
  decouverte: "Découverte",
  creation: "Création",
  entreprise: "Entreprise",
};

export async function notifySubscriptionActivated(
  tenantId: string,
  tenantName: string,
  plan: string | null
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const planLabel = (plan && PLAN_LABEL[plan]) || "sélectionnée";

  const [{ data: apprenants }, { data: superAdmins }] = await Promise.all([
    supabase.from("users").select("id").eq("tenant_id", tenantId).eq("role", "apprenant"),
    supabase.from("users").select("id").eq("role", "super_admin"),
  ]);

  const rows = [
    ...(apprenants ?? []).map((u) => ({
      tenant_id: tenantId,
      recipient_user_id: u.id,
      sender_user_id: null,
      type: "subscription_activated",
      message: `Votre entreprise a activé l'offre ${planLabel}. Vous avez maintenant accès à l'intégralité du contenu.`,
    })),
    ...(superAdmins ?? []).map((u) => ({
      tenant_id: tenantId,
      recipient_user_id: u.id,
      sender_user_id: null,
      type: "subscription_activated",
      message: `${tenantName} a souscrit à l'offre ${planLabel}.`,
    })),
  ];

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}

export async function notifyAdminsOfSubscriptionRequest(
  tenantId: string,
  senderUserId: string,
  senderName: string
): Promise<{ alreadySent: boolean; notified: number }> {
  const supabase = createServiceRoleSupabaseClient();

  const cooldownSince = new Date(
    Date.now() - SUBSCRIPTION_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recent } = await supabase
    .from("notifications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sender_user_id", senderUserId)
    .eq("type", "subscription_request")
    .gte("created_at", cooldownSince)
    .limit(1);

  if (recent && recent.length > 0) {
    return { alreadySent: true, notified: 0 };
  }

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "admin_tenant");

  if (!admins?.length) {
    return { alreadySent: false, notified: 0 };
  }

  const message = `${senderName} signale que l'abonnement de votre espace a expiré ou n'est plus actif et souhaite pouvoir continuer à accéder au contenu.`;

  const { error } = await supabase.from("notifications").insert(
    admins.map((admin) => ({
      tenant_id: tenantId,
      recipient_user_id: admin.id,
      sender_user_id: senderUserId,
      type: "subscription_request",
      message,
    }))
  );

  if (error) throw error;

  return { alreadySent: false, notified: admins.length };
}
