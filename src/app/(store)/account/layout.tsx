import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AccountSidebar } from "@/components/layout/account-sidebar";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Account" }]} />
      <h1 className="mt-6 text-2xl font-bold md:text-3xl">My Account</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <AccountSidebar />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
