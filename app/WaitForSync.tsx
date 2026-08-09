"use client";

import { useEffect, useState } from "react";

const MAX_ATTEMPTS = 6; // ~12s (webhook Clerk → Supabase habituellement en moins d'1-2s)
const RETRY_DELAY_MS = 2000;
// window.location.replace() recharge toute la page (remonte ce composant), donc le
// compteur doit survivre au reload — un simple useState reviendrait à 0 à chaque fois.
const STORAGE_KEY = "wait-for-sync-attempts";

function getStoredAttempts(): number {
  if (typeof window === "undefined") return 0;
  return Number(sessionStorage.getItem(STORAGE_KEY) ?? "0");
}

export default function WaitForSync() {
  // Lazy initializer : dérive l'état initial de sessionStorage pendant le rendu,
  // plutôt qu'un setState dans un effet (évite un rendu en cascade inutile).
  const [maxedOut] = useState(() => getStoredAttempts() >= MAX_ATTEMPTS);

  useEffect(() => {
    if (maxedOut) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, String(getStoredAttempts() + 1));
      window.location.replace("/");
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [maxedOut]);

  function retry() {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.replace("/");
  }

  if (maxedOut) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          height: "100vh",
          fontSize: "15px",
          color: "#6b7280",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <p>
          La synchronisation de votre compte prend plus de temps que prévu.
          <br />
          Réessayez, ou contactez le support si le problème persiste.
        </p>
        <button
          onClick={retry}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#171717",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontSize: "15px",
        color: "#6b7280",
        fontFamily: "sans-serif",
      }}
    >
      Chargement en cours…
    </div>
  );
}
