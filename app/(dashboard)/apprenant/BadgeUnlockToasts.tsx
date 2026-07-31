"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";

interface Props {
  newlyUnlocked: { id: string; label: string }[];
}

export default function BadgeUnlockToasts({ newlyUnlocked }: Props) {
  useEffect(() => {
    newlyUnlocked.forEach((badge, i) => {
      setTimeout(() => {
        toast.success(`Badge débloqué : ${badge.label}`, {
          icon: <Award size={16} />,
          description: "Continuez comme ça !",
        });
      }, i * 400);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
