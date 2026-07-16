"use client";

import { useState, useMemo } from "react";
import { Users, Search } from "lucide-react";
import styles from "./apprenants.module.css";

interface Apprenant {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface Formation {
  id: string;
  title: string;
  lessonIds: string[];
}

interface ProgressRecord {
  user_id: string;
  lecon_id: string;
  status: string;
  updated_at: string;
}

interface Props {
  apprenants: Apprenant[];
  formations: Formation[];
  progressRecords: ProgressRecord[];
}

function getCompletion(userId: string, lessonIds: string[], records: ProgressRecord[]) {
  if (!lessonIds.length) return { completed: 0, total: 0, pct: 0 };
  const completed = records.filter((p) => p.user_id === userId && lessonIds.includes(p.lecon_id) && p.status === "completed").length;
  return { completed, total: lessonIds.length, pct: Math.round((completed / lessonIds.length) * 100) };
}

function getLastActivity(userId: string, records: ProgressRecord[]): string | null {
  const userRecords = records.filter((p) => p.user_id === userId);
  if (!userRecords.length) return null;
  const latest = userRecords.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  return latest.updated_at;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ApprenantTable({ apprenants, formations, progressRecords }: Props) {
  const [selectedFormation, setSelectedFormation] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_started" | "in_progress" | "completed">("all");

  const currentFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormation) ?? null,
    [formations, selectedFormation]
  );

  const lessonIds = currentFormation?.lessonIds ?? formations.flatMap((f) => f.lessonIds);

  const rows = useMemo(() => {
    return apprenants
      .filter((a) => {
        const name = a.full_name ?? a.email;
        if (search && !name.toLowerCase().includes(search.toLowerCase()) && !a.email.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .map((a) => {
        const { completed, total, pct } = getCompletion(a.id, lessonIds, progressRecords);
        const lastActivity = getLastActivity(a.id, progressRecords);
        const status: "not_started" | "in_progress" | "completed" =
          completed === 0 ? "not_started" : pct === 100 ? "completed" : "in_progress";
        return { ...a, completed, total, pct, lastActivity, status };
      })
      .filter((a) => statusFilter === "all" || a.status === statusFilter);
  }, [apprenants, lessonIds, progressRecords, search, statusFilter]);

  const STATUS_LABELS = { not_started: "Non commencé", in_progress: "En cours", completed: "Terminé" };
  const STATUS_CLASS = { not_started: styles.statusNotStarted, in_progress: styles.statusInProgress, completed: styles.statusCompleted };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Apprenants</h1>
          <p className={styles.subtitle}>{apprenants.length} apprenant{apprenants.length > 1 ? "s" : ""} inscrits</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher un apprenant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select
          value={selectedFormation}
          onChange={(e) => setSelectedFormation(e.target.value)}
          className={styles.select}
        >
          <option value="all">Toutes les formations</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>{f.title}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className={styles.select}
        >
          <option value="all">Tous les statuts</option>
          <option value="not_started">Non commencé</option>
          <option value="in_progress">En cours</option>
          <option value="completed">Terminé</option>
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <Users size={32} className={styles.emptyIcon} />
          <p>Aucun apprenant trouvé.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Apprenant</th>
                <th>Progression</th>
                <th>Statut</th>
                <th>Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className={styles.apprenantCell}>
                      <div className={styles.avatar}>{(a.full_name ?? a.email).charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.apprenantName}>{a.full_name ?? "—"}</div>
                        <div className={styles.apprenantEmail}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {a.total > 0 ? (
                      <div className={styles.progressCell}>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${a.pct}%` }} />
                        </div>
                        <span className={styles.progressLabel}>{a.completed}/{a.total}</span>
                      </div>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${STATUS_CLASS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td>
                    <span className={styles.dateCell}>
                      {a.lastActivity ? formatDate(a.lastActivity) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
