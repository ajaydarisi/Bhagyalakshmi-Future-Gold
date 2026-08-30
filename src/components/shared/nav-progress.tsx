"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "complete">("idle");
  const [prevPathname, setPrevPathname] = useState(pathname);

  // When pathname changes, complete the progress bar
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (state === "loading") {
      setState("complete");
    }
  }

  // Auto-reset to idle after completion animation
  useEffect(() => {
    if (state !== "complete") return;
    const timer = setTimeout(() => setState("idle"), 300);
    return () => clearTimeout(timer);
  }, [state]);

  // Safety timeout: reset loader if no navigation happens within 5s
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState("idle"), 5000);
    return () => clearTimeout(timer);
  }, [state]);

  // Intercept clicks on links to start the progress bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;

      // Skip clicks on interactive elements inside links (buttons, inputs, etc.)
      if (target.closest("button, [role='button'], input, select, textarea")) {
        return;
      }

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href === pathname ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey
      ) {
        return;
      }

      setState("loading");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  if (state === "idle") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-[2.5px]"
      style={{ paddingTop: "var(--safe-area-inset-top)" }}
    >
      <div
        className={`h-full bg-gold-500 ${
          state === "loading"
            ? "animate-nav-progress"
            : "w-full animate-nav-complete"
        }`}
      />
    </div>
  );
}
