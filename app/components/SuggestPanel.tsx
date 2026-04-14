"use client";

/**
 * サジェストパネル（mvp-scope.md 3.4・3.6 節 / Sprint 4）。
 *
 * 会話前（`before_chat`）・キャラ返答後（`during_chat`）に表示し、
 * `/api/suggest` を呼んでフレーズ 1〜3 件を出す。各フレーズに
 *   - `<VoicePlayButton />`（分身の声で再生 → recent_played_phrases に記録）
 *   - [ このフレーズで話す ]（親に onPrefill を渡す：次発話の id 突合に使う）
 *   - [ 保存する ]（認証ユーザーのみ。ゲストは登録導線）
 * を配置。
 *
 * 責務境界（3.6 節）：
 *   - 既存 `messages` は **読み取り専用** で受ける
 *   - `processAudioRef` / `MIN_RECORDING_MS` / MIME 判定 には触れない
 *   - `/api/chat` は呼ばない
 */

import { VoicePlayButton } from "@/app/components/VoicePlayButton";
import type {
  SuggestPhrase,
  SuggestRecentMessage,
  SuggestResponse,
  SuggestTiming,
} from "@/lib/suggest";
import Link from "next/link";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SuggestPanelProps {
  timing: SuggestTiming;
  /** true のときだけ API を呼ぶ（親が設定と表示タイミングを制御） */
  active: boolean;
  personaId?: string | null;
  /** 会話履歴（読み取り専用・末尾 N 件を /api/suggest に渡す） */
  recentMessages: SuggestRecentMessage[];
  /** `before_chat` の場合のヒント日本語（persona の style_prompt から親が渡す。空でも可） */
  hintJaText?: string;
  /** 分身の声。null ならプレイボタンが無効化される */
  voiceId: string | null;
  /** ゲスト判定（保存ボタンをログイン導線に差し替える） */
  isGuest: boolean;
  /** [ このフレーズで話す ] 押下：親が次発話の id 突合用に phrase_id / en_text を保持する */
  onPrefill: (phrase: SuggestPhrase) => void;
  /** 保存成功時のコールバック（親が「保存しました」トーストなどに使える） */
  onSaved?: (phrase: SuggestPhrase) => void;
  /** サジェスト取得失敗時の補助通知（親で必要なら表示） */
  onError?: (message: string) => void;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; phrases: SuggestPhrase[]; fallback: boolean }
  | { kind: "error"; message: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; phraseId: string }
  | { kind: "saved"; phraseId: string }
  | { kind: "error"; phraseId: string; message: string };

// active になったときに渡す「文脈の指紋」。これが変わったときだけ再取得する。
function buildContextKey(
  timing: SuggestTiming,
  personaId: string | null | undefined,
  recent: SuggestRecentMessage[]
): string {
  const tail = recent
    .slice(-4)
    .map((m) => `${m.role}:${m.content}`)
    .join("|");
  return `${timing}::${personaId ?? ""}::${tail}`;
}

