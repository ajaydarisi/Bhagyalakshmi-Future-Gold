"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

export function Confetti() {
  useEffect(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    function frame() {
      // Left side burst
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0 },
        gravity: 1.2,
        ticks: 300,
      });
      // Right side burst
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0 },
        gravity: 1.2,
        ticks: 300,
      });
      // Center burst
      confetti({
        particleCount: 2,
        angle: 90,
        spread: 100,
        origin: { x: 0.5, y: 0 },
        gravity: 1.2,
        ticks: 300,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }

    frame();
  }, []);

  return null;
}
