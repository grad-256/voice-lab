"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

// 「可視化される」機能ミニモック。
// 日記の要約プレビューが 1 行ずつ現れて、読める形に整っていく様子を表現する。
export default function FeatureSummaryDemo() {
  const t = useTranslations("lp.summaryDemo");
  const lines = useMemo(() => t.raw("lines") as string[], [t]);

  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (lineCount < lines.length) {
        t = setTimeout(() => setLineCount((v) => v + 1), 950);
      } else {
        t = setTimeout(() => setLineCount(0), 2400);
      }
    };
    loop();
    return () => clearTimeout(t);
  }, [lineCount, lines.length]);

  return (
    <div className="relative w-full h-[200px] rounded-2xl bg-gray-950 border border-gray-800/60 overflow-hidden p-4">
      <div className="text-xs text-gray-500 mb-1.5">2026-04-16</div>
      <div className="text-sm text-white font-semibold mb-2.5 truncate">{t("title")}</div>
      <div className="space-y-1.5">
        {lines.slice(0, lineCount).map((l, i) => (
          <p
            key={`${i}-${l.slice(0, 8)}`}
            className="text-xs text-gray-300 leading-relaxed animate-fadeSlideUp"
          >
            {l}
          </p>
        ))}
        {lineCount < lines.length && (
          <span className="inline-block w-1 h-3.5 bg-indigo-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
