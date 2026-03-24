"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const decodedHash = decodeURIComponent(hash);
      const scrollToHash = () => {
        const element = document.getElementById(decodedHash);
        if (!element) {
          return false;
        }

        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      };

      if (!scrollToHash()) {
        const timeoutId = window.setTimeout(() => {
          scrollToHash();
        }, 120);

        return () => window.clearTimeout(timeoutId);
      }

      return;
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, searchParams]);

  return null;
}
