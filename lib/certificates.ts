import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

export interface Certificate {
  id: string;
  user_id: string;
  formation_id: string;
  learner_name: string;
  formation_title: string;
  organization_name: string | null;
  completion_pct: number;
  issued_at: string;
}

export interface CertificateStatus {
  completed: number;
  total: number;
  completionPct: number;
  thresholdPct: number;
  eligible: boolean;
  certificate: Certificate | null;
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function certificateUrl(id: string): string {
  return `${appBaseUrl()}/certificats/${id}`;
}

/**
 * État du certificat d'un apprenant pour une formation, et délivrance
 * automatique dès que le seuil de complétion est atteint (une leçon quiz
 * n'est terminée qu'une fois le quiz réussi). Un certificat déjà délivré
 * reste valable même si la formation change ensuite.
 */
export async function getOrIssueCertificate(supabase: Supabase, userId: string, formationId: string): Promise<CertificateStatus> {
  const [{ data: formation }, { data: existing }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, attestation_threshold_pct, modules(lecons(id))")
      .eq("id", formationId)
      .single(),
    supabase.from("certificates").select("*").eq("user_id", userId).eq("formation_id", formationId).maybeSingle(),
  ]);

  const lessonIds = ((formation?.modules ?? []) as { lecons: { id: string }[] }[]).flatMap((m) => (m.lecons ?? []).map((l) => l.id));
  const { count } = lessonIds.length
    ? await supabase
        .from("progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .in("lecon_id", lessonIds)
    : { count: 0 };

  const completed = count ?? 0;
  const total = lessonIds.length;
  const completionPct = total ? Math.round((completed / total) * 100) : 0;
  const thresholdPct = formation?.attestation_threshold_pct ?? 80;
  const eligible = total > 0 && completionPct >= thresholdPct;

  if (existing || !eligible || !formation) {
    return { completed, total, completionPct, thresholdPct, eligible, certificate: (existing as Certificate | null) ?? null };
  }

  const { data: user } = await supabase.from("users").select("full_name, email, tenant_id").eq("id", userId).single();
  const { data: tenant } = user?.tenant_id
    ? await supabase.from("tenants").select("name").eq("id", user.tenant_id).single()
    : { data: null };

  const { data: certificate } = await supabase
    .from("certificates")
    .upsert(
      {
        user_id: userId,
        formation_id: formationId,
        tenant_id: user?.tenant_id ?? null,
        learner_name: user?.full_name || user?.email || "Apprenant",
        formation_title: formation.title,
        organization_name: tenant?.name ?? null,
        completion_pct: completionPct,
      },
      { onConflict: "user_id,formation_id", ignoreDuplicates: false }
    )
    .select("*")
    .single();

  return { completed, total, completionPct, thresholdPct, eligible, certificate: (certificate as Certificate | null) ?? null };
}

/** Lien LinkedIn « Ajouter à mon profil » (rubrique Licences et certifications). */
export function linkedinAddToProfileUrl(certificate: Certificate): string {
  const issued = new Date(certificate.issued_at);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: certificate.formation_title,
    organizationName: "Ahead Digital",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: certificateUrl(certificate.id),
    certId: certificate.id,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function formatCertificateDate(iso: string): string {
  const formatted = new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  // Usage français : « 1er octobre », pas « 1 octobre ».
  return formatted.replace(/^1 /, "1er ");
}

// ── PDF ───────────────────────────────────────────────────────────────────

const NAVY = rgb(0x19 / 255, 0x17 / 255, 0x38 / 255);
const CORAL = rgb(0xe8 / 255, 0x60 / 255, 0x3a / 255);
const MUTED = rgb(0x64 / 255, 0x74 / 255, 0x8b / 255);

// Les polices standard des PDF n'encodent que le jeu Windows-1252 (latin +
// ponctuation française) : tout autre caractère (emoji, alphabets non
// latins) est ramené à sa forme sans accent, ou retiré, plutôt que de faire
// échouer la génération.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfSafe(text: string): string {
  return [...text.normalize("NFC")]
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      if (code === 0x09 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.includes(c)) return c;
      return c.normalize("NFKD").replace(/[^\x20-\x7e]/g, "");
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildCertificatePdf(certificate: Certificate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Certificat — ${certificate.formation_title}`));
  pdf.setAuthor("Ahead Digital");
  pdf.setSubject(pdfSafe(`Certificat de réussite de ${certificate.learner_name}`));

  const page = pdf.addPage([842, 595]); // A4 paysage
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const centered = (text: string, y: number, font: PDFFont, size: number, color = NAVY) => {
    const safe = pdfSafe(text);
    page.drawText(safe, { x: (width - font.widthOfTextAtSize(safe, size)) / 2, y, size, font, color });
  };

  // Cadre : filet corail intérieur et bandeau marine en tête.
  page.drawRectangle({ x: 0, y: height - 14, width, height: 14, color: NAVY });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 70, borderColor: CORAL, borderWidth: 1.2 });

  centered("AHEAD DIGITAL", height - 92, bold, 13, NAVY);
  centered("CERTIFICAT DE RÉUSSITE", height - 128, bold, 22, CORAL);
  centered("Décerné à", height - 178, regular, 13, MUTED);

  const nameSize = Math.min(36, (width - 160) / Math.max(1, bold.widthOfTextAtSize(pdfSafe(certificate.learner_name), 1)));
  centered(certificate.learner_name, height - 224, bold, nameSize, NAVY);

  centered("pour avoir suivi avec succès la formation", height - 266, regular, 13, MUTED);
  const titleLines = wrap(pdfSafe(certificate.formation_title), bold, 20, width - 200).slice(0, 3);
  titleLines.forEach((line, i) => centered(line, height - 302 - i * 26, bold, 20, NAVY));

  const afterTitle = height - 302 - titleLines.length * 26 - 14;
  if (certificate.organization_name) {
    centered(`au sein de ${certificate.organization_name}`, afterTitle, regular, 12, MUTED);
  }
  const ruleY = afterTitle - 42;
  page.drawRectangle({ x: width / 2 - 30, y: ruleY, width: 60, height: 2, color: CORAL });

  // Pied : date et complétion à gauche, vérification à droite.
  const footerY = 66;
  page.drawText(pdfSafe(`Délivré le ${formatCertificateDate(certificate.issued_at)}`), { x: 60, y: footerY + 16, size: 11, font: bold, color: NAVY });
  page.drawText(pdfSafe(`Taux de complétion : ${certificate.completion_pct} %`), { x: 60, y: footerY, size: 10, font: regular, color: MUTED });

  const verify = pdfSafe(`Vérifier : ${certificateUrl(certificate.id)}`);
  const idLine = pdfSafe(`Identifiant : ${certificate.id}`);
  const rightX = (text: string, size: number, font: PDFFont) => width - 60 - font.widthOfTextAtSize(text, size);
  page.drawText(verify, { x: rightX(verify, 9, regular), y: footerY + 16, size: 9, font: regular, color: MUTED });
  page.drawText(idLine, { x: rightX(idLine, 9, regular), y: footerY, size: 9, font: regular, color: MUTED });

  return pdf.save();
}
