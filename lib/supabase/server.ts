/**
 * Client Supabase côté serveur (Server Components, Route Handlers, middleware).
 * À initialiser après installation : npm install @supabase/ssr
 *
 * IMPORTANT : Ce client doit toujours passer le clerk_org_id dans les headers
 * pour que les policies RLS de Supabase puissent identifier le tenant courant.
 */

// import { createServerClient } from "@supabase/ssr";
// import { cookies } from "next/headers";

// export async function createServerSupabaseClient() {
//   const cookieStore = await cookies();
//   return createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
//   );
// }

export {}; // placeholder — sera implémenté lors de l'intégration Supabase
