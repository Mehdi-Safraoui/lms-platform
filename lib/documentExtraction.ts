import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export type SupportedDocumentType = "pdf" | "docx";

export function detectDocumentType(filename: string): SupportedDocumentType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    // pageJoiner: "" — évite les footers "-- page X of Y --" insérés par défaut,
    // du bruit inutile dans le texte envoyé au LLM.
    const result = await parser.getText({ pageJoiner: "" });
    return result.text;
  } finally {
    await parser.destroy();
  }
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
