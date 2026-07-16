import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import OrgShell from "./OrgShell";

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  const { data: tenant } = user?.tenant_id
    ? await supabase.from("tenants").select("name").eq("id", user.tenant_id).single()
    : { data: null };

  return (
    <>
      <OrgShell tenantName={tenant?.name ?? "Mon espace"} userRole={user?.role ?? ""}>
        {children}
      </OrgShell>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-jakarta), sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            borderRadius: "12px",
            background: "#191738",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(11,10,34,0.35)",
          },
          duration: 3500,
        }}
      />
    </>
  );
}
