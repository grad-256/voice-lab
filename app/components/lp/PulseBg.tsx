"use client";

import { useEffect, useRef } from "react";

// 中心から広がる同心円パルス（CTA セクション用）
export default function PulseBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    type Ring = { r: number; alpha: number };
    const rings: Ring[] = [
      { r: 0, alpha: 0.5 },
      { r: 80, alpha: 0.35 },
      { r: 160, alpha: 0.2 },
    ];

    const MAX_R = 400;
    const SPEED = 1.2;

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
        ctx.strokeStyle = `rgba(99,102,241,${Math.max(0, alpha)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ring.r += SPEED;
        if (ring.r > MAX_R) ring.r = 0;
      }

      // 中心のグロー
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
      glow.addColorStop(0, "rgba(139,92,246,0.12)");
      glow.addColorStop(1, "rgba(139,92,246,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
