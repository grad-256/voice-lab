"use client";

import { Cap, Waves } from "@/app/components/chapter";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Phase = "idle" | "listening" | "thinking" | "speaking";

// LP 用の録音デモ。/diary の実視覚仕様（user=serif 本文 / assistant=左縦罫+Cap+serif）を
// 電話モック枠に閉じ込める。
export default function ChatDemo() {
  const t = useTranslations("lp.chatDemo");
  const conversation = useMemo(() => t.raw("conversation") as { role: Role; text: string }[], [t]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const showNext = (index: number) => {
      if (index >= conversation.length) {
        timeout = setTimeout(() => {
          setVisibleCount(0);
          setPhase("idle");
          timeout = setTimeout(() => showNext(0), 500);
        }, 3000);
        return;
      }

      const msg = conversation[index];

      if (msg.role === "assistant") {
        setPhase("thinking");
        timeout = setTimeout(() => {
          setPhase("speaking");
          setVisibleCount(index + 1);
          const speakingMs = Math.min(2400, 800 + msg.text.length * 80);
          timeout = setTimeout(() => {
            setPhase("idle");
            timeout = setTimeout(() => showNext(index + 1), 400);
          }, speakingMs);
        }, 900);
      } else {
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

  // 擬似経過時間（visibleCount 連動）。
  const fakeElapsedSec = Math.min(59, visibleCount * 7 + (phase === "listening" ? 3 : 0));
  const elapsedLabel = `00:${String(fakeElapsedSec).padStart(2, "0")}`;
  const wavesActive = phase === "listening" ? 1 : phase === "speaking" ? 0.7 : 0.25;

  return (
    <div
      className="relative w-full overflow-hidden flex flex-col h-[560px] shadow-theme-md"
      style={{
        background: "var(--bg)",
        border: "0.5px solid var(--border-strong)",
        borderRadius: 14,
      }}
    >
      <div
        className="px-5 pt-3 pb-2 flex justify-between items-center text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]"
        style={{ fontFamily: MONO_FAMILY }}
      >
        <span>9:41</span>
        <span className="relative inline-block w-[14px] h-[7px] border-[0.5px] border-[var(--fg-muted)]">
          <span
            aria-hidden
            className="absolute"
            style={{
              top: 1,
              left: 1,
              right: 1,
              bottom: 1,
              background: "var(--fg-muted)",
            }}
          />
        </span>
      </div>

      <div className="px-5 pt-2 pb-3 flex items-center justify-between text-xs uppercase tracking-[0.32em] text-[var(--fg-muted)] border-b border-[var(--border)]">
        <span>{t("headerLabel")}</span>
        <span>{t("entryLabel")}</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pt-4 pb-3 space-y-4 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        <Cap mb={0}>{t("liveLabel")}</Cap>

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div
              key={`${i}-${msg.text}`}
              className="animate-fadeSlideUp text-base leading-[1.7]"
              style={{
                fontFamily: SERIF_FAMILY,
                color: "var(--fg)",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </div>
          ) : (
            <div
              key={`${i}-${msg.text}`}
              className="animate-fadeSlideUp"
              style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 12 }}
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-1">
                {t("quietVoice")}
              </div>
              <div
                className="text-sm leading-[1.55]"
                style={{
                  fontFamily: SERIF_FAMILY,
                  color: "var(--fg)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.text}
              </div>
            </div>
          )
        )}

        {phase === "thinking" && (
          <div
            className="animate-fadeSlideUp"
            style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 12 }}
          >
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-1">
              {t("quietVoice")}
            </div>
            <div className="flex items-center gap-1 py-[3px]">
              <span className="w-1 h-1 bg-[var(--fg-muted)] animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 bg-[var(--fg-muted)] animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 bg-[var(--fg-muted)] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pt-3 pb-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block w-[7px] h-[7px] rounded-full"
            style={{
              backgroundColor: "var(--fg)",
              opacity: phase === "listening" ? 1 : 0.35,
            }}
          />
          <span
            className="text-xs tracking-[0.06em]"
            style={{ fontFamily: MONO_FAMILY, color: "var(--fg)" }}
          >
            {elapsedLabel}
          </span>
          <div className="flex-1">
            <Waves n={28} h={12} active={wavesActive} />
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--fg-muted)]">
            {phaseLabel}
          </span>
        </div>

        <div className="flex items-center justify-center mt-4">
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: phase === "listening" ? "var(--fg)" : "transparent",
              border:
                phase === "listening"
                  ? "0.5px solid var(--fg)"
                  : "0.5px solid var(--border-strong)",
            }}
          >
            <Mic
              size={18}
              strokeWidth={1.5}
              color={phase === "listening" ? "var(--bg)" : "var(--fg-muted)"}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div className="absolute left-1/2 bottom-[6px] -translate-x-1/2">
        <span
          aria-hidden
          className="block"
          style={{
            width: 64,
            height: 3,
            borderRadius: 2,
            background: "var(--fg)",
            opacity: 0.35,
          }}
        />
      </div>
    </div>
  );
}
