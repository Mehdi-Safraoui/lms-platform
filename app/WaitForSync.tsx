"use client";

import { useEffect } from "react";

export default function WaitForSync() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace("/");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

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
