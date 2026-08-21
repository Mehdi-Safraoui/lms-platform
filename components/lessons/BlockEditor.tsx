"use client";

import {
  Sparkles, Wand2, Share2, ShieldCheck, PenTool, BarChart3,
  BookOpen, Brain, Rocket, Target, Lightbulb, Users,
  Search, Monitor, CheckCircle2, AlertTriangle,
  Trash2, ChevronUp, ChevronDown, Plus,
} from "lucide-react";
import { ICON_KEYS, type ContentBlock } from "@/lib/ai/contentBlocks";
import editorStyles from "./blockEditor.module.css";
import blockStyles from "./blocks.module.css";

const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles, wand: Wand2, network: Share2, shield: ShieldCheck,
  pen: PenTool, chart: BarChart3, book: BookOpen, brain: Brain,
  rocket: Rocket, target: Target, lightbulb: Lightbulb, users: Users,
  search: Search, monitor: Monitor, check: CheckCircle2, warning: AlertTriangle,
};

const BLOCK_TYPE_LABELS: Record<ContentBlock["type"], string> = {
  heading: "Titre de section",
  paragraph: "Paragraphe",
  list: "Liste",
  callout: "Encadré (info/astuce/attention/succès/objectif/exemple)",
  comparison: "Comparaison",
  feature_grid: "Grille de fonctionnalités",
  highlight: "Mise en avant",
  exercise: "Exercice (consigne + correction)",
};

function defaultBlockFor(type: ContentBlock["type"]): ContentBlock {
  switch (type) {
    case "heading": return { type: "heading", level: 2, text: "Nouveau titre" };
    case "paragraph": return { type: "paragraph", text: "" };
    case "list": return { type: "list", ordered: false, items: ["Élément 1", "Élément 2"] };
    case "callout": return { type: "callout", variant: "info", title: "Titre", text: "" };
    case "comparison": return {
      type: "comparison", title: null,
      columns: [
        { label: "Option A", emphasis: "neutral", items: ["Point 1"] },
        { label: "Option B", emphasis: "primary", items: ["Point 1"] },
      ],
    };
    case "feature_grid": return {
      type: "feature_grid",
      items: [
        { icon: "sparkles", title: "Fonctionnalité", description: "" },
        { icon: "target", title: "Fonctionnalité", description: "" },
      ],
    };
    case "highlight": return { type: "highlight", title: "À retenir", text: "" };
    case "exercise": return { type: "exercise", prompt: "", answer: "" };
  }
}

interface Props {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export default function BlockEditor({ blocks, onChange }: Props) {
  function update(index: number, block: ContentBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }
  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    onChange(reordered);
  }
  function add(type: ContentBlock["type"]) {
    onChange([...blocks, defaultBlockFor(type)]);
  }

