import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <Link
        href="/"
        className="mb-8 text-2xl font-bold tracking-tight text-primary"
      >
        ✦ {APP_NAME}
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
