import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks/(.*)", "/pricing(.*)"]);

const isRootRoute = createRouteMatcher(["/"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOrgRoute = createRouteMatcher(["/org(.*)"]);
const isApprenantRoute = createRouteMatcher(["/apprenant(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId: clerkUserId } = await auth();

  // Protect all non-public routes
  if (!isPublicRoute(req) && !clerkUserId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (clerkUserId && (isRootRoute(req) || isAdminRoute(req) || isOrgRoute(req) || isApprenantRoute(req))) {
    const supabase = createServiceRoleSupabaseClient();
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("clerk_user_id", clerkUserId)
      .single();

    // / → redirect immédiat si le rôle est connu (évite le flash blank page)
    // Si user pas encore en DB (sign-up race condition) → app/page.tsx gère le WaitForSync
    if (isRootRoute(req)) {
      if (user?.role === "super_admin") return NextResponse.redirect(new URL("/admin/catalog", req.url));
      if (user?.role === "admin_tenant" || user?.role === "tuteur") return NextResponse.redirect(new URL("/org", req.url));
      if (user?.role === "apprenant") return NextResponse.redirect(new URL("/apprenant", req.url));
      return; // user pas encore en DB → laisse app/page.tsx afficher WaitForSync
    }

    // /admin/* → super_admin uniquement
    if (isAdminRoute(req) && user?.role !== "super_admin") {
      const dest = ["admin_tenant", "tuteur"].includes(user?.role ?? "") ? "/org" : "/apprenant";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // /org/* → admin_tenant + tuteur uniquement
    if (isOrgRoute(req) && !["admin_tenant", "tuteur"].includes(user?.role ?? "")) {
      const dest = user?.role === "super_admin" ? "/admin/catalog" : "/apprenant";
      return NextResponse.redirect(new URL(dest, req.url));
    }

    // /apprenant/* → apprenant uniquement
    if (isApprenantRoute(req) && user) {
      if (user.role === "super_admin") return NextResponse.redirect(new URL("/admin/catalog", req.url));
      if (user.role === "admin_tenant" || user.role === "tuteur") return NextResponse.redirect(new URL("/org", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