  return (
    <div className={editorStyles.wrapper}>
      {blocks.map((block, i) => (
        <div key={i} className={editorStyles.blockCard}>
          <div className={editorStyles.blockHeader}>
            <span className={editorStyles.blockType}>{BLOCK_TYPE_LABELS[block.type]}</span>
            <div className={editorStyles.blockActions}>
              <button type="button" className={editorStyles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></button>
              <button type="button" className={editorStyles.iconBtn} onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ChevronDown size={13} /></button>
              <button type="button" className={`${editorStyles.iconBtn} ${editorStyles.iconBtnDanger}`} onClick={() => remove(i)}><Trash2 size={13} /></button>
            </div>
          </div>

          {block.type === "heading" && (
            <div className={editorStyles.fieldsRow}>
              <select
                className={editorStyles.selectSmall}
                value={block.level}
                onChange={(e) => update(i, { ...block, level: Number(e.target.value) as 2 | 3 })}
              >
                <option value={2}>Titre principal (H2)</option>
                <option value={3}>Sous-titre (H3)</option>
              </select>
              <input
                className={editorStyles.input}
                value={block.text}
                onChange={(e) => update(i, { ...block, text: e.target.value })}
              />
            </div>
          )}

          {block.type === "paragraph" && (
            <textarea
              className={editorStyles.textarea}
              rows={3}
              value={block.text}
              onChange={(e) => update(i, { ...block, text: e.target.value })}
            />
          )}

          {block.type === "list" && (
            <>
              <label className={editorStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={block.ordered}
                  onChange={(e) => update(i, { ...block, ordered: e.target.checked })}
                />
                Liste numérotée
              </label>
              <textarea
                className={editorStyles.textarea}
                rows={4}
                placeholder="Un élément par ligne"
                value={block.items.join("\n")}
                onChange={(e) => update(i, { ...block, items: e.target.value.split("\n").filter((l) => l.trim()) })}
              />
            </>
          )}

          {block.type === "callout" && (
            <>
              <div className={editorStyles.fieldsRow}>
                <select
                  className={editorStyles.selectSmall}
                  value={block.variant}
                  onChange={(e) => update(i, { ...block, variant: e.target.value as typeof block.variant })}
                >
                  <option value="info">Info</option>
                  <option value="tip">Astuce</option>
                  <option value="warning">Attention</option>
                  <option value="success">Succès</option>
                  <option value="objective">Objectif</option>
                  <option value="example">Exemple</option>
                </select>
                <input
                  className={editorStyles.input}
                  placeholder="Titre"
                  value={block.title}
                  onChange={(e) => update(i, { ...block, title: e.target.value })}
                />
              </div>
              <textarea
                className={editorStyles.textarea}
                rows={2}
                value={block.text}
                onChange={(e) => update(i, { ...block, text: e.target.value })}
              />
            </>
          )}

          {block.type === "highlight" && (
            <>
              <input
                className={editorStyles.input}
                placeholder="Titre"
                value={block.title}
                onChange={(e) => update(i, { ...block, title: e.target.value })}
              />
              <textarea
                className={editorStyles.textarea}
                rows={2}
                value={block.text}
                onChange={(e) => update(i, { ...block, text: e.target.value })}
              />
            </>
          )}

          {block.type === "exercise" && (
            <>
              <textarea
                className={editorStyles.textarea}
                rows={2}
                placeholder="Consigne de l'exercice"
                value={block.prompt}
                onChange={(e) => update(i, { ...block, prompt: e.target.value })}
              />
              <textarea
                className={editorStyles.textarea}
                rows={2}
                placeholder="Correction / piste de solution"
                value={block.answer}
                onChange={(e) => update(i, { ...block, answer: e.target.value })}
              />
            </>
          )}

          {block.type === "comparison" && (
            <>
              <input
                className={editorStyles.input}
                placeholder="Titre de la comparaison (optionnel)"
                value={block.title ?? ""}
                onChange={(e) => update(i, { ...block, title: e.target.value || null })}
              />
              <div className={blockStyles.comparisonGrid} style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)`, marginTop: 10 }}>
                {block.columns.map((col, ci) => (
                  <div key={ci} className={editorStyles.columnEditor}>
                    <div className={editorStyles.fieldsRow}>
                      <input
                        className={editorStyles.input}
                        placeholder="Nom de la colonne"
                        value={col.label}
                        onChange={(e) => {
                          const columns = block.columns.map((c, j) => j === ci ? { ...c, label: e.target.value } : c);
                          update(i, { ...block, columns });
                        }}
                      />
                      <select
                        className={editorStyles.selectSmall}
                        value={col.emphasis}
                        onChange={(e) => {
                          const columns = block.columns.map((c, j) => j === ci ? { ...c, emphasis: e.target.value as typeof c.emphasis } : c);
                          update(i, { ...block, columns });
                        }}
                      >
                        <option value="neutral">Neutre</option>
                        <option value="primary">Mise en avant</option>
                      </select>
                    </div>
                    <textarea
                      className={editorStyles.textarea}
                      rows={3}
                      placeholder="Un point par ligne"
                      value={col.items.join("\n")}
                      onChange={(e) => {
                        const columns = block.columns.map((c, j) => j === ci ? { ...c, items: e.target.value.split("\n").filter((l) => l.trim()) } : c);
                        update(i, { ...block, columns });
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {block.type === "feature_grid" && (
            <div className={editorStyles.featureGridEditor}>
              {block.items.map((item, fi) => {
                const Icon = FEATURE_ICONS[item.icon] ?? Sparkles;
                return (
                  <div key={fi} className={editorStyles.columnEditor}>
                    <div className={editorStyles.fieldsRow}>
                      <select
                        className={editorStyles.selectSmall}
                        value={item.icon}
                        onChange={(e) => {
                          const items = block.items.map((it, j) => j === fi ? { ...it, icon: e.target.value as typeof it.icon } : it);
                          update(i, { ...block, items });
                        }}
                      >
                        {ICON_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                      </select>
                      <Icon size={16} className={editorStyles.iconPreview} />
                      <button
                        type="button"
                        className={`${editorStyles.iconBtn} ${editorStyles.iconBtnDanger}`}
                        onClick={() => update(i, { ...block, items: block.items.filter((_, j) => j !== fi) })}
                        disabled={block.items.length <= 2}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <input
                      className={editorStyles.input}
                      placeholder="Titre"
                      value={item.title}
                      onChange={(e) => {
                        const items = block.items.map((it, j) => j === fi ? { ...it, title: e.target.value } : it);
                        update(i, { ...block, items });
                      }}
                    />
                    <textarea
                      className={editorStyles.textarea}
                      rows={2}
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const items = block.items.map((it, j) => j === fi ? { ...it, description: e.target.value } : it);
                        update(i, { ...block, items });
                      }}
                    />
                  </div>
                );
              })}
              {block.items.length < 6 && (
                <button
                  type="button"
                  className={editorStyles.addBtn}
                  onClick={() => update(i, { ...block, items: [...block.items, { icon: "sparkles", title: "", description: "" }] })}
                >
                  <Plus size={13} /> Ajouter un item
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <div className={editorStyles.addBlockRow}>
        <span className={editorStyles.addBlockLabel}>Ajouter un bloc :</span>
        {(Object.keys(BLOCK_TYPE_LABELS) as ContentBlock["type"][]).map((type) => (
          <button key={type} type="button" className={editorStyles.addBlockBtn} onClick={() => add(type)}>
            <Plus size={12} /> {BLOCK_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
