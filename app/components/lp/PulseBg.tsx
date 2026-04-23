"use client";

import { cssVarToRgbChannels, observeThemeChange } from "@/lib/themeColors";
import { useEffect, useRef } from "react";

// CTA セクション背景：墨青の細い同心円 2 本 + 中央の radial glow。
export default function PulseBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    let ACCENT = cssVarToRgbChannels("--accent");
    const unobserve = observeThemeChange(() => {
      ACCENT = cssVarToRgbChannels("--accent");
    });

    type Ring = { r: number; alpha: number };
    const rings: Ring[] = [
      { r: 0, alpha: 0.28 },
      { r: 140, alpha: 0.16 },
    ];

    const MAX_R = 360;
    const SPEED = 0.4;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (const ring of rings) {
        const alpha = ring.alpha * (1 - ring.r / MAX_R);
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ACCENT}, ${Math.max(0, alpha)})`;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        ring.r += SPEED;
        if (ring.r > MAX_R) ring.r = 0;
      }

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
      glow.addColorStop(0, `rgba(${ACCENT}, 0.08)`);
      glow.addColorStop(1, `rgba(${ACCENT}, 0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, 160, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      unobserve();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="lp-canvas-deco absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
