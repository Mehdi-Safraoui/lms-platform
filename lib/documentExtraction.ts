import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

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
