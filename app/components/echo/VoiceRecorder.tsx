"use client";

import {
  type SupportedMimeType,
  mapGetUserMediaError,
  pickBrowserMimeType,
} from "@/lib/recordingMime";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 「分身の声」作成フロー用の録音 UI 枠組み（Sprint 1 / mvp-scope.md 6 章 / Q8 B 案）。
 *
 * 責務：
 * - マイク取得 → `MediaRecorder` 起動 → 停止 → Blob 生成までを担当
 * - 最低録音時間（既定 8 秒）に満たない停止操作はブロック
 * - 最大録音時間（既定 15 秒）到達で自動停止
 * - 経過秒数と残り秒数を親に可視化する
 *
 * 非責務（親コンポーネントが担う）：
 * - 同意チェックボックス（Q7 パターン A 文言）
 * - 録音完了後の Blob → 特徴量抽出・Blob 破棄
 * - エラー時の具体的なリカバリ導線
 */

export type VoiceRecorderStatus = "idle" | "preparing" | "recording" | "finalizing";

export interface VoiceRecorderCompletePayload {
  blob: Blob;
  mimeType: SupportedMimeType;
  /**
   * `recorder.start()` から `onstop` 到達までの実測時間（ms）。
   *
   * 最低録音時間（`minRecordingMs`）のガードは本コンポーネントが責任を持つため、
   * 親側で `durationMs < minRecordingMs` を弾く再チェックは不要。
   * `MediaRecorder.stop()` は残存バッファ吐き出し分だけ `onstop` が遅れるため、
   * 停止ボタン押下時刻よりも数十〜数百 ms 大きい値が返りうる点に留意。
   */
  durationMs: number;
}

export interface VoiceRecorderProps {
  /** 最低録音時間（ms）。既定 8000。これ未満で stop が呼ばれても無視される */
  minRecordingMs?: number;
  /** 最大録音時間（ms）。既定 15000。到達時に自動停止する */
  maxRecordingMs?: number;
  /** 録音完了時に呼ばれる。Blob の破棄責任は呼び出し側 */
  onComplete: (payload: VoiceRecorderCompletePayload) => void;
  /** ユーザーに日本語でフィードバックする文言を返す */
  onError?: (message: string) => void;
  /** 親都合で録音開始を無効化したい場合（例：同意未チェック） */
  disabled?: boolean;
}

const DEFAULT_MIN_RECORDING_MS = 8000;
const DEFAULT_MAX_RECORDING_MS = 15000;
// 100ms 毎に経過秒数を更新。setInterval のドリフトより Date.now() 差分優先
const TICK_MS = 100;

