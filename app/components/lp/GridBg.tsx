"use client";

import { useEffect, useRef } from "react";

// ランダムに光るドットグリッド（How it works セクション用）
export default function GridBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const SPACING = 40;
    type Dot = { x: number; y: number; alpha: number; target: number; speed: number };
    let dots: Dot[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // グリッド上のドットを生成
      dots = [];
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: c * SPACING,
            y: r * SPACING,
            alpha: Math.random() * 0.3,
            target: Math.random() * 0.5 + 0.05,
            speed: Math.random() * 0.008 + 0.003,
          });
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      for (const dot of dots) {
        // alpha をターゲットに近づける
        if (dot.alpha < dot.target) {
          dot.alpha = Math.min(dot.alpha + dot.speed, dot.target);
        } else {
          dot.alpha = Math.max(dot.alpha - dot.speed, dot.target);
        }
        // ターゲット到達したら次のターゲットをランダムに
        if (Math.abs(dot.alpha - dot.target) < 0.005) {
          dot.target = Math.random() * 0.45 + 0.03;
          dot.speed = Math.random() * 0.008 + 0.002;
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${dot.alpha})`;
        ctx.fill();
      }

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
