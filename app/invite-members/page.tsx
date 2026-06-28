"use client";

import { useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function InviteMembersPage() {
  const { organization, isLoaded } = useOrganization();
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    const emailAddresses = emails
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (emailAddresses.length === 0) {
      setError("Entrez au moins une adresse email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await organization.inviteMembers({ emailAddresses, role: "org:member" });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi des invitations.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2rem",
          borderRadius: "0.75rem",
          border: "1px solid rgba(128, 128, 128, 0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Inviter des membres</h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>
          Ajoutez les adresses email de vos collaborateurs, séparées par une virgule ou un retour à
          la ligne.
        </p>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="exemple@email.com, exemple2@email.com"
          rows={4}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(128, 128, 128, 0.4)",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            resize: "vertical",
          }}
        />
        {error && <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#171717",
              color: "#fff",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Envoi en cours..." : "Envoyer les invitations"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            disabled={submitting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(128, 128, 128, 0.4)",
              background: "transparent",
              color: "inherit",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            Passer cette étape
          </button>
        </div>
      </form>
    </div>
  );
}
