import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ChevronRight } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { loadFormationsOverview } from "@/lib/formationAnalytics";
import styles from "./suivi.module.css";

export const dynamic = "force-dynamic";

export default async function OrgSuiviPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  if (!user?.tenant_id || !["admin_tenant", "tuteur"].includes(user.role)) redirect("/org");

  const rows = await loadFormationsOverview(supabase, user.tenant_id);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Suivi des formations</h1>
        <p className={styles.subtitle}>
          Progression de vos apprenants formation par formation : où ils en sont, où ils décrochent, ce qu&apos;ils ont compris.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucune formation publiée ou activée pour l&apos;instant.</p>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <Link key={row.id} href={`/org/suivi/${row.id}`} className={styles.row}>
              <BarChart3 size={18} className={styles.rowIcon} />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{row.title}</span>
                <span className={styles.rowMeta}>
                  <span className={row.source === "ahead" ? styles.badgeAhead : styles.badgeOwn}>
                    {row.source === "ahead" ? "Catalogue Ahead" : "Votre formation"}
                  </span>
                  {row.learners} apprenant{row.learners > 1 ? "s" : ""} inscrit{row.learners > 1 ? "s" : ""}
                </span>
              </span>
              <span className={styles.rowStat}>
                <span className={styles.rowStatValue}>{row.avgProgressPct === null ? "—" : `${row.avgProgressPct} %`}</span>
                <span className={styles.rowStatLabel}>progression moyenne</span>
              </span>
              <span className={styles.rowStat}>
                <span className={styles.rowStatValue}>{row.completionRatePct === null ? "—" : `${row.completionRatePct} %`}</span>
                <span className={styles.rowStatLabel}>ont terminé</span>
              </span>
              <ChevronRight size={16} className={styles.rowChevron} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
