"use client";

import type { PresetVoice } from "@/lib/presetVoices";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 「分身の声」マッチング後の候補を 1 件分表示するカード。
 *
 * 責務：
 * - 候補 voice の説明・類似度を表示
 * - 試聴ボタン（既存 `/api/speak` を利用、`voiceId` を渡して再生）
 * - 「これにする」選択ボタン（親に通知）
 *
 * 非責務：
 * - 候補リスト全体の制御（親が複数枚並べる）
 * - DB への永続化（Sprint 後半で `/api/voice-session` を追加する想定）
 */

export interface VoiceCandidateCardProps {
  voice: PresetVoice;
  /** 0.0〜1.0 の類似度（コサイン類似度） */
  score: number;
  /** ランキング順位（1 始まり）。先頭の "おすすめ" 表記に使う */
  rank: number;
  /** 「これにする」押下時 */
  onSelect: (voice: PresetVoice) => void;
  selected?: boolean;
  /**
   * 親が「現在試聴中の voiceId」を一意に管理するための通知。
   * カードを跨いだ二重再生を防ぐため、再生開始時に親に通知する。
   */
  onPreviewStart: (voiceId: string) => void;
  /** 再生終了 / エラー / 中断のいずれでも呼ばれる */
  onPreviewEnd: () => void;
  /** 他のカードが試聴中の場合 true。試聴ボタンを disabled にする */
  otherIsPlaying: boolean;
}

// 試聴サンプル文（中文・日常会話寄り）。selection 比較しやすいよう全候補同一にする
const PREVIEW_TEXT =
  "Hi, I'd love to keep practicing with you. Let's start with something simple — how was your day?";

type PreviewState = "idle" | "loading" | "playing" | "error";

export function VoiceCandidateCard({
  voice,
  score,
  rank,
  onSelect,
  selected = false,
  onPreviewStart,
  onPreviewEnd,
  otherIsPlaying,
}: VoiceCandidateCardProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // 親への onPreviewEnd 通知の二重発火を防ぐ：finally 句や onerror が同時に発火しても 1 回だけにする
  const endNotifiedRef = useRef(false);
  const onPreviewEndRef = useRef(onPreviewEnd);
  useEffect(() => {
    onPreviewEndRef.current = onPreviewEnd;
  }, [onPreviewEnd]);

  const notifyEndOnce = useCallback(() => {
    if (endNotifiedRef.current) return;
    endNotifiedRef.current = true;
    onPreviewEndRef.current();
  }, []);

  // アンマウント時に再生中音声を停止し、Blob URL を解放、親にも end 通知
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      // 試聴中にアンマウントされた場合は親のロックを解除
      notifyEndOnce();
    };
  }, [notifyEndOnce]);

  const handlePreview = useCallback(async () => {
    if (previewState === "loading" || previewState === "playing") return;
    if (otherIsPlaying) return; // 他カード再生中は無視（disabled とのレース対策）

    setPreviewState("loading");
    setErrorMsg(null);
    endNotifiedRef.current = false;
    onPreviewStart(voice.voiceId);

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: PREVIEW_TEXT, voiceId: voice.voiceId }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("ElevenLabs の利用枠を超えました。少し時間を空けてください");
        }
        throw new Error("音声の生成に失敗しました");
      }
      const arrayBuffer = await res.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" });

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewState("idle");
        notifyEndOnce();
      };
      audio.onerror = () => {
        setPreviewState("error");
        setErrorMsg("音声の再生に失敗しました");
        notifyEndOnce();
      };
      await audio.play();
      setPreviewState("playing");
    } catch (err) {
      setPreviewState("error");
      setErrorMsg(err instanceof Error ? err.message : "再生に失敗しました");
      notifyEndOnce();
    }
  }, [previewState, otherIsPlaying, onPreviewStart, voice.voiceId, notifyEndOnce]);

  // 中心化コサイン類似度（lib/voiceMatcher.ts）の戻り値は -1〜1 を取りうる。
  //   - cos = +1 → 完全一致 → 100%
  //   - cos = 0 → 中立（中心化後ゼロ方向） → 50%
  //   - cos = -1 → 完全に逆 → 0%
  // ユーザー直感（50% 以上なら良いマッチ）に合うよう (cos + 1) / 2 にマッピングする。
  const scorePercent = Math.round(Math.max(0, Math.min(1, (score + 1) / 2)) * 100);

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${
        selected
          ? "border-emerald-500/60 bg-emerald-950/30"
          : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
      }`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
            #{rank} {rank === 1 ? "おすすめ" : "候補"}
          </span>
          <span className="text-xs text-gray-500">枠 {voice.slot}</span>
        </div>
        <span className="font-mono text-sm tabular-nums text-gray-300">類似度 {scorePercent}%</span>
      </header>

      <p className="mb-4 text-base text-white">{voice.description}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewState === "loading" || previewState === "playing" || otherIsPlaying}
          className="rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 px-5 py-2 text-sm font-medium text-white transition-colors"
        >
          {previewState === "loading" && "読み込み中…"}
          {previewState === "playing" && "再生中…"}
          {(previewState === "idle" || previewState === "error") && "▶ 試聴する"}
        </button>

        <button
          type="button"
          onClick={() => onSelect(voice)}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            selected
              ? "bg-emerald-500 text-white"
              : "bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-900/40"
          }`}
        >
          {selected ? "✓ この声にしました" : "この声にする"}
        </button>
      </div>

      {errorMsg && (
        <p className="mt-3 text-xs text-rose-300" role="alert">
          {errorMsg}
        </p>
      )}
    </article>
  );
}
