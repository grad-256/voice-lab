"use client";

import { recordPlayedPhrase } from "@/lib/playedPhraseHistory";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 分身の声でフレーズを再生する共通ボタン（mvp-scope.md 3.6 節 / Sprint 2 で新設）。
 *
 * Sprint 3 以降、会話画面のサジェストや「これ言えなかった」モーダルからも再利用する。
 * Sprint 4 で再生成功時に `sessionStorage` の `recent_played_phrases` に記録する責務を追加。
 *
 * 責務：
 *   - `voiceId` で `/api/speak` を呼び、返ってきた MP3 を再生する
 *   - 再生開始で `phrase_play`、同一マウント内の 2 回目以降で `phrase_replay` を PostHog 発火
 *   - 再生成功時に `recent_played_phrases`（sessionStorage / 30 分 TTL）へ push
 *   - 親へは `onPlayStart` / `onPlayEnd` / `onPlayError` でコールバック通知
 *
 * 非責務：
 *   - ゲスト利用回数の管理・上限モーダルの表示（親側で onPlayStart を受けて処理）
 *   - 永続化（`play_logs` は mvp-scope.md 3.10 節で不採用）
 */

export interface VoicePlayButtonProps {
  /** 再生対象フレーズの安定 ID（PostHog キー・突合に使用） */
  phraseId: string;
  /** 英文テキスト（そのまま ElevenLabs に渡す） */
  enText: string;
  /**
   * 分身の声の voice_id。`null` の場合はボタンを無効化し、
   * 親側で「先に分身の声を作る」導線を出すことを期待する。
   */
  voiceId: string | null;
  /** 計測用：場面から再生された場合の場面 ID */
  sceneId?: string;
  /**
   * `recent_played_phrases` に記録する際の出所タグ。
   * 突合ロジック（phrase_used_in_chat）で `source` をそのまま利用する。
   */
  source: "preset" | "user" | "suggest" | "saved" | "scene-ai";
  /**
   * PostHog 発火・`/api/speak` 呼び出し前に呼ばれる。
   * `false` を返すと再生をキャンセルする（ゲスト上限到達などで親側が中断したい場合）。
   * `true` / `undefined`（戻り値なし）は通常続行を意味する。
   */
  onPlayStart?: (phraseId: string) => boolean | undefined;
  /** 再生完了時に呼ばれる（`scene_completed` 判定に使う） */
  onPlayEnd?: (phraseId: string) => void;
  /** 再生失敗時に呼ばれる（親でトースト表示など） */
  onPlayError?: (message: string) => void;
  /** ラベルを上書きしたい場合 */
  label?: string;
}

type PlayState = "idle" | "loading" | "playing" | "error";

export function VoicePlayButton({
  phraseId,
  enText,
  voiceId,
  sceneId,
  source,
  onPlayStart,
  onPlayEnd,
  onPlayError,
  label,
}: VoicePlayButtonProps) {
  const [state, setState] = useState<PlayState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playedPhraseIdsRef = useRef<Set<string>>(new Set());

  // コールバックの最新参照（再レンダで stale にならないように）
  const onPlayEndRef = useRef(onPlayEnd);
  const onPlayErrorRef = useRef(onPlayError);
  useEffect(() => {
    onPlayEndRef.current = onPlayEnd;
    onPlayErrorRef.current = onPlayError;
  }, [onPlayEnd, onPlayError]);

  // アンマウント時に音声停止・Blob URL 解放
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const disabled = voiceId === null || state === "loading" || state === "playing";

  const handleClick = useCallback(async () => {
    if (voiceId === null) return;
    if (state === "loading" || state === "playing") return;

    // 親にゲスト上限などのチェックを委ねる。false なら再生せず中断する。
    const permission = onPlayStart?.(phraseId);
    if (permission === false) return;

    // 初回 vs リプレイ判定（マウント内スコープ）
    const isReplay = playedPhraseIdsRef.current.has(phraseId);
    playedPhraseIdsRef.current.add(phraseId);

    posthog.capture(isReplay ? "phrase_replay" : "phrase_play", {
      phrase_id: phraseId,
      voice_id: voiceId,
      ...(sceneId ? { scene_id: sceneId } : {}),
    });

    setState("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: enText, voiceId }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("ElevenLabs の利用枠を超えました。少し時間を空けてください");
        }
        throw new Error("音声の生成に失敗しました");
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" });

      // 前回の Blob URL を解放してから新規割当
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setState("idle");
        onPlayEndRef.current?.(phraseId);
      };
      audio.onerror = () => {
        setState("error");
        setErrorMsg("音声の再生に失敗しました");
        onPlayErrorRef.current?.("音声の再生に失敗しました");
      };
      await audio.play();
      setState("playing");

      // 再生開始に成功した時点で突合履歴へ記録する（mvp-scope.md 4.5 節）。
      // 失敗時は記録しない（上の catch に抜ける）。
      recordPlayedPhrase({
        phrase_id: phraseId,
        en_text: enText,
        source,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "再生に失敗しました";
      setState("error");
      setErrorMsg(message);
      onPlayErrorRef.current?.(message);
    }
  }, [voiceId, state, phraseId, sceneId, enText, source, onPlayStart]);

  const buttonLabel = (() => {
    if (state === "loading") return "読み込み中…";
    if (state === "playing") return "再生中…";
    return label ?? "▶ 分身の声で聞く";
  })();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={state === "loading" || state === "playing"}
        className="inline-flex items-center gap-1.5 self-start rounded-full bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-rose-900/40 transition-colors"
      >
        {buttonLabel}
      </button>
      {errorMsg && (
        <p className="text-xs text-rose-300" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
