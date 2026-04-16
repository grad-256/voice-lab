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
    <div className="relative w-full h-[120px] rounded-xl bg-gradient-to-br from-indigo-950/40 to-gray-900/40 border border-indigo-800/20 overflow-hidden p-3 flex flex-col gap-2 justify-center">
      <div className="h-1 w-1/3 bg-indigo-400/80 rounded-full" />
      {lines.slice(0, count).map((w) => (
        <div key={w} className={`${w} h-1.5 rounded-full bg-gray-600/80 animate-fadeSlideUp`} />
      ))}
    </div>
  );
}
