"use client";

import { useEffect } from "react";

/**
 * BFG entrance-reveal gate (React port of the design system's anim.js).
 *
 * The `.bfg-animate*` / `.bfg-stagger` utilities in globals.css are visible at rest;
 * the hidden→reveal keyframe only plays while a `.bfg-play` class is present. This
 * mounts once (in the store layout) and adds `.bfg-play` to each entrance element as
 * it scrolls into view (one-shot), then leaves it — matching the prototype's "alive"
 * motion without ever leaving content hidden. Fully gated on `prefers-reduced-motion`.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const SEL = ".bfg-animate, .bfg-animate-rise, .bfg-animate-in, .bfg-stagger";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("bfg-play");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    const observe = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        if (!el.classList.contains("bfg-play")) io.observe(el);
      });

    observe(document);

    // Catch sections added after navigation / streaming.
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) observe(n as HTMLElement);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
