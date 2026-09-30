import * as React from "react";

// Markdown "en ligne" des textes courts des blocs (éléments de liste, textes
// d'encadré, de comparaison, de grille...) : **gras**, *italique* / _italique_,
// `code` et [lien](https://…). Le modèle en met aussi hors des paragraphes —
// affichés tels quels, les ** apparaissaient en clair. Rendu en éléments React
// uniquement (jamais de HTML injecté) ; les paragraphes, eux, passent toujours
// par le rendu Markdown complet (InlineMarkdown dans BlockRenderer).
const TOKEN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*(?!\s)([^*]+?)\*|(?<![\w])_(?!\s)([^_]+?)_(?![\w])/g;

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const [, bold, code, linkText, linkUrl, italicStar, italicUnderscore] = match;

    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{renderInlineMarkdown(bold)}</strong>);
    } else if (code !== undefined) {
      nodes.push(<code key={key++}>{code}</code>);
    } else if (linkText !== undefined && linkUrl !== undefined) {
      nodes.push(
        <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer">
          {renderInlineMarkdown(linkText)}
        </a>
      );
    } else {
      nodes.push(<em key={key++}>{renderInlineMarkdown(italicStar ?? italicUnderscore ?? "")}</em>);
    }
    last = index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
