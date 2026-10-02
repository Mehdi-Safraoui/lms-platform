"use client";

import { useState, useMemo } from "react";
import { Users, Search, UserPlus, Star } from "lucide-react";
import styles from "./apprenants.module.css";
import InviteApprenantModal from "./InviteApprenantModal";
import ApprenantDetailModal from "./ApprenantDetailModal";
import PendingInvitations from "./PendingInvitations";
import type { PendingInvitation } from "@/lib/orgInvitations";
import { getCompletion, getLastActivity, type ProgressRecord } from "@/lib/apprenantProgress";

export interface Apprenant {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  total_points: number;
}

export interface Formation {
  id: string;
  title: string;
  lessonIds: string[];
}

export type { ProgressRecord };

interface Props {
  apprenants: Apprenant[];
  formations: Formation[];
  progressRecords: ProgressRecord[];
  /** Limite de l'offre (null = illimité) et invitations encore en attente. */
  learnerLimit: number | null;
  pendingCount: number;
  pendingInvitations: PendingInvitation[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ApprenantTable({ apprenants, formations, progressRecords, learnerLimit, pendingCount, pendingInvitations }: Props) {
  const [selectedFormation, setSelectedFormation] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_started" | "in_progress" | "completed">("all");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedApprenantId, setSelectedApprenantId] = useState<string | null>(null);

  const selectedApprenant = useMemo(
    () => apprenants.find((a) => a.id === selectedApprenantId) ?? null,
    [apprenants, selectedApprenantId]
  );

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
      {inviteModalOpen && <InviteApprenantModal onClose={() => setInviteModalOpen(false)} />}
      {selectedApprenant && (
        <ApprenantDetailModal
          apprenant={selectedApprenant}
          formations={formations}
          progressRecords={progressRecords}
          onClose={() => setSelectedApprenantId(null)}
        />
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Apprenants</h1>
          <p className={styles.subtitle}>
            {apprenants.length} apprenant{apprenants.length > 1 ? "s" : ""} inscrit{apprenants.length > 1 ? "s" : ""}
            {pendingCount > 0 && ` · ${pendingCount} invitation${pendingCount > 1 ? "s" : ""} en attente`}
            {learnerLimit !== null && ` · ${apprenants.length + pendingCount} / ${learnerLimit} places de votre offre`}
          </p>
        </div>
        <button className={styles.btnInvite} onClick={() => setInviteModalOpen(true)}>
          <UserPlus size={16} strokeWidth={2} />
          Ajouter un apprenant
        </button>
      </div>

      <PendingInvitations invitations={pendingInvitations} />

      {pendingInvitations.length > 0 && <h2 className={styles.sectionTitle}>Apprenants inscrits</h2>}

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
                <th>Points</th>
                <th>Progression</th>
                <th>Statut</th>
                <th>Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={styles.clickableRow} onClick={() => setSelectedApprenantId(a.id)}>
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
                    <span className={styles.pointsCell}>
                      <Star size={13} />
                      {a.total_points}
                    </span>
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
