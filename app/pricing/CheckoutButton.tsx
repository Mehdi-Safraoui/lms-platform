"use client";

import { useState } from "react";
import styles from "./pricing.module.css";

type Props = {
  priceId: string;
  label: string;
  variant: "primary" | "outline" | "contact";
};

export default function CheckoutButton({ priceId, label, variant }: Props) {
  const [loading, setLoading] = useState(false);

  const btnClass =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "contact"
        ? styles.btnContact
        : styles.btnOutline;

  async function handleClick() {
    if (variant === "contact") {
      window.location.href = "mailto:contact@ahead-lms.com?subject=Offre%20Entreprise";
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        window.location.href = "/sign-in";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Une erreur est survenue.");
        return;
      }

      if (data.url) window.location.href = data.url;
    } catch {
      alert("Une erreur réseau est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${styles.btn} ${btnClass}`}
    >
      {loading ? "Chargement…" : label}
    </button>
  );
}
