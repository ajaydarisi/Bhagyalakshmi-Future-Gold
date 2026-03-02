import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSidebar, AdminMobileNav, AdminHeader } from "@/components/layout/admin-sidebar";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { SetHtmlLang } from "@/components/shared/set-html-lang";
import { Toaster } from "@/components/ui/sonner";
import { NavProgress } from "@/components/shared/nav-progress";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <>
    <SetHtmlLang locale="en" />
    <NavProgress />
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AdminHeader userName={profile?.full_name || "Admin"} userEmail={user.email || ""} />
      <div className="flex min-h-screen overflow-x-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <AdminMobileNav />
          <main className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl p-4 sm:p-6">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
    </>
  );
}
