/**
 * Client Supabase côté navigateur (Client Components), avec la clé publique anon.
 * Soumis aux policies RLS — voir l'intégration du JWT Clerk pour que la RLS
 * identifie l'utilisateur courant.
 */
import { createClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
