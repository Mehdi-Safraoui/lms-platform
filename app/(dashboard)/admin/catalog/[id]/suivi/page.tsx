import { notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveAnalyticsScope } from "@/lib/api/require-analytics-viewer";
import { loadFormationAnalytics } from "@/lib/formationAnalytics";
import FormationAnalyticsView from "@/components/analytics/FormationAnalyticsView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Suivi d'une formation du catalogue Ahead, tous tenants confondus.
export default async function AdminFormationSuiviPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const scope = await resolveAnalyticsScope(supabase, id);
  if (!scope || scope.role !== "super_admin") notFound();

  const data = await loadFormationAnalytics(supabase, id, null);
  if (!data) notFound();

  return (
    <FormationAnalyticsView
      data={data}
      backHref="/admin/catalog"
      backLabel="Catalogue"
      exportHref={`/api/suivi/${id}/export`}
      showTenant
    />
  );
}
