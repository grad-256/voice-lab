"use client";

import { useEffect, useState } from "react";

// 「声で話す」機能ミニモック。
// マイクボタンと波形ビジュアライザで、録音 → 聞いている状態を表現する。
export default function FeatureVoiceDemo() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      setActive(true);
      t = setTimeout(() => {
        setActive(false);
        t = setTimeout(loop, 1400);
      }, 2600);
    };
    t = setTimeout(loop, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-full h-[180px] rounded-2xl bg-gray-950 border border-gray-800/60 overflow-hidden flex flex-col items-center justify-center gap-3">
      {/* 波形バー */}
      <div className="flex items-end gap-[4px] h-10">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <span
            key={i}
            className={`w-[4px] rounded-full ${active ? "bg-red-400" : "bg-gray-700"} transition-colors`}
            style={{
              height: `${30 + ((i * 17) % 70)}%`,
              animation: active
                ? `voiceBarF ${0.7 + (i % 3) * 0.15}s ease-in-out ${i * 0.06}s infinite alternate`
                : "none",
            }}
          />
        ))}
      </div>

      {/* マイクボタン */}
      <div className="relative">
        {active && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
        <div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
            active
              ? "bg-red-500 scale-110 shadow-red-900/60"
              : "bg-indigo-600 shadow-indigo-900/50"
          }`}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
          </svg>
        </div>
      </div>

      <p className={`text-[11px] transition-colors ${active ? "text-red-400" : "text-gray-600"}`}>
        {active ? "聞いています…" : "マイクを押して話す"}
      </p>

      <style jsx>{`
        @keyframes voiceBarF {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
