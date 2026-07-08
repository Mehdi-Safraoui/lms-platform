"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Search, BookOpen, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import styles from "./catalog.module.css";

interface Formation {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_at: string;
  tenant_id: string | null;
  niveau: "debutant" | "intermediaire" | "avance" | null;
}

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

type Filter = "all" | "published" | "draft";

function ConfirmDeleteModal({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <p className={styles.modalTitle}>Supprimer cette formation ?</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, marginTop: -2 }}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalText}>
          La formation <strong>&ldquo;{title}&rdquo;</strong> et tous ses modules et leçons seront supprimés définitivement. Cette action est irréversible.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={onClose}>Annuler</button>
          <button className={styles.btnDanger} onClick={() => { onConfirm(); onClose(); }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const router = useRouter();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Formation | null>(null);

  useEffect(() => {
    fetch("/api/formations")
      .then((r) => r.json())
      .then((j) => setFormations(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(f: Formation) {
    const res = await fetch(`/api/formations/${f.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setFormations((prev) => prev.filter((x) => x.id !== f.id));
      toast.success("Formation supprimée", { description: `"${f.title}" a été supprimée.` });
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  const filtered = useMemo(() => {
    return formations.filter((f) => {
      const matchSearch =
        !search ||
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        (f.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "all" ||
        (filter === "published" && f.is_published) ||
        (filter === "draft" && !f.is_published);
      return matchSearch && matchFilter;
    });
  }, [formations, search, filter]);

  if (loading) return <div className={styles.loading}>Chargement…</div>;

  return (
    <>
      {deleteTarget && (
        <ConfirmDeleteModal
          title={deleteTarget.title}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <div className={styles.page}>
        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            <span>FLOW SUPER-ADMIN · CRÉATION PAR AHEAD</span>
          </div>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>
                Catalogue IA transverse
                <span className={styles.v1Badge}>V1</span>
              </h1>
              <p className={styles.subtitle}>
                Formations IA conçues par Ahead, disponibles pour <strong>tous les tenants.</strong>
              </p>
            </div>
            <Link href="/admin/catalog/new" className={styles.btnCreate}>
              <Plus size={16} strokeWidth={2.5} />
              Créer une formation
            </Link>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Rechercher une formation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filters}>
            {(["all", "published", "draft"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Toutes" : f === "published" ? "Publiées" : "Brouillons"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <BookOpen size={24} strokeWidth={1.5} />
              </div>
              <p className={styles.emptyTitle}>
                {formations.length === 0 ? "Aucune formation" : "Aucun résultat"}
              </p>
              <p className={styles.emptyText}>
                {formations.length === 0
                  ? "Créez votre première formation pour commencer."
                  : "Essayez d'autres termes de recherche ou filtres."}
              </p>
              {formations.length === 0 && (
                <Link href="/admin/catalog/new" className={styles.btnCreate} style={{ display: "inline-flex" }}>
                  <Plus size={16} strokeWidth={2.5} />
                  Créer une formation
                </Link>
              )}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Formation</th>
                  <th>Niveau</th>
                  <th>Tenants</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className={styles.tableRow}
                    onClick={() => router.push(`/admin/catalog/${f.id}/edit`)}
                  >
                    <td>
                      <div className={styles.formationCell}>
                        <span className={styles.formationIcon}>
                          <BookOpen size={15} strokeWidth={1.75} />
                        </span>
                        <div className={styles.formationInfo}>
                          <span className={styles.formationTitle}>{f.title}</span>
                          {f.description && (
                            <span className={styles.formationDesc}>{f.description}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.cellMuted}>
                      {f.niveau ? NIVEAU_LABEL[f.niveau] : <span style={{ color: "var(--text-light)" }}>—</span>}
                    </td>
                    <td className={styles.cellMuted}>—</td>
                    <td>
                      <span className={`${styles.badge} ${f.is_published ? styles.badgePublished : styles.badgeDraft}`}>
                        {f.is_published ? "Publié" : "Brouillon"}
                      </span>
                    </td>
                    <td className={styles.cellActions}>
                      <button
                        className={styles.btnDelete}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(f); }}
                        title="Supprimer"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                      <ChevronRight size={16} strokeWidth={1.75} style={{ color: "var(--text-light)", flexShrink: 0 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