export function VoiceRecorder({
  minRecordingMs = DEFAULT_MIN_RECORDING_MS,
  maxRecordingMs = DEFAULT_MAX_RECORDING_MS,
  onComplete,
  onError,
  disabled = false,
}: VoiceRecorderProps) {
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  // ref 側は再レンダー非依存のランタイム資源（cleanup 必須）
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<SupportedMimeType | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onComplete / onError をステートから読みたいが、props 更新時に recorder.onstop を
  // 張り替えるのを避けるため ref で最新版を保持する（stale closure 対策）
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // アンマウント時のクリーンアップ。録音中・タイマー・マイクストリームを全て止める
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // 既に停止済みなら無視
        }
      }
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  // ref のみを触るヘルパーは安定した参照が必要。useCallback で deps 追跡の対象に入れる
  const clearTimers = useCallback((): void => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const releaseStream = useCallback((): void => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    // 二重起動防御：status だけでなくラン タイム資源（recorder / stream）の有無もチェック。
    // 非同期 await 中に再レンダーで status が古く見えるケースでも安全に弾く
    if (recorderRef.current || streamRef.current) return;
    if (status !== "idle" || disabled) return;
    setStatus("preparing");

    const mimeType = pickBrowserMimeType();
    if (!mimeType) {
      setStatus("idle");
      onErrorRef.current?.("このブラウザは録音に対応していません");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus("idle");
      onErrorRef.current?.(mapGetUserMediaError(err));
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      for (const t of stream.getTracks()) t.stop();
      setStatus("idle");
      onErrorRef.current?.(`このブラウザの録音形式 (${mimeType}) はサポートされていません`);
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearTimers();
      const durationMs = Date.now() - startedAtRef.current;
      const mt = mimeTypeRef.current;
      const blob = new Blob(chunksRef.current, { type: mt ?? "audio/webm" });
      chunksRef.current = [];
      releaseStream();
      recorderRef.current = null;
      setElapsedMs(0);
      setStatus("idle");

      if (!mt) {
        onErrorRef.current?.("録音の後処理に失敗しました");
        return;
      }
      if (blob.size === 0) {
        onErrorRef.current?.("録音データが取得できませんでした。もう一度お試しください");
        return;
      }
      onCompleteRef.current({ blob, mimeType: mt, durationMs });
    };

    recorder.onerror = () => {
      clearTimers();
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
      setElapsedMs(0);
      setStatus("idle");
      onErrorRef.current?.("録音中にエラーが発生しました");
    };

    // 100ms 単位でチャンクを吐くと最後の onstop までに十分なデータが貯まる
    recorder.start(100);
    recorderRef.current = recorder;
    streamRef.current = stream;
    mimeTypeRef.current = mimeType;
    startedAtRef.current = Date.now();
    setStatus("recording");
    setElapsedMs(0);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, TICK_MS);

    autoStopRef.current = setTimeout(() => {
      // 最大時間到達による自動停止
      if (recorderRef.current && recorderRef.current.state === "recording") {
        setStatus("finalizing");
        recorderRef.current.stop();
      }
    }, maxRecordingMs);
  }, [status, disabled, maxRecordingMs, clearTimers, releaseStream]);

  const stop = useCallback(() => {
    if (status !== "recording") return;
    // 自動停止と手動停止のレースで二重 stop を防ぐため、レコーダー実体の状態も再確認
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < minRecordingMs) {
      const remaining = Math.ceil((minRecordingMs - elapsed) / 1000);
      onErrorRef.current?.(
        `最低 ${Math.ceil(minRecordingMs / 1000)} 秒録音してください（あと ${remaining} 秒）`
      );
      return;
    }
    setStatus("finalizing");
    try {
      recorder.stop();
    } catch {
      // 既に停止済みなら onstop が来ているはず
    }
  }, [status, minRecordingMs]);

  const minSec = Math.ceil(minRecordingMs / 1000);
  const maxSec = Math.floor(maxRecordingMs / 1000);
  const elapsedSec = Math.min(maxSec, Math.floor(elapsedMs / 1000));
  const reachedMin = elapsedMs >= minRecordingMs;
  const remainingToMinSec = Math.max(0, Math.ceil((minRecordingMs - elapsedMs) / 1000));
  const isBusy = status === "preparing" || status === "finalizing";

  return (
    <div className="flex flex-col items-center gap-4" data-testid="voice-recorder">
      <div
        className="text-5xl font-mono font-bold tabular-nums text-white tracking-tight"
        aria-live="polite"
        aria-label={`録音時間 ${elapsedSec} 秒 / 最大 ${maxSec} 秒`}
      >
        <span className={status === "recording" ? "text-rose-400" : ""}>
          {elapsedSec.toString().padStart(2, "0")}
        </span>
        <span className="text-gray-500"> / {maxSec}</span>
        <span className="text-gray-400 text-2xl ml-1">秒</span>
      </div>

      {status === "recording" && !reachedMin && (
        <p className="text-sm text-gray-300">
          最低 <span className="text-white font-semibold">{minSec} 秒</span>
          （あと <span className="text-white font-semibold">{remainingToMinSec} 秒</span>）
        </p>
      )}

      {status === "recording" && reachedMin && (
        <p className="text-sm text-emerald-400">停止できます（最大 {maxSec} 秒で自動停止）</p>
      )}

      {status === "idle" && (
        <button
          type="button"
          onClick={start}
          disabled={disabled || isBusy}
          className="rounded-full bg-rose-500 hover:bg-rose-400 px-8 py-3 text-white font-semibold shadow-lg shadow-rose-900/40 disabled:opacity-40 disabled:hover:bg-rose-500 transition-colors"
        >
          録音する
        </button>
      )}

      {status === "recording" && (
        <button
          type="button"
          onClick={stop}
          disabled={!reachedMin}
          className="rounded-full bg-gray-700 hover:bg-gray-600 px-8 py-3 text-white font-semibold shadow-lg disabled:opacity-40 disabled:hover:bg-gray-700 transition-colors"
        >
          停止する
        </button>
      )}

      {isBusy && (
        <output className="text-sm text-gray-400">
          {status === "preparing" ? "マイクを準備中…" : "録音を保存中…"}
        </output>
      )}
    </div>
  );
}
