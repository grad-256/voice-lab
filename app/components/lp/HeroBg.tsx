"use client";

import { useEffect, useRef } from "react";

// 音声波形をイメージした複数のサイン波 + パーティクルを Canvas で描画する
export default function HeroBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    // サイン波の定義
    const waves = [
      { color: "rgba(139, 92, 246, 0.35)", freq: 0.012, amp: 60, speed: 0.018, phase: 0 },
      { color: "rgba(99, 102, 241, 0.28)", freq: 0.018, amp: 40, speed: 0.024, phase: 1.2 },
      { color: "rgba(79, 70, 229, 0.20)", freq: 0.008, amp: 80, speed: 0.012, phase: 2.5 },
      { color: "rgba(6, 182, 212, 0.15)", freq: 0.022, amp: 30, speed: 0.03, phase: 0.8 },
    ];

    // パーティクルの定義
    type Particle = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
    };

    const PARTICLE_COLORS = ["rgba(139,92,246,", "rgba(99,102,241,", "rgba(6,182,212,"];

    const particles: Particle[] = Array.from({ length: 48 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
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

      const midY = height * 0.55;

      // サイン波を描画
      for (const wave of waves) {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = wave.color;

        for (let x = 0; x <= width; x += 2) {
          const y =
            midY +
            Math.sin(x * wave.freq + t * wave.speed + wave.phase) * wave.amp +
            Math.sin(x * wave.freq * 1.7 + t * wave.speed * 0.6 + wave.phase) * wave.amp * 0.4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 波の下をグラデーションで塗りつぶし
        const grad = ctx.createLinearGradient(0, midY, 0, height);
        grad.addColorStop(0, wave.color.replace(/[\d.]+\)$/, "0.08)"));
        grad.addColorStop(1, "transparent");
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // パーティクルを描画・移動
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
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
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
