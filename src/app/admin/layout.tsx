import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSidebar, AdminMobileHeader } from "@/components/layout/admin-sidebar";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { SetHtmlLang } from "@/components/shared/set-html-lang";
import { Toaster } from "@/components/ui/sonner";
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <>
    <SetHtmlLang locale="en" />
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="flex min-h-screen overflow-x-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <AdminMobileHeader />
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
