/**
 * Route Handler de test — vérifie que orgId et role sont bien récupérables
 * côté serveur via auth(), avant de les utiliser pour filtrer les données par tenant.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  return NextResponse.json(
    { userId, orgId, orgRole, orgSlug },
    { headers: { "Cache-Control": "no-store" } }
  );
}
