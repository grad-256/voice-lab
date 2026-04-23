"use client";

import { cssVarToRgbChannels, observeThemeChange } from "@/lib/themeColors";
import { useEffect, useRef } from "react";

// Hero 背景：細いサイン波 2 本 + 漂流する粒。CSS 変数から色を取り theme 切替に追従。
export default function HeroBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    let INK = cssVarToRgbChannels("--fg");
    let ACCENT = cssVarToRgbChannels("--accent");
    let isLight = document.documentElement.dataset.theme === "light";
    const unobserve = observeThemeChange(() => {
      INK = cssVarToRgbChannels("--fg");
      ACCENT = cssVarToRgbChannels("--accent");
      isLight = document.documentElement.dataset.theme === "light";
    });

    // Light は黒インクが紙上で重く見えるので少し抑える。
    const alphaScale = () => (isLight ? 0.75 : 1);

    const waves = [
      { palette: "ink" as const, alpha: 0.38, freq: 0.0075, amp: 36, speed: 0.006, phase: 0 },
      { palette: "accent" as const, alpha: 0.32, freq: 0.011, amp: 22, speed: 0.0045, phase: 1.6 },
    ];

    type Particle = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      alpha: number;
    };
    const particles: Particle[] = Array.from({ length: 22 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.8,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      alpha: Math.random() * 0.32 + 0.18,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const midY = height * 0.58;
      const scale = alphaScale();

      for (const wave of waves) {
        ctx.beginPath();
        // 0.5px だとサブピクセル滲み。0.75px で細罫印象を保つ。
        ctx.lineWidth = 0.75;
        const channels = wave.palette === "accent" ? ACCENT : INK;
        ctx.strokeStyle = `rgba(${channels}, ${wave.alpha * scale})`;

        for (let x = 0; x <= width; x += 2) {
          const y =
            midY +
            Math.sin(x * wave.freq + t * wave.speed + wave.phase) * wave.amp +
            Math.sin(x * wave.freq * 1.5 + t * wave.speed * 0.5 + wave.phase) * wave.amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${INK}, ${p.alpha * scale})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }

      t += 1;
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
      className="lp-canvas-deco absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
