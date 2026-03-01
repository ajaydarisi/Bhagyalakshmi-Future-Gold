"use client";

import { useEffect } from "react";
import { warmCachesOnFirstLoad, prefetchEssentialData } from "@/lib/prefetch";

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1000);
  }
}

export function usePrefetch(): void {
  // Cache warming on first load
  useEffect(() => {
    scheduleIdle(() => {
      warmCachesOnFirstLoad().catch(() => {});
    });
  }, []);

  // Prefetch on app resume
  useEffect(() => {
    const handler = () => {
      scheduleIdle(() => {
        prefetchEssentialData().catch(() => {});
      });
    };

    window.addEventListener("bfg:app-resume", handler);
    return () => window.removeEventListener("bfg:app-resume", handler);
  }, []);

  // Register periodic sync for PWA price refresh
  useEffect(() => {
    async function registerPeriodicSync() {
      if (!("serviceWorker" in navigator)) return;

      try {
        const reg = await navigator.serviceWorker.ready;
        if ("periodicSync" in reg) {
          const status = await navigator.permissions.query({
            name: "periodic-background-sync" as PermissionName,
          });
          if (status.state === "granted") {
            await (reg as unknown as { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } })
              .periodicSync.register("bfg-refresh-prices", {
                minInterval: 12 * 60 * 60 * 1000, // 12 hours
              });
          }
        }
      } catch {
        // Periodic sync not available — that's fine
      }
    }

    registerPeriodicSync();
  }, []);
}
