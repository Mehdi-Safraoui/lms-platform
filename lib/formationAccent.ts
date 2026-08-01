import type { LucideIcon } from "lucide-react";
import { Sparkles, Wand2, Share2, ShieldCheck, PenTool, BarChart3 } from "lucide-react";

interface CoverStyle {
  gradient: string;
  icon: LucideIcon;
}

const COVER_STYLES: CoverStyle[] = [
  { gradient: "linear-gradient(135deg, #2b1f7a 0%, #5b3df0 100%)", icon: Sparkles },
  { gradient: "linear-gradient(135deg, #7a1f3d 0%, #f0475f 100%)", icon: Wand2 },
  { gradient: "linear-gradient(135deg, #123a7a 0%, #2f8fe0 100%)", icon: Share2 },
  { gradient: "linear-gradient(135deg, #0d1b3d 0%, #1c2b52 100%)", icon: ShieldCheck },
  { gradient: "linear-gradient(135deg, #e85d6b 0%, #f5a3a3 100%)", icon: PenTool },
  { gradient: "linear-gradient(135deg, #14123a 0%, #2a2560 100%)", icon: BarChart3 },
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Cover généré automatiquement (dégradé + icône), déterministe par formation. */
export function formationCover(id: string): CoverStyle {
  return COVER_STYLES[hashId(id) % COVER_STYLES.length];
}
