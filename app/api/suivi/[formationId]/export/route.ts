import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveAnalyticsScope } from "@/lib/api/require-analytics-viewer";
import { loadFormationAnalytics, type LearnerStatus } from "@/lib/formationAnalytics";
import { slugify } from "@/lib/slug";
import { MERIT_LABEL } from "@/lib/merit";

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
// ?eligibles=1 : seulement les apprenants ayant atteint l'objectif au mérite.
export async function GET(req: NextRequest, { params }: Params) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const scope = await resolveAnalyticsScope(supabase, formationId);
  if (!scope) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const data = await loadFormationAnalytics(supabase, formationId, scope.tenantId);
  if (!data) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

  const showTenant = scope.tenantId === null;
  const reward = data.reward;
  const onlyEligible = !!reward && req.nextUrl.searchParams.get("eligibles") === "1";
  const learners = onlyEligible ? data.learners.filter((l) => l.merit.status === "eligible") : data.learners;
  const header = [
    "Apprenant",
    "Email",
    ...(showTenant ? ["Entreprise"] : []),
    "Progression (%)",
    "Leçons terminées",
    "Temps passé (min)",
    "Score moyen aux quiz (%)",
    "Quiz réussis",
    ...(reward ? ["Score 1re tentative (%)", "Quiz faits", `Objectif ${reward.minScorePct} % (${reward.rewardLabel})`] : []),
    "Dernière activité",
    "Statut",
    ...data.funnel.map((l, i) => `${i + 1}. ${l.title}`),
  ];
  const rows = learners.map((l) => [
    l.name,
    l.email,
    ...(showTenant ? [l.tenantName] : []),
    l.progressPct,
    `${l.completedLessons}/${l.totalLessons}`,
    l.timeMinutes,
    l.quizAvgPct,
    l.quizzesPassed,
    ...(reward ? [l.merit.scorePct, `${l.merit.quizzesTaken}/${l.merit.totalQuizzes}`, l.merit.status ? MERIT_LABEL[l.merit.status] : ""] : []),
    frDate(l.lastActivity),
    STATUS_LABEL[l.status],
    ...data.funnel.map((lesson) => frDate(l.completedAt[lesson.lessonId])),
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const filename = `${onlyEligible ? "eligibles" : "suivi"}-${slugify(data.formation.title) || "formation"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
