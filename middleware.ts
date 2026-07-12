import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks/(.*)"]);
const isRootRoute = createRouteMatcher(["/"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Protect non-public, non-root routes
  if (!isPublicRoute(req) && !isRootRoute(req)) {
    await auth.protect();
  }

  // Handle role-based redirect at root + admin route protection in one pass
  if (isRootRoute(req) || isAdminRoute(req)) {
    const { userId: clerkUserId } = await auth();

    if (isRootRoute(req) && !clerkUserId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    if (clerkUserId) {
      const supabase = createServiceRoleSupabaseClient();
      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("clerk_user_id", clerkUserId)
        .single();

      if (isRootRoute(req)) {
        if (user?.role === "super_admin" || user?.role === "admin_tenant") {
          return NextResponse.redirect(new URL("/admin/catalog", req.url));
        }
        return NextResponse.redirect(new URL("/apprenant", req.url));
      }

      if (isAdminRoute(req) && user && user.role !== "super_admin" && user.role !== "admin_tenant") {
        return NextResponse.redirect(new URL("/apprenant", req.url));
      }
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
