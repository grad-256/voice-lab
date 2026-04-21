"use client";

// Chapter 系譜の音声プレイヤー。丸ボタン（ink 背景 + bg 色三角）+ 波形 + 時間表示。
// /diary/history/[id] の要約 TTS 再生で使う。波形は装飾（TTS は可変生成のため事前計算できない）。
// クリック時に `onFetchAudio` が呼ばれ、Blob を返す → 再生して currentTime / duration を追う。

import { useCallback, useEffect, useRef, useState } from "react";

const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

// 波形バーの高さ（静的な疑似ランダム）。40 本。
// 実データの波形解析はしない（TTS は可変生成 + edge runtime + 計算コスト回避）。
// 値は 0〜1 の範囲。描画時に `4 + value * 14` px にマップ。
// バー数を減らしたのは狭い画面で min-width を割ると右の時間表示に食い込むため。
const WAVEFORM_HEIGHTS = [
  0.35, 0.7, 0.45, 0.85, 0.6, 0.3, 0.55, 0.8, 0.4, 0.25, 0.65, 0.9, 0.5, 0.35, 0.7, 0.45, 0.8, 0.55,
  0.3, 0.75, 0.6, 0.4, 0.85, 0.5, 0.3, 0.65, 0.45, 0.8, 0.55, 0.35, 0.7, 0.5, 0.85, 0.4, 0.6, 0.75,
  0.3, 0.55, 0.7, 0.45,
] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type AudioPlayerProps = {
  /** クリック時に Blob を返す関数。null 返却時は再生を中止する（エラー相当）。 */
  onFetchAudio: () => Promise<Blob | null>;
  /** 再生前のラベル（SR 用） */
  playLabel: string;
  /** 再生中のラベル（SR 用） */
  pauseLabel: string;
};

export function AudioPlayer({ onFetchAudio, playLabel, pauseLabel }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    // ロード中の二重送信ガード
    if (isLoading) return;

    // 再生中ならポーズして終了
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // 既に音声をロード済みなら再生のみ（末尾まで聞き終えていた場合は先頭に巻き戻す）
    if (audioRef.current && audioRef.current.duration > 0) {
      try {
        if (audioRef.current.currentTime >= audioRef.current.duration) {
          audioRef.current.currentTime = 0;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    // 初回：fetch → Audio 作成 → 再生
    setIsLoading(true);
    try {
      const blob = await onFetchAudio();
      if (!mountedRef.current) return;
      if (!blob) {
        setIsLoading(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => {
        if (!mountedRef.current) return;
        setDuration(audio.duration || 0);
      });
      audio.addEventListener("timeupdate", () => {
        if (!mountedRef.current) return;
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        if (!mountedRef.current) return;
        // 次回クリックで頭から再生できるように、ended 時に先頭へ戻しておく
        audio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTime(0);
      });
      audio.addEventListener("error", () => {
        if (!mountedRef.current) return;
        setIsPlaying(false);
        setIsLoading(false);
      });

      await audio.play();
      if (!mountedRef.current) return;
      setIsPlaying(true);
      setIsLoading(false);
    } catch {
      if (mountedRef.current) {
        setIsPlaying(false);
        setIsLoading(false);
      }
    }
  }, [isPlaying, isLoading, onFetchAudio]);

  // 波形バーの再生済み割合（0〜1）
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="flex items-center gap-4">
      {/* 丸ボタン：ink 背景 + bg 色の三角（ポーズ時は 2 本線） */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={isPlaying ? pauseLabel : playLabel}
        disabled={isLoading}
        className="shrink-0 rounded-full flex items-center justify-center transition-opacity"
        style={{
          width: 54,
          height: 54,
          backgroundColor: "var(--fg)",
          color: "var(--bg)",
          cursor: isLoading ? "wait" : "pointer",
          opacity: isLoading ? 0.6 : 1,
          border: "none",
        }}
      >
        {isPlaying ? (
          // ポーズ：2 本線（bg 色）
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5" fill="currentColor">
            <title>{pauseLabel}</title>
            <rect x="7" y="5" width="3.5" height="14" />
            <rect x="13.5" y="5" width="3.5" height="14" />
          </svg>
        ) : (
          // 再生：右向き三角。視覚的中心に寄せるため少し右にオフセット
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="w-5 h-5"
            fill="currentColor"
            style={{ marginLeft: 2 }}
          >
            <title>{playLabel}</title>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* 波形バー群。再生進捗に応じて前側の色を ink にする。
          min-w-0 + overflow-hidden で、狭い画面でもコンテナ幅に収まり、
          右隣の時間表示に食い込まないようにする。バーは minWidth 無しで均等に縮む。 */}
      <div
        className="flex-1 flex items-center gap-[2px] min-w-0 overflow-hidden"
        aria-hidden
        style={{ height: 22 }}
      >
        {WAVEFORM_HEIGHTS.map((h, i) => {
          const ratio = (i + 0.5) / WAVEFORM_HEIGHTS.length;
          const isPast = ratio <= progress;
          return (
            <span
              key={`bar-${i}-${h}`}
              style={{
                display: "inline-block",
                flex: "1 1 0",
                minWidth: 0,
                height: 4 + h * 14,
                backgroundColor: isPast ? "var(--fg)" : "var(--fg-muted)",
                opacity: isPast ? 0.85 : 0.45,
                transition: "background-color 120ms linear, opacity 120ms linear",
              }}
            />
          );
        })}
      </div>

      {/* 時間表示："0:47 / 4:17" */}
      <span
        className="shrink-0 text-xs sm:text-sm tabular-nums tracking-[0.02em] whitespace-nowrap"
        style={{ fontFamily: MONO_FAMILY, color: "var(--fg-muted)" }}
      >
        {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "--:--"}
      </span>
    </div>
  );
}
