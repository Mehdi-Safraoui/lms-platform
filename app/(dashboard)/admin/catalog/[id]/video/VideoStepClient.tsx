"use client";

import { useRouter } from "next/navigation";
import VideoStep from "@/components/lessons/VideoStep";

export default function VideoStepClient({ formationId, suggestedQuery }: { formationId: string; suggestedQuery: string }) {
  const router = useRouter();
  return (
    <VideoStep
      formationId={formationId}
      suggestedQuery={suggestedQuery}
      onDone={() => router.push(`/admin/catalog/${formationId}/edit`)}
    />
  );
}
