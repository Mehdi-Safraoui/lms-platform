import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Client service role : bypass RLS total.
 * Réservé aux webhooks et opérations serveur de confiance.
 * Ne jamais exposer au navigateur.
 */
export function createServiceRoleSupabaseClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Client utilisateur : passe le JWT Clerk dans Authorization.
 * Supabase vérifie le token via les JWKS Clerk et applique les politiques RLS.
 * À utiliser pour toutes les requêtes de données côté utilisateur.
 */
export async function createUserSupabaseClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
