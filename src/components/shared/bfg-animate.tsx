"use client";

import { useEffect } from "react";

/**
 * BFG entrance-animation gate — React port of bfg-design-system/ui_kits/storefront/anim.js.
 *
 * Adds `.bfg-play` to any entrance element (`.bfg-animate`, `.bfg-animate-rise`,
 * `.bfg-animate-in`, `.bfg-stagger`) when it enters the DOM, then strips it on a
 * wall-clock timer. Because the CSS utilities rest VISIBLE (no `forwards`/`both` fill),
 * content is always shown even if the animation clock is frozen — the timer removes the
 * gate regardless of whether the keyframes ever advanced.
 *
 * Mount once per layout. Honours reduced-motion via the CSS (utilities only animate
 * under `prefers-reduced-motion: no-preference`).
 */
const SEL = ".bfg-animate, .bfg-animate-rise, .bfg-animate-in, .bfg-stagger";
const HOLD = 1300; // ms — covers the longest stagger + duration

type Played = Element & { __bfgPlayed?: boolean };

// Wait for the main thread to go idle (i.e. hydration work has drained) before
// mutating className — doing it synchronously on insertion races React/Next's
// hydration of that DOM and trips a "hydration mismatch" (recoverable, but noisy).
const onIdle =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn: () => void) => setTimeout(fn, 200);

export function BfgAnimate() {
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const play = (el: Played) => {
      if (!el || el.nodeType !== 1 || el.__bfgPlayed) return;
      el.__bfgPlayed = true;
      onIdle(() => {
        el.classList.add("bfg-play");
        const t = setTimeout(() => {
          el.classList.remove("bfg-play");
          timers.delete(t);
        }, HOLD);
        timers.add(t);
      });
    };

    const scan = (node: Node) => {
      if (!node || node.nodeType !== 1) return;
      const el = node as Element;
      if (el.matches?.(SEL)) play(el as Played);
      el.querySelectorAll?.(SEL).forEach((n) => play(n as Played));
    };

    scan(document.body);

    const observer = new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach(scan));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return null;
}
