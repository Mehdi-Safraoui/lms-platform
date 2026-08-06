// mammoth ne publie pas de types officiels (pas de @types/mammoth).
// Déclaration minimale couvrant uniquement ce qu'on utilise (extraction de texte brut).
declare module "mammoth" {
  interface ExtractRawTextInput {
    buffer?: Buffer;
    path?: string;
  }
  interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  function extractRawText(input: ExtractRawTextInput): Promise<ExtractRawTextResult>;

  const mammoth: { extractRawText: typeof extractRawText };
  export default mammoth;
  export { extractRawText };
}
