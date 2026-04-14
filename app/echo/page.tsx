"use client";

// 静的プリレンダリングを無効化（クライアント専用 API を使うため）
export const dynamic = "force-dynamic";

import { ConsentCheckbox } from "@/app/components/echo/ConsentCheckbox";
import { VoiceCandidateCard } from "@/app/components/echo/VoiceCandidateCard";
import {
  VoiceRecorder,
  type VoiceRecorderCompletePayload,
} from "@/app/components/echo/VoiceRecorder";
import { extractPitchHz, extractSpectralCentroid } from "@/lib/audioFeatures";
import { decodeRecordingToMono } from "@/lib/decodeRecording";
import { PRESET_VOICES, type PresetVoice } from "@/lib/presetVoices";
import { type VoiceMatchResult, normalizeFeatures, rankVoices } from "@/lib/voiceMatcher";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `/echo` ルート — 「分身の声」作成画面（Sprint 1 / mvp-scope.md 7.Q9）。
 *
 * フロー：
 *   consent → ready → 録音 → analyzing → candidates → select → done
 *
 * 録音 Blob は `decodeAudioData` 後に即破棄。
 * 特徴量ベクトルは候補ランキング後に state から消去（mvp-scope.md 3.10 節）。
 */

type EchoStatus = "consent" | "ready" | "analyzing" | "candidates" | "extract-failed";

// 分析中 UI の最低表示時間（ms）。実際の抽出が早すぎても急にカードが出ないようにする。
// mvp-scope.md Q8：「分析中アニメーション 2〜3 秒」を満たす最小値
const MIN_ANALYZING_MS = 2000;

export default function EchoPage() {
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState<EchoStatus>("consent");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matches, setMatches] = useState<VoiceMatchResult[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<PresetVoice | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // useEffect deps から analyze 関数を独立にするため、最新版を ref で持つ
  const analyzeRef = useRef<((blob: Blob) => Promise<void>) | null>(null);

  // ページ離脱時の保険：万一残った matches も破棄
  useEffect(() => {
    return () => {
      setMatches([]);
    };
  }, []);

  const handleConsentChange = useCallback((checked: boolean) => {
    setConsented(checked);
    setErrorMsg(null);
    setStatus((prev) => {
      // 分析中・候補表示中・抽出失敗表示中はチェック変更で巻き戻さない
      // （extract-failed の「録音し直す」導線を保持するため）
      if (prev === "analyzing" || prev === "candidates" || prev === "extract-failed") {
        return prev;
      }
      return checked ? "ready" : "consent";
    });
  }, []);

  const analyze = useCallback(async (blob: Blob) => {
    setStatus("analyzing");
    setErrorMsg(null);
    setMatches([]);
    setSelectedVoice(null);

    const startedAt = Date.now();

    // 録音 Blob は decodeAudioData 後に明示破棄する（mvp-scope.md 3.10 節「即破棄」）。
    // クロージャ捕捉でも GC が走らないため、let で受けて null 代入で参照を切る。
    let mutableBlob: Blob | null = blob;

    try {
      const { samples, sampleRate } = await decodeRecordingToMono(mutableBlob);
      // ここで Blob の役目は完了。参照を即破棄する（後続の MIN_ANALYZING_MS 待ちで残らないように）
      mutableBlob = null;

      const pitch = extractPitchHz(samples, sampleRate);
      const centroid = extractSpectralCentroid(samples, sampleRate);

      if (pitch.pitchHz === null && centroid.centroidHz === null) {
        setStatus("extract-failed");
        setErrorMsg(
          "声の特徴をうまく取れませんでした。マイクから少し離れて、ふつうの会話くらいの声で録り直してください。"
        );
        // try 内で早期 return しても finally で参照断ちを保証する
        mutableBlob = null;
        return;
      }

      const target = normalizeFeatures({
        pitchHz: pitch.pitchHz,
        centroidHz: centroid.centroidHz,
      });
      const ranked = rankVoices(target, PRESET_VOICES);

      // 分析中アニメーションの最低表示時間を守る
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_ANALYZING_MS) {
        await new Promise((r) => setTimeout(r, MIN_ANALYZING_MS - elapsed));
      }

      setMatches(ranked);
      setStatus("candidates");
    } catch (err) {
      console.error("echo analyze error:", err);
      setStatus("extract-failed");
      setErrorMsg(
        err instanceof Error
          ? `音声の解析に失敗しました：${err.message}`
          : "音声の解析に失敗しました"
      );
    } finally {
      // decode 失敗・抽出失敗のいずれの経路でも Blob 参照を確実に切る
      mutableBlob = null;
    }
  }, []);

  useEffect(() => {
    analyzeRef.current = analyze;
  }, [analyze]);

  const handleRecordComplete = useCallback((payload: VoiceRecorderCompletePayload) => {
    // payload を捕捉せず Blob だけ analyze に渡す（呼び出し側スコープから即時解放）
    analyzeRef.current?.(payload.blob);
  }, []);

  const handleRecordError = useCallback((message: string) => {
    setErrorMsg(message);
  }, []);

  const handleRetry = useCallback(() => {
    setMatches([]);
    setSelectedVoice(null);
    setErrorMsg(null);
    setStatus(consented ? "ready" : "consent");
  }, [consented]);

  const handleSelectVoice = useCallback((voice: PresetVoice) => {
    setSelectedVoice(voice);
    // MVP 段階では DB に保存しない（Sprint 後半で /api/voice-session を追加）。
    // 現状は state 保持のみ。
  }, []);

  const handlePreviewStart = useCallback((voiceId: string) => {
    setPlayingVoiceId(voiceId);
  }, []);

  const handlePreviewEnd = useCallback(() => {
    setPlayingVoiceId(null);
  }, []);

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
        disabled={status === "analyzing" || status === "candidates"}
      />

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
        {status === "analyzing" && <AnalyzingPanel />}

        {status === "candidates" && (
          <CandidatesPanel
            matches={matches}
            selected={selectedVoice}
            playingVoiceId={playingVoiceId}
            onSelect={handleSelectVoice}
            onPreviewStart={handlePreviewStart}
            onPreviewEnd={handlePreviewEnd}
            onRetry={handleRetry}
          />
        )}

        {status === "extract-failed" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-base text-rose-200">{errorMsg}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-rose-500 hover:bg-rose-400 px-6 py-2 text-sm font-medium text-white"
            >
              録音し直す
            </button>
          </div>
        )}

        {(status === "consent" || status === "ready") && (
          <VoiceRecorder
            disabled={!consented}
            onComplete={handleRecordComplete}
            onError={handleRecordError}
          />
        )}
      </section>

      {errorMsg && status !== "extract-failed" && (
        <p
          className="rounded-xl bg-rose-950/60 border border-rose-900 p-3 text-sm text-rose-200"
          role="alert"
        >
          {errorMsg}
        </p>
      )}

      {!consented && status === "consent" && (
        <p className="text-center text-xs text-gray-500">
          録音を始めるには、上の同意にチェックを入れてください。
        </p>
      )}
    </main>
  );
}

