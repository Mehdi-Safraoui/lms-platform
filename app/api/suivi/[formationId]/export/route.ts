import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveAnalyticsScope } from "@/lib/api/require-analytics-viewer";
import { loadFormationAnalytics, type LearnerStatus } from "@/lib/formationAnalytics";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ formationId: string }> };

const STATUS_LABEL: Record<LearnerStatus, string> = {
  not_started: "Non commencé",
  in_progress: "En cours",
  completed: "Terminé",
};

// Séparateur ";" et BOM UTF-8 : ouverture directe et correcte dans Excel en
// français (accents, colonnes).
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function frDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR") : "";
}

// GET /api/suivi/[formationId]/export — export CSV du suivi d'une formation :
// une ligne par apprenant, puis une colonne par leçon (date de fin).
export async function GET(_req: NextRequest, { params }: Params) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const scope = await resolveAnalyticsScope(supabase, formationId);
  if (!scope) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const data = await loadFormationAnalytics(supabase, formationId, scope.tenantId);
  if (!data) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

  const showTenant = scope.tenantId === null;
  const header = [
    "Apprenant",
    "Email",
    ...(showTenant ? ["Entreprise"] : []),
    "Progression (%)",
    "Leçons terminées",
    "Temps passé (min)",
    "Score moyen aux quiz (%)",
    "Quiz réussis",
    "Dernière activité",
    "Statut",
    ...data.funnel.map((l, i) => `${i + 1}. ${l.title}`),
  ];
  const rows = data.learners.map((l) => [
    l.name,
    l.email,
    ...(showTenant ? [l.tenantName] : []),
    l.progressPct,
    `${l.completedLessons}/${l.totalLessons}`,
    l.timeMinutes,
    l.quizAvgPct,
    l.quizzesPassed,
    frDate(l.lastActivity),
    STATUS_LABEL[l.status],
    ...data.funnel.map((lesson) => frDate(l.completedAt[lesson.lessonId])),
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const filename = `suivi-${slugify(data.formation.title) || "formation"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
