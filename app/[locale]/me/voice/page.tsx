"use client";

// 静的プリレンダリングを無効化（localStorage・fetch を参照するため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link } from "@/i18n/routing";
import {
  type PresetVoiceId,
  getAvailableVoices,
  getSelectedVoiceId,
  setSelectedVoiceId,
} from "@/lib/voicePreferences";
import { ArrowLeft, Check, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * `/me/voice` — 日記の返答をどの声で聞くか選ぶ画面。
 *
 * 保存は localStorage のみ（認証不要）。プリセット声の一覧を `getAvailableVoices()` から取り、
 * 選択は即 `setSelectedVoiceId` で確定する（1.5 秒「保存しました」トースト）。
 * Quiet Journal 仕様に合わせ、墨青アクセント + セリフ見出しで統一。
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
        // 古い audio の error/ended ハンドラを外してから停止し、
        // 破棄時に error イベントが誤発火して state が書き換えられるのを防ぐ
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

    // 1.5 秒トースト
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
        // ended は成功完了。URL を解放して idle に戻す
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
        // 現在の audio インスタンスに紐付くエラーだけを反映
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

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      {/* 戻る */}
      <header className="mb-10 text-sm tracking-wide">
        <Link
          href="/me"
          className="inline-flex items-center gap-2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {t("back")}
        </Link>
      </header>

      {/* タイトル */}
      <div className="mb-10">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--fg)] leading-relaxed">
          {t("pageTitle")}
        </h1>
        <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">{t("pageSubtitle")}</p>
      </div>

      {/* 試聴エラー */}
      {previewError && (
        <div className="mb-6 px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md">
          {previewError}
        </div>
      )}

      {/* 声の一覧 */}
      <ul className="space-y-3">
        {voices.map((voice) => {
          const isSelected = selectedId === voice.id;
          const isPreviewing = previewingId === voice.id;
          const label = t(`presets.${voice.id}.label`);
          const description = t(`presets.${voice.id}.description`);
          return (
            <li key={voice.id}>
              <div
                className={`flex items-start justify-between gap-4 p-5 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-[var(--accent)]/60 bg-[var(--accent-subtle)]"
                    : "border-[var(--border)] bg-[var(--bg-elevated)]/50 hover:border-[var(--border-strong)]"
                }`}
              >
                {/* 選択ボタン（カード全体の幅をとる） */}
                <button
                  type="button"
                  onClick={() => handleSelect(voice.id)}
                  className="flex-1 min-w-0 text-left"
                  aria-pressed={isSelected}
                >
                  <div className="text-base font-medium text-[var(--fg)]">{label}</div>
                  <div className="text-xs text-[var(--fg-muted)] mt-1 leading-relaxed">
                    {description}
                  </div>
                </button>
                {/* 試聴ボタン */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isPreviewing) handlePreview(voice.voiceId, voice.id);
                  }}
                  disabled={isPreviewing}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm tracking-wide transition-colors ${
                    isPreviewing
                      ? "border-[var(--border)] text-[var(--fg-subtle)]"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
                  }`}
                  aria-label={t("previewAria", { label })}
                >
                  <Play size={14} strokeWidth={1.5} />
                  {isPreviewing ? t("previewing") : t("preview")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {voices.length === 0 && (
        <p className="text-sm text-[var(--fg-muted)] py-10 text-center">{t("empty")}</p>
      )}

      {/* 保存完了トースト */}
      {toastVisible && (
        <output
          aria-live="polite"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--fg)] text-xs tracking-wide shadow-lg"
        >
          <Check size={14} strokeWidth={1.5} className="text-[var(--accent-strong)]" />
          {t("saved")}
        </output>
      )}
    </main>
  );
}
