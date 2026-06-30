"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70; // px of pull needed to trigger a refresh
const MAX_PULL = 110; // cap on how far the indicator travels
const RESISTANCE = 0.5; // finger travel → indicator travel
const MIN_SPIN = 950; // ms minimum spinner time so it reads as a refresh

/**
 * Touch pull-to-refresh for the storefront. Activates only when the page is
 * scrolled to the top and the user drags downward outside a dialog/carousel.
 * On release past the threshold it calls router.refresh() (re-fetches server
 * components) and dispatches "bfg:app-resume" (client query refetch).
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  const setPullSynced = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (refreshingRef.current || window.scrollY > 0) return;
      const target = e.target as HTMLElement | null;
      // Don't hijack drags inside sheets/dialogs or horizontal carousels.
      if (target?.closest('[role="dialog"],[data-slot="carousel"]')) return;
      startY.current = e.touches[0].clientY;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) {
        startY.current = null;
        setPullSynced(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      setPullSynced(dy <= 0 ? 0 : Math.min(dy * RESISTANCE, MAX_PULL));
    }
    function onEnd() {
      if (startY.current === null) return;
      const triggered = pullRef.current >= THRESHOLD;
      startY.current = null;
      if (!triggered) {
        setPullSynced(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setPullSynced(THRESHOLD);
      const started = Date.now();
      router.refresh();
      window.dispatchEvent(new Event("bfg:app-resume"));
      setTimeout(
        () => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullSynced(0);
        },
        Math.max(0, MIN_SPIN - (Date.now() - started)),
      );
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center lg:hidden"
        style={{
          transform: `translateY(${pull - 44}px)`,
          opacity: Math.min(pull / THRESHOLD, 1),
          transition:
            pull === 0 || refreshing ? "transform 200ms var(--ease-out), opacity 200ms var(--ease-out)" : "none",
        }}
      >
        <div className="mt-3 grid size-9 place-items-center rounded-full bg-[var(--surface-card)] shadow-[var(--shadow-md)]">
          <Loader2
            className={cn("size-4 text-text-gold", refreshing && "animate-spin")}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
