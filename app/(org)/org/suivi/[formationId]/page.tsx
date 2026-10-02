import { notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveAnalyticsScope } from "@/lib/api/require-analytics-viewer";
import { loadFormationAnalytics } from "@/lib/formationAnalytics";
import FormationAnalyticsView from "@/components/analytics/FormationAnalyticsView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ formationId: string }> };

export default async function OrgFormationSuiviPage({ params }: Props) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const scope = await resolveAnalyticsScope(supabase, formationId);
  if (!scope || scope.tenantId === null) notFound();

  const data = await loadFormationAnalytics(supabase, formationId, scope.tenantId);
  if (!data) notFound();

  return (
    <FormationAnalyticsView
      data={data}
      backHref="/org/suivi"
      backLabel="Suivi des formations"
      exportHref={`/api/suivi/${formationId}/export`}
      showTenant={false}
      rewardMode={scope.role === "admin_tenant" ? "edit" : "view"}
    />
  );
}
