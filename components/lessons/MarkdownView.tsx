"use client";

import dynamic from "next/dynamic";

const Markdown = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

export default function MarkdownView({ source }: { source: string }) {
  return (
    <div data-color-mode="light">
      <Markdown source={source} />
    </div>
  );
}