// -------------------------------------------------------
// 内部コンポーネント
// -------------------------------------------------------

function AnalyzingPanel() {
  // 単純スピナー禁止（mvp-scope.md Q8）。3 段階のフェードでテキストを切り替える
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 700);
    return () => clearInterval(id);
  }, []);

  const messages = [
    "声を聴いています…",
    "あなたの声の特徴を取り出しています…",
    "似た声を探しています…",
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              phase === i ? "bg-rose-400" : "bg-gray-700"
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-gray-300" aria-live="polite">
        {messages[phase]}
      </p>
    </div>
  );
}

interface CandidatesPanelProps {
  matches: VoiceMatchResult[];
  selected: PresetVoice | null;
  playingVoiceId: string | null;
  onSelect: (voice: PresetVoice) => void;
  onPreviewStart: (voiceId: string) => void;
  onPreviewEnd: () => void;
  onRetry: () => void;
}

function CandidatesPanel({
  matches,
  selected,
  playingVoiceId,
  onSelect,
  onPreviewStart,
  onPreviewEnd,
  onRetry,
}: CandidatesPanelProps) {
  if (matches.length === 0) {
    return <div className="text-center text-sm text-gray-400">候補が見つかりませんでした。</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-base text-white">あなたに近い声を {matches.length} 件見つけました</p>
        <p className="mt-1 text-xs text-gray-500">
          試聴して気に入った声を「この声にする」で選んでください
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {matches.map((m, idx) => (
          <li key={m.voice.voiceId}>
            <VoiceCandidateCard
              voice={m.voice}
              score={m.score}
              rank={idx + 1}
              onSelect={onSelect}
              selected={selected?.voiceId === m.voice.voiceId}
              onPreviewStart={onPreviewStart}
              onPreviewEnd={onPreviewEnd}
              otherIsPlaying={playingVoiceId !== null && playingVoiceId !== m.voice.voiceId}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-center pt-2">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-gray-400 hover:text-white underline-offset-2 hover:underline"
        >
          録音し直す
        </button>
      </div>

      {selected && (
        <p className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-center text-sm text-emerald-200">
          「{selected.description}」を分身の声にしました。
          <br />
          <span className="text-xs text-emerald-300/80">
            （現バージョンではこの選択は端末内のみ。次回起動時には再度選び直してください）
          </span>
        </p>
      )}
    </div>
  );
}
