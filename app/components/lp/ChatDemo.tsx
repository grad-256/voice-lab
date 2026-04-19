"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Phase = "idle" | "listening" | "thinking" | "speaking";

// 会話の進行に合わせた「AI が話している／聞いている／考えている」状態を演出する。
// 実際のアプリ（/diary）のステート遷移と同じ語彙を LP で見せることで、使用感をプレビューする。
export default function ChatDemo() {
  const t = useTranslations("lp.chatDemo");
  // 会話配列は messages JSON にロケール毎で保持し、t.raw で取り出す
  const conversation = useMemo(() => t.raw("conversation") as { role: Role; text: string }[], [t]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const showNext = (index: number) => {
      if (index >= conversation.length) {
        // 会話終了：少し余韻を残してループ
        timeout = setTimeout(() => {
          setVisibleCount(0);
          setPhase("idle");
          timeout = setTimeout(() => showNext(0), 500);
        }, 3000);
        return;
      }

      const msg = conversation[index];

      if (msg.role === "assistant") {
        // AI：考える → 話す の 2 段階
        setPhase("thinking");
        timeout = setTimeout(() => {
          setPhase("speaking");
          setVisibleCount(index + 1);
          // 発話時間はテキスト長に応じて調整
          const speakingMs = Math.min(2400, 800 + msg.text.length * 80);
          timeout = setTimeout(() => {
            setPhase("idle");
            timeout = setTimeout(() => showNext(index + 1), 400);
          }, speakingMs);
        }, 900);
      } else {
        // user：聞いている（録音中） → メッセージ出現
        setPhase("listening");
        timeout = setTimeout(() => {
          setVisibleCount(index + 1);
          setPhase("idle");
          timeout = setTimeout(() => showNext(index + 1), 700);
        }, 1400);
      }
    };

    timeout = setTimeout(() => showNext(0), 700);
    return () => clearTimeout(timeout);
  }, [conversation]);

  // visibleCount / phase の更新ごとに末尾へスクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    void visibleCount;
    void phase;
    el.scrollTop = el.scrollHeight;
  }, [visibleCount, phase]);

  const messages = conversation.slice(0, visibleCount);

  const phaseLabel =
    phase === "listening"
      ? t("phase.listening")
      : phase === "thinking"
        ? t("phase.thinking")
        : phase === "speaking"
          ? t("phase.speaking")
          : t("phase.idle");

  return (
    <div
      className="w-full bg-gray-950 rounded-[36px] border border-gray-700/40 overflow-hidden flex flex-col h-[560px]"
      style={{
        boxShadow:
          "0 0 0 7px #0b1020, 0 0 0 8px rgba(99,102,241,0.12), 0 40px 80px -20px rgba(0,0,0,0.9), 0 20px 40px -10px rgba(99,102,241,0.18)",
      }}
    >
      {/* ステータスバー */}
      <div className="px-5 pt-3 pb-1 flex justify-between items-center text-[10px] text-gray-600">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-gray-600" />
          <span className="inline-block w-1 h-1 rounded-full bg-gray-600" />
          <span className="inline-block w-1 h-1 rounded-full bg-gray-600" />
        </span>
      </div>

      <div className="flex flex-col px-3 pb-5 flex-1 min-h-0">
        {/* ヘッダー：ブランド名（特定ペルソナ・英会話訴求は廃止） */}
        <div className="flex items-center gap-2 py-2 border-b border-gray-800/50">
          <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
            VL
            {/* AI が話しているときはアバターの周囲に柔らかい光 */}
            {phase === "speaking" && (
              <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400/60 animate-ping" />
            )}
          </div>
          <div className="leading-tight">
            <p className="text-white font-semibold text-sm">MyVoiceLab</p>
            <p className="text-gray-500 text-xs">{t("partner")}</p>
          </div>
          <span className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-gray-500">{t("online")}</span>
          </span>
        </div>

        {/* メッセージエリア */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-3 space-y-3.5 scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {messages.map((msg, i) => (
            <div
              key={`${i}-${msg.text}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeSlideUp`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-1 mr-1.5">
                  VL
                </div>
              )}
              <div className="max-w-[82%]">
                <div
                  className={`text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gray-700 text-white rounded-tr-sm"
                      : "bg-gray-800 text-gray-100 rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {/* AI が考えている：タイピングインジケーター */}
          {phase === "thinking" && (
            <div className="flex justify-start gap-1.5 animate-fadeSlideUp">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-1">
                VL
              </div>
              <div className="bg-gray-800 px-3 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* マイク UI ：状態ごとに見た目が変わる */}
        <div className="flex flex-col items-center gap-2 pt-2">
          {/* 音声波形ビジュアライザ（listening / speaking 時のみ出す） */}
          {(phase === "listening" || phase === "speaking") && (
            <div className="flex items-end gap-[3px] h-4">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full ${
                    phase === "listening" ? "bg-red-400" : "bg-indigo-400"
                  }`}
                  style={{
                    height: `${30 + ((i * 13) % 70)}%`,
                    animation: `voiceBar 0.9s ease-in-out ${i * 0.08}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}

          <p
            className={`text-xs transition-colors ${
              phase === "listening"
                ? "text-red-400"
                : phase === "thinking"
                  ? "text-indigo-300"
                  : phase === "speaking"
                    ? "text-indigo-300"
                    : "text-gray-600"
            }`}
          >
            {phaseLabel}
          </p>

          <div className="relative">
            {/* 録音中のリングパルス */}
            {phase === "listening" && (
              <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            )}
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                phase === "listening"
                  ? "bg-red-500 scale-110 shadow-red-900/60"
                  : "bg-gray-700 shadow-gray-900/60"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes voiceBar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
