"use client";

// 静的プリレンダリングを無効化（localStorage・fetch を参照するため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { BottomTab, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { SERIF_FAMILY } from "@/lib/typography";
import {
  type PresetVoiceId,
  getAvailableVoices,
  getSelectedVoiceId,
  setSelectedVoiceId,
} from "@/lib/voicePreferences";
import { useTranslations } from "next-intl";
import { type CSSProperties, useEffect, useRef, useState } from "react";

/**
 * `/me/voice` — 日記の返答をどの声で聞くか選ぶ画面。
 *
 * 保存は localStorage のみ（認証不要）。プリセット声の一覧を `getAvailableVoices()` から取り、
 * 選択は即 `setSelectedVoiceId` で確定する（1.5 秒「保存しました」トースト）。
 * Chapter 系譜：左に声名（選択中は Fraunces italic）+ 副情報、右に試聴円ボタン + 選択ラジオ円。
 */
export default function VoiceSettingsPage() {
  const t = useTranslations("me.voice");
  const voices = getAvailableVoices();
  const [selectedId, setSelectedId] = useState<PresetVoiceId | null>(null);
  const [previewingId, setPreviewingId] = useState<PresetVoiceId | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // 試聴中の Audio 要素と object URL を破棄するためのハンドル
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedId(getSelectedVoiceId() ?? voices[0]?.id ?? null);
  }, [voices]);

  // ページ離脱時に再生中の音声と URL を確実に破棄する
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.onerror = null;
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleSelect = (id: PresetVoiceId) => {
    setSelectedVoiceId(id);
    setSelectedId(id);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 1500);
  };

  const handlePreview = async (voiceId: string, id: PresetVoiceId) => {
    // 既に再生中の audio を止める。
    // ハンドラを外してから pause することで、破棄時の error/ended イベントが
    // 新しい試聴の state を書き換えてしまう連続再生バグを防ぐ。
    if (audioRef.current) {
      audioRef.current.onerror = null;
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPreviewError(null);
    setPreviewingId(id);

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t("previewText"), voiceId }),
      });
      if (!res.ok) {
        setPreviewError(t("errors.previewFailed"));
        setPreviewingId(null);
        return;
      }

      const blob = await res.blob();
      // 念のため空・極小 blob は弾く（ElevenLabs 側の未検知エラー対策）
      if (blob.size < 128) {
        setPreviewError(t("errors.previewFailed"));
        setPreviewingId(null);
        return;
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          audioRef.current = null;
          setPreviewingId(null);
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          setPreviewError(t("errors.playbackFailed"));
          setPreviewingId(null);
        }
      };
      await audio.play();
    } catch {
      setPreviewError(t("errors.networkFailed"));
      setPreviewingId(null);
    }
  };

  const backLink: CSSProperties = {
    color: "inherit",
    textDecoration: "none",
  };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24 animate-fadeIn">
      <PageHeader
        left={
          <Link href="/me" style={backLink} className="hover:text-[var(--fg)] transition-colors">
            ← Me
          </Link>
        }
      />

      {/* 章題：Cap + Fraunces 章題 */}
      <div className="mt-6">
        <Cap mb={8}>{t("chapter.cap")}</Cap>
        <div
          className="text-3xl sm:text-4xl leading-tight tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
          }}
        >
          {t("chapter.titleLead")}
          <br />
          <span>{t("chapter.titleAccent")}</span>
          {t("chapter.titleTail")}
        </div>
      </div>

      <Rule mv={20} />

      {/* 試聴エラー */}
      {previewError && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 text-[var(--error)] text-xs sm:text-sm"
          style={{ border: "0.5px solid var(--error)" }}
        >
          {previewError}
        </div>
      )}

      {/* 声の一覧：Chapter 行レイアウト */}
      <ul className="flex-1">
        {voices.map((voice) => {
          const isSelected = selectedId === voice.id;
          const isPreviewing = previewingId === voice.id;
          const label = t(`presets.${voice.id}.label`);
          const description = t(`presets.${voice.id}.description`);
          return (
            <li
              key={voice.id}
              className="grid grid-cols-[1fr_auto] gap-3 items-center py-[14px]"
              style={{ borderBottom: "0.5px solid var(--border)" }}
            >
              {/* 左：声名（選択中は Fraunces italic）+ 副情報 */}
              <button
                type="button"
                onClick={() => handleSelect(voice.id)}
                aria-pressed={isSelected}
                className="text-left bg-transparent border-0 p-0 cursor-pointer min-w-0"
              >
                <div className="flex items-baseline gap-[10px]">
                  <span
                    className="text-xl sm:text-2xl tracking-tight"
                    style={{
                      fontFamily: SERIF_FAMILY,
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[2px] leading-[1.45]">
                  {description}
                </div>
              </button>

              {/* 右：試聴円ボタン（28px、▶︎）+ 選択ラジオ円（16px、塗りつぶし） */}
              <div className="flex items-center gap-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    if (!isPreviewing) handlePreview(voice.voiceId, voice.id);
                  }}
                  disabled={isPreviewing}
                  aria-label={t("previewAria", { label })}
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "0.5px solid var(--fg)",
                    background: "transparent",
                    cursor: isPreviewing ? "default" : "pointer",
                    opacity: isPreviewing ? 0.5 : 1,
                  }}
                >
                  {/* 三角形（▶︎） */}
                  <span
                    aria-hidden
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid var(--fg)",
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      marginLeft: 2,
                    }}
                  />
                </button>
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "0.5px solid var(--fg)",
                  }}
                >
                  {isSelected && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--fg)",
                      }}
                    />
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {voices.length === 0 && (
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] py-10 text-center">{t("empty")}</p>
      )}

      {/* 保存完了トースト */}
      {toastVisible && (
        <output
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 inline-flex items-center px-5 py-3 bg-[var(--bg-elevated)] text-[var(--fg)] text-xs sm:text-sm uppercase tracking-[0.2em] shadow-lg"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {t("saved")}
        </output>
      )}

      <BottomTab />
    </main>
  );
}
