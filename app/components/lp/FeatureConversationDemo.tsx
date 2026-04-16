"use client";

import { useEffect, useState } from "react";

// 「会話が残る」機能ミニモック。
// 吹き出しが次々と積み上がっていく様子をループ再生する。
const BUBBLES: { role: "user" | "assistant"; text: string }[] = [
  { role: "assistant", text: "今日どうだった？" },
  { role: "user", text: "ちょっと疲れた。" },
  { role: "assistant", text: "何があったの？" },
  { role: "user", text: "言葉が出なくて。" },
];

export default function FeatureConversationDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (visible < BUBBLES.length) {
        t = setTimeout(() => setVisible((v) => v + 1), 900);
      } else {
        t = setTimeout(() => setVisible(0), 2200);
      }
    };
    loop();
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="relative w-full h-[200px] rounded-2xl bg-gray-950 border border-gray-800/60 overflow-hidden p-3.5 flex flex-col justify-end gap-2">
      {BUBBLES.slice(0, visible).map((b, i) => (
        <div
          key={`${i}-${b.text}`}
          className={`flex ${b.role === "user" ? "justify-end" : "justify-start"} animate-fadeSlideUp`}
        >
          <div
            className={`max-w-[78%] px-3 py-1.5 rounded-xl text-xs leading-snug ${
              b.role === "user"
                ? "bg-indigo-600 text-white rounded-tr-sm"
                : "bg-gray-800 text-gray-100 rounded-tl-sm"
            }`}
          >
            {b.text}
          </div>
        </div>
      ))}
    </div>
  );
}
