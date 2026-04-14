"use client";

// 静的プリレンダリングを無効化（クライアント専用 API を使うため）
export const dynamic = "force-dynamic";

import { ConsentCheckbox } from "@/app/components/echo/ConsentCheckbox";
import {
  VoiceRecorder,
  type VoiceRecorderCompletePayload,
} from "@/app/components/echo/VoiceRecorder";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `/echo` ルート — 「分身の声」作成画面の骨格（Sprint 1 / mvp-scope.md 7.Q9）。
 *
 * このスプリントで組み込んでいるフロー：
 *  1. 同意チェックボックス（mvp-scope.md 7.Q7 パターン A）
 *  2. 録音 UI（VoiceRecorder、最低 8 秒〜最大 15 秒）
 *  3. 録音完了後に「受け付けました」プレースホルダ表示 + Blob を即時破棄
 *
 * Sprint 2 以降で接続する予定：
 *  - `extractPitchHz` / `extractLoudnessRms` / `extractSpectralCentroid` で特徴量抽出
 *  - `lib/presetVoices.ts` の属性ベクトルとコサイン類似度で候補 3 件生成
 *  - `POST /api/voice-session` で選択 voice_id を永続化
 */

type EchoStatus = "consent" | "ready" | "received";

export default function EchoPage() {
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState<EchoStatus>("consent");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastBlobSize, setLastBlobSize] = useState<number | null>(null);
  const [lastMimeType, setLastMimeType] = useState<string | null>(null);

  // Blob 破棄用：revokeObjectURL が必要な URL のみ保持。アンマウント時にも解放する
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleConsentChange = useCallback((checked: boolean) => {
    setConsented(checked);
    setErrorMsg(null);
    // チェックが外されたら待機状態に戻す（録音中は VoiceRecorder 側が disabled 反映）
    setStatus((prev) => {
      if (prev === "received") return prev;
      return checked ? "ready" : "consent";
    });
  }, []);

  const handleRecordComplete = useCallback((payload: VoiceRecorderCompletePayload) => {
    // MVP 骨格段階では Blob をサーバーに送らず、メタ情報だけ表示して破棄する。
    // Sprint 2 で `decodeAudioData` → 特徴量抽出 → `lib/presetVoices.ts` との類似度計算に繋ぐ。
    setLastBlobSize(payload.blob.size);
    setLastDurationMs(payload.durationMs);
    setLastMimeType(payload.mimeType);
    setStatus("received");

    // Blob 参照を即時破棄（3.10 節：「録音データは保存しません」の実装保証）
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = null;
  }, []);

  const handleRecordError = useCallback((message: string) => {
    setErrorMsg(message);
  }, []);

  const handleReset = useCallback(() => {
    setLastBlobSize(null);
    setLastDurationMs(null);
    setLastMimeType(null);
    setErrorMsg(null);
    setStatus(consented ? "ready" : "consent");
  }, [consented]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">分身の声を作る</h1>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            トップ
          </Link>
          <span className="text-gray-700">|</span>
          <Link href="/app" className="text-gray-400 hover:text-white transition-colors">
            会話に戻る
          </Link>
        </nav>
      </header>

      <ConsentCheckbox
        checked={consented}
        onChange={handleConsentChange}
        disabled={status === "received"}
      />

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        {status === "received" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-lg font-semibold text-white">録音を受け付けました</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-gray-300">
              <dt className="text-gray-500">録音時間</dt>
              <dd className="font-mono tabular-nums text-white">
                {lastDurationMs !== null ? `${(lastDurationMs / 1000).toFixed(1)} 秒` : "—"}
              </dd>
              <dt className="text-gray-500">データサイズ</dt>
              <dd className="font-mono tabular-nums text-white">
                {lastBlobSize !== null ? `${(lastBlobSize / 1024).toFixed(1)} KB` : "—"}
              </dd>
              <dt className="text-gray-500">形式</dt>
              <dd className="font-mono text-white">{lastMimeType ?? "—"}</dd>
            </dl>
            <p className="text-xs text-gray-500">
              特徴量抽出と候補マッチングは次のスプリントで実装予定です。
              録音データはこの画面上ですでに破棄されています。
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 rounded-full bg-gray-700 hover:bg-gray-600 px-5 py-2 text-sm font-medium text-white transition-colors"
            >
              もう一度録音する
            </button>
          </div>
        ) : (
          <VoiceRecorder
            disabled={!consented}
            onComplete={handleRecordComplete}
            onError={handleRecordError}
          />
        )}
      </section>

      {errorMsg && (
        <p
          className="rounded-xl bg-rose-950/60 border border-rose-900 p-3 text-sm text-rose-200"
          role="alert"
        >
          {errorMsg}
        </p>
      )}

      {!consented && status !== "received" && (
        <p className="text-center text-xs text-gray-500">
          録音を始めるには、上の同意にチェックを入れてください。
        </p>
      )}
    </main>
  );
}
