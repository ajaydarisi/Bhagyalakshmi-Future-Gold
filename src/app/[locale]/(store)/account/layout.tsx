import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AccountSidebar, AccountMobileNav } from "@/components/layout/account-sidebar";
import { getTranslations } from "next-intl/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("account");
  const tRoot = await getTranslations();

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} homeLabel={tRoot("breadcrumbHome")} />
      <h1 className="mt-6 text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <div className="mt-6">
        <AccountMobileNav />
      </div>
      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <AccountSidebar />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
