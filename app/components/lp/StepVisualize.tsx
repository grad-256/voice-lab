"use client";

import { useEffect, useState } from "react";

// 使いかた 03「可視化される」用の軽量ビジュアル。
// ランダムな長さのテキストバーが順に整列して、ノイズが「読める形」に整っていく様子を表現。
export default function StepVisualize() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (count < 4) {
        t = setTimeout(() => setCount((c) => c + 1), 500);
      } else {
        t = setTimeout(() => setCount(0), 2000);
      }
    };
    loop();
    return () => clearTimeout(t);
  }, [count]);

  const lines = ["w-3/4", "w-full", "w-2/3", "w-5/6"];

  return (
    <div className="relative w-full h-[120px] rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border)] overflow-hidden p-3 flex flex-col gap-2 justify-center">
      <div className="h-1 w-1/3 bg-[var(--fg-muted)]/60 rounded-full" />
      {lines.slice(0, count).map((w) => (
        <div
          key={w}
          className={`${w} h-1.5 rounded-full bg-[var(--fg-subtle)]/40 animate-fadeSlideUp`}
        />
      ))}
    </div>
  );
}
