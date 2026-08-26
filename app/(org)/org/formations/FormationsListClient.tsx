"use client";

import * as React from "react";
import FormationRow from "./FormationRow";
import AheadFormationRow from "./AheadFormationRow";
import styles from "./formations.module.css";

export interface OwnFormationItem {
  source: "own";
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  href: string;
  stageLabel: string;
  stageIcon: React.ReactNode;
  isPublished: boolean;
  isFinal: boolean;
  canPreview: boolean;
  thumbnailUrl: string | null;
}

export interface AheadFormationItem {
  source: "ahead";
  id: string;
  title: string;
  createdAt: string;
  niveau: string | null;
  moduleCount: number;
  lessonCount: number;
  enabled: boolean;
  thumbnailUrl: string | null;
}

export type FormationListItem = OwnFormationItem | AheadFormationItem;

type Filter = "all" | "own" | "ahead";

// Fusion "Catalogue" + "Mes formations" en une seule liste filtrable — évite la
// confusion vécue en pratique (une formation créée par le tenant cherchée dans
// le catalogue Ahead, qui ne montre jamais que les formations du super_admin).
export default function FormationsListClient({ items }: { items: FormationListItem[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const ownCount = items.filter((i) => i.source === "own").length;
  const aheadCount = items.filter((i) => i.source === "ahead").length;
  const filtered = items.filter((i) => filter === "all" || i.source === filter);

  return (
    <div>
      <div className={styles.filterTabs}>
        <button type="button" className={`${styles.filterTab} ${filter === "all" ? styles.filterTabActive : ""}`} onClick={() => setFilter("all")}>
          Toutes ({items.length})
        </button>
        <button type="button" className={`${styles.filterTab} ${filter === "own" ? styles.filterTabActive : ""}`} onClick={() => setFilter("own")}>
          Les miennes ({ownCount})
        </button>
        <button type="button" className={`${styles.filterTab} ${filter === "ahead" ? styles.filterTabActive : ""}`} onClick={() => setFilter("ahead")}>
          Ahead ({aheadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.emptyText}>Aucune formation dans ce filtre.</p>
      ) : (
        <div className={styles.list}>
          {filtered.map((item) =>
            item.source === "own" ? (
              <FormationRow
                key={item.id}
                formationId={item.id}
                title={item.title}
                createdAt={item.createdAt}
                updatedAt={item.updatedAt}
                href={item.href}
                stageLabel={item.stageLabel}
                stageIcon={item.stageIcon}
                isPublished={item.isPublished}
                isFinal={item.isFinal}
                canPreview={item.canPreview}
                thumbnailUrl={item.thumbnailUrl}
              />
            ) : (
              <AheadFormationRow
                key={item.id}
                formationId={item.id}
                title={item.title}
                createdAt={item.createdAt}
                niveau={item.niveau}
                moduleCount={item.moduleCount}
                lessonCount={item.lessonCount}
                enabled={item.enabled}
                thumbnailUrl={item.thumbnailUrl}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
