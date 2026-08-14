import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import JSZip from "jszip";
import * as cheerio from "cheerio";

export type SupportedDocumentType = "pdf" | "docx";

export function detectDocumentType(filename: string): SupportedDocumentType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // unpdf embarque une build de PDF.js dépourvue de toute référence navigateur
  // (DOMMatrix, canvas...) et sans fichier worker externe à résoudre — contrairement
  // à pdf-parse/pdfjs-dist, elle fonctionne telle quelle en environnement Serverless
  // (Vercel). Voir ARCHITECTURE.md.
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extrait le texte brut d'un document PDF ou Word (.docx) pour l'envoyer au LLM.
 * Lève une erreur explicite si le format n'est pas supporté (ex : .doc, .txt).
 */
export async function extractTextFromDocument(buffer: Buffer, filename: string): Promise<string> {
  const type = detectDocumentType(filename);
  if (type === "pdf") return extractTextFromPdf(buffer);
  if (type === "docx") return extractTextFromDocx(buffer);
  throw new Error(`Format de fichier non supporté : "${filename}". Utilisez un PDF ou un .docx.`);
}

// =====================================================
// V2 — Pipeline RAG (knowledge_sources) : formats élargis.
// Vocabulaire aligné sur la colonne knowledge_sources.format en base
// ('pdf' | 'word' | 'ppt' | 'texte' | 'web'), distinct du vocabulaire V1
// ci-dessus ('pdf' | 'docx') volontairement laissé inchangé.
// =====================================================

export type KnowledgeSourceFormat = "pdf" | "word" | "ppt" | "texte" | "web";

export function detectKnowledgeSourceFormat(filename: string): Exclude<KnowledgeSourceFormat, "web"> | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "word";
  if (ext === "pptx" || ext === "ppt") return "ppt";
  if (ext === "txt") return "texte";
  return null;
}

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  // Un .pptx est une archive zip contenant une page XML par diapositive
  // (ppt/slides/slideN.xml), avec le texte dans des balises <a:t>. Extraction
  // manuelle plutôt qu'une lib dédiée (pptx2json / node-pptx-parser) : ces
  // paquets sont peu utilisés et peu maintenus (2 à 7 versions publiées sur
  // toute leur existence) — jszip est une dépendance beaucoup plus solide et
  // largement éprouvée pour ce même besoin.
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Fichier PowerPoint invalide ou corrompu.");
  }

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error("Fichier PowerPoint invalide ou vide (aucune diapositive trouvée).");
  }

  const slideTexts = await Promise.all(
    slideFiles.map(async (name) => {
      const xml = await zip.files[name].async("text");
      const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)];
      return matches.map((m) => m[1]).join(" ");
    })
  );

  return slideTexts.join("\n\n");
}

function extractTextFromTxt(buffer: Buffer): string {
  const text = buffer.toString("utf-8").trim();
  if (!text) throw new Error("Fichier texte vide.");
  return text;
}

async function extractTextFromUrl(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error(`URL inaccessible : "${url}".`);
  }
  if (!response.ok) {
    throw new Error(`URL inaccessible (statut ${response.status}) : "${url}".`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, noscript").remove();
  // Insère un saut de ligne après chaque élément de bloc — sans ça, .text()
  // colle le texte de balises voisines (ex: "Example DomainThis domain...").
  $("p, div, h1, h2, h3, h4, h5, h6, li, br, tr").after("\n");
  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

  if (!text) {
    throw new Error(`Aucun contenu texte exploitable trouvé sur "${url}".`);
  }
  return text;
}

/**
 * Extraction pour le pipeline RAG (knowledge_sources) — couvre les 5 formats
 * acceptés à l'upload. Pour une source "web", passer l'URL au lieu d'un buffer.
 * Erreurs toujours normalisées en Error avec un message explicite (fichier
 * corrompu, format non supporté, URL inaccessible).
 */
export async function extractKnowledgeSourceText(
  source: { format: "web"; url: string } | { format: Exclude<KnowledgeSourceFormat, "web">; buffer: Buffer; filename: string }
): Promise<string> {
  try {
    switch (source.format) {
      case "pdf":
        return await extractTextFromPdf(source.buffer);
      case "word":
        return await extractTextFromDocx(source.buffer);
      case "ppt":
        return await extractTextFromPptx(source.buffer);
      case "texte":
        return extractTextFromTxt(source.buffer);
      case "web":
        return await extractTextFromUrl(source.url);
      default:
        throw new Error(`Format non supporté : "${(source as { format: string }).format}".`);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Échec de l'extraction du contenu (fichier corrompu ou illisible).");
  }
}
