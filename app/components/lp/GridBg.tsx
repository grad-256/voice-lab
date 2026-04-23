"use client";

import { cssVarToRgbChannels, observeThemeChange } from "@/lib/themeColors";
import { useEffect, useRef } from "react";

// How it works セクション背景：40px 方眼の細罫 + 交点の少数ドットが呼吸する。
export default function GridBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    let INK = cssVarToRgbChannels("--fg");
    const unobserve = observeThemeChange(() => {
      INK = cssVarToRgbChannels("--fg");
    });

    const SPACING = 40;
    type Dot = { x: number; y: number; alpha: number; target: number; speed: number };
    let dots: Dot[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // 交点の約 8% だけにドットを配置。
      dots = [];
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.08) continue;
          dots.push({
            x: c * SPACING,
            y: r * SPACING,
            alpha: Math.random() * 0.12,
            target: Math.random() * 0.22 + 0.04,
            speed: Math.random() * 0.004 + 0.0015,
          });
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const drawGrid = (width: number, height: number) => {
      ctx.strokeStyle = `rgba(${INK}, 0.05)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += SPACING) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += SPACING) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
    };

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      drawGrid(width, height);

      for (const dot of dots) {
        if (dot.alpha < dot.target) {
          dot.alpha = Math.min(dot.alpha + dot.speed, dot.target);
        } else {
          dot.alpha = Math.max(dot.alpha - dot.speed, dot.target);
        }
        if (Math.abs(dot.alpha - dot.target) < 0.004) {
          dot.target = Math.random() * 0.22 + 0.03;
          dot.speed = Math.random() * 0.004 + 0.001;
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${INK}, ${dot.alpha})`;
        ctx.fill();
      }

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
