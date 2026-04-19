"use client";

import { useEffect, useState } from "react";

// 使いかた 02「会話が残る」用の軽量ビジュアル。
// 小さな吹き出しが積み上がっていく動きで、会話が溜まっていくメタファーを表現。
export default function StepStack() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (count < 4) {
        t = setTimeout(() => setCount((c) => c + 1), 700);
      } else {
        t = setTimeout(() => setCount(0), 1800);
      }
    };
    loop();
    return () => clearTimeout(t);
  }, [count]);

  const bubbles = [
    { id: "b1", w: "w-16", right: false },
    { id: "b2", w: "w-20", right: true },
    { id: "b3", w: "w-14", right: false },
    { id: "b4", w: "w-24", right: true },
  ];

  return (
    <div className="relative w-full h-[120px] rounded-xl bg-elevated-60 border border-[var(--border)] overflow-hidden p-3 flex flex-col justify-end gap-1.5">
      {bubbles.slice(0, count).map((b) => (
        <div
          key={b.id}
          className={`flex ${b.right ? "justify-end" : "justify-start"} animate-fadeSlideUp`}
        >
          <span
            // 会話バブル：ユーザー側（right）は自分発の濃い色、AI 側は控えめ。
            // var(--fg-subtle) / var(--border-strong) でどちらのテーマでも階調が残るように設計。
            className={`${b.w} h-2.5 rounded-full ${
              b.right ? "bg-[var(--fg-subtle)]" : "bg-[var(--border-strong)]"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