export function SuggestPanel({
  timing,
  active,
  personaId,
  recentMessages,
  hintJaText,
  voiceId,
  isGuest,
  onPrefill,
  onSaved,
  onError,
}: SuggestPanelProps) {
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());

  const lastContextKeyRef = useRef<string | null>(null);
  const shownKeyRef = useRef<string | null>(null);
  // onError は stale を避けるため ref 経由で参照（依存から外すため）
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // active + 文脈変化 で再取得。abort controller で race を避ける。
  useEffect(() => {
    if (!active) {
      // 非表示に戻ったら次回 active で確実に再取得できるよう状態をクリア
      setFetchState((prev) => (prev.kind === "idle" ? prev : { kind: "idle" }));
      lastContextKeyRef.current = null;
      shownKeyRef.current = null;
      return;
    }

    const key = buildContextKey(timing, personaId, recentMessages);
    if (lastContextKeyRef.current === key) return;
    lastContextKeyRef.current = key;

    const controller = new AbortController();
    (async () => {
      setFetchState({ kind: "loading" });
      setSaveState({ kind: "idle" });
      setSavedIds(new Set());
      setClickedActions(new Set());
      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ja_text: hintJaText ?? "",
            persona_id: personaId ?? undefined,
            recent_messages: recentMessages.slice(-6),
            timing,
          }),
        });
        if (!res.ok) {
          throw new Error("サジェストの取得に失敗しました");
        }
        const data = (await res.json()) as SuggestResponse;
        if (!data.phrases || data.phrases.length === 0) {
          throw new Error("サジェストが見つかりませんでした");
        }
        setFetchState({
          kind: "ready",
          phrases: data.phrases,
          fallback: data.fallback ?? false,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "サジェストの取得に失敗しました";
        setFetchState({ kind: "error", message });
        onErrorRef.current?.(message);
      }
    })();

    return () => controller.abort();
  }, [active, timing, personaId, recentMessages, hintJaText]);

  // ready になったタイミングで suggest_shown を 1 回だけ発火（同一文脈での重複防止）
  useEffect(() => {
    if (fetchState.kind !== "ready") return;
    const key = lastContextKeyRef.current;
    if (!key || shownKeyRef.current === key) return;
    shownKeyRef.current = key;
    posthog.capture("suggest_shown", {
      timing,
      phrase_count: fetchState.phrases.length,
      fallback: fetchState.fallback,
    });
  }, [fetchState, timing]);

  const captureClick = useCallback(
    (action: "play" | "prefill" | "save", phraseId: string) => {
      const tag = `${phraseId}:${action}`;
      if (clickedActions.has(tag)) return;
      setClickedActions((prev) => {
        const next = new Set(prev);
        next.add(tag);
        return next;
      });
      posthog.capture("suggest_clicked", { timing, action });
    },
    [clickedActions, timing]
  );

  const handleSave = useCallback(
    async (phrase: SuggestPhrase) => {
      captureClick("save", phrase.phrase_id);
      if (isGuest) return;
      if (savedIds.has(phrase.phrase_id)) return;

      setSaveState({ kind: "saving", phraseId: phrase.phrase_id });
      try {
        const res = await fetch("/api/saved-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ja_text: phrase.ja_intent,
            en_text: phrase.en_text,
            source: "suggest" as const,
            phrase_id_ref: phrase.phrase_id,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          if (res.status === 409 && data.code === "ALREADY_SAVED") {
            setSavedIds((prev) => new Set(prev).add(phrase.phrase_id));
            setSaveState({ kind: "saved", phraseId: phrase.phrase_id });
            return;
          }
          throw new Error(data.error ?? "保存に失敗しました");
        }
        setSavedIds((prev) => new Set(prev).add(phrase.phrase_id));
        setSaveState({ kind: "saved", phraseId: phrase.phrase_id });
        posthog.capture("phrase_saved_from_chat", {
          ja_text_len: phrase.ja_intent.length,
          en_text_len: phrase.en_text.length,
          source: "suggest",
        });
        onSaved?.(phrase);
      } catch (err) {
        const message = err instanceof Error ? err.message : "保存に失敗しました";
        setSaveState({ kind: "error", phraseId: phrase.phrase_id, message });
      }
    },
    [captureClick, isGuest, savedIds, onSaved]
  );

  const handlePrefillClick = useCallback(
    (phrase: SuggestPhrase) => {
      captureClick("prefill", phrase.phrase_id);
      onPrefill(phrase);
    },
    [captureClick, onPrefill]
  );

  const handlePlayStart = useCallback(
    (phraseId: string) => {
      captureClick("play", phraseId);
      return true;
    },
    [captureClick]
  );

  if (!active) return null;

  return (
    <section
      aria-label={timing === "before_chat" ? "会話開始前のサジェスト" : "次に言えるフレーズ"}
      className="mx-1 my-3 rounded-xl border border-indigo-900/40 bg-indigo-950/30 p-3 shadow-lg shadow-indigo-950/20"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-indigo-300">
          {timing === "before_chat" ? "こう切り出してみる？" : "次の一言"}
        </h3>
        {fetchState.kind === "ready" && fetchState.fallback && (
          <span className="text-[10px] text-amber-400">汎用フレーズ</span>
        )}
      </div>

      {fetchState.kind === "loading" && (
        <p className="mt-2 text-sm text-gray-400">サジェストを生成中…</p>
      )}

      {fetchState.kind === "error" && (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {fetchState.message}
        </p>
      )}

      {fetchState.kind === "ready" && (
        <ul className="mt-2 space-y-2">
          {fetchState.phrases.map((phrase) => {
            const saved = savedIds.has(phrase.phrase_id);
            const saving = saveState.kind === "saving" && saveState.phraseId === phrase.phrase_id;
            const saveError =
              saveState.kind === "error" && saveState.phraseId === phrase.phrase_id
                ? saveState.message
                : null;
            return (
              <li
                key={phrase.phrase_id}
                className="space-y-2 rounded-lg border border-indigo-900/30 bg-gray-900/70 p-3"
              >
                <p className="text-xs text-indigo-200/80">{phrase.ja_intent}</p>
                <p className="text-base text-white">{phrase.en_text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <VoicePlayButton
                    phraseId={phrase.phrase_id}
                    enText={phrase.en_text}
                    voiceId={voiceId}
                    source="suggest"
                    onPlayStart={handlePlayStart}
                  />
                  <button
                    type="button"
                    onClick={() => handlePrefillClick(phrase)}
                    className="rounded-lg border border-indigo-500 px-3 py-1.5 text-xs text-indigo-200 transition-colors hover:bg-indigo-600 hover:text-white"
                  >
                    このフレーズで話す
                  </button>
                  {isGuest ? (
                    <Link
                      href="/login?mode=signup"
                      onClick={() => {
                        captureClick("save", phrase.phrase_id);
                        posthog.capture("signup_cta_clicked", {
                          source: "suggest_panel",
                          action: "signup",
                        });
                      }}
                      className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:border-gray-400 hover:text-white"
                    >
                      登録して保存
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSave(phrase)}
                      disabled={saved || saving}
                      className="rounded-lg border border-indigo-500 px-3 py-1.5 text-xs text-indigo-200 transition-colors hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saved ? "保存済み" : saving ? "保存中…" : "保存する"}
                    </button>
                  )}
                  {voiceId === null && (
                    <Link
                      href="/settings/voice"
                      className="text-[10px] text-gray-400 underline hover:text-gray-200"
                    >
                      先に分身の声を作る
                    </Link>
                  )}
                </div>
                {saveError && (
                  <p className="text-[11px] text-rose-300" role="alert">
                    {saveError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
