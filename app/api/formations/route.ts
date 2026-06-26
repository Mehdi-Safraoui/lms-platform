/**
 * Route Handler — /api/formations
 * GET  : liste des formations du tenant courant
 * POST : création d'une formation (Super-admin / Admin-tenant)
 *
 * Le tenant est toujours déduit du token Clerk, jamais du body de la requête.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  // TODO: implémenter lors de l'intégration Supabase
  return NextResponse.json({ data: [], error: null });
}

export async function POST(_req: NextRequest) {
  // TODO: implémenter
  return NextResponse.json({ data: null, error: "Not implemented" }, { status: 501 });
}
