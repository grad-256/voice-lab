"use client";

/**
 * 「これ言えなかった」モーダル（mvp-scope.md 3.6 節 / Sprint 3）。
 *
 * 入力：ユーザーが言えなかった日本語（prefillJaText で最初の案内を入れる）
 * 動作：`/api/suggest` で英訳候補 1〜3 個を取得 → 各候補を <VoicePlayButton /> + [ 保存する ]
 *        保存は `/api/saved-phrases`（認証ユーザーのみ）。ゲストはログイン導線に差し替える。
 * 発火：保存成功で `phrase_saved_from_chat`
 *
 * 責務境界：
 *   - 再生ロジック本体は `<VoicePlayButton />` に委譲
 *   - 既存の会話ステート（messages / processAudioRef 等）には触れない（3.6 節）
 */

import { VoicePlayButton } from "@/app/components/VoicePlayButton";
import type { SuggestPhrase, SuggestResponse } from "@/lib/suggest";
import Link from "next/link";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SavePhraseModalProps {
  open: boolean;
  onRequestClose: () => void;
  /** 初期の日本語テキスト（ユーザー発話バブルから渡す） */
  prefillJaText: string;
  /**
   * ユーザーが直前に英語で発話した文（Whisper 出力）。
   * モーダル冒頭に「さっき言ったのは」として参考表示する。
   */
  referenceUserText?: string;
  /** 分身の声 voice_id。null の場合は再生ボタンが無効化され、親が導線を出す */
  voiceId: string | null;
  /** ゲストなら保存ボタンをログイン導線に差し替える */
  isGuest: boolean;
}

type SuggestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; phrases: SuggestPhrase[]; fallback: boolean }
  | { kind: "error"; message: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; phraseId: string }
  | { kind: "saved"; phraseId: string }
  | { kind: "error"; phraseId: string; message: string };

export function SavePhraseModal({
  open,
  onRequestClose,
  prefillJaText,
  referenceUserText,
  voiceId,
  isGuest,
}: SavePhraseModalProps) {
  const [jaText, setJaText] = useState(prefillJaText);
  const [suggestState, setSuggestState] = useState<SuggestState>({ kind: "idle" });
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  // 保存済みフレーズ ID（per-suggest サイクルでリセット）。
  // 閉じ → 再オープンではリセットしない：新しい候補は新 UUID を持つため衝突せず、
  // 同じ候補は DB 側の unique 制約（user_id, en_text_normalized）で弾かれる。
  const [savedPhraseIds, setSavedPhraseIds] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // open 変化で <dialog> の showModal / close を呼ぶ（native のフォーカストラップと Escape に乗る）
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  // open / prefill 変化で入力ステートのみ初期化（候補・保存履歴は保持）
  useEffect(() => {
    if (open) {
      setJaText(prefillJaText);
      setSaveState({ kind: "idle" });
      setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
  }, [open, prefillJaText]);

  const handleRequestSuggest = useCallback(async () => {
    const text = jaText.trim();
    if (text.length === 0) {
      setSuggestState({ kind: "error", message: "日本語で伝えたい内容を入力してください" });
      return;
    }

    // 新しい候補セットに入るので「保存済み」履歴をここでリセット（モーダル開閉ではリセットしない）
    setSavedPhraseIds(new Set());
    setSaveState({ kind: "idle" });
    setSuggestState({ kind: "loading" });
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ja_text: text }),
      });
      if (!res.ok) {
        throw new Error("英訳候補の取得に失敗しました");
      }
      const data = (await res.json()) as SuggestResponse;
      if (!data.phrases || data.phrases.length === 0) {
        throw new Error("英訳候補が見つかりませんでした");
      }
      setSuggestState({
        kind: "ready",
        phrases: data.phrases,
        fallback: data.fallback ?? false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "英訳候補の取得に失敗しました。もう一度お試しください";
      setSuggestState({ kind: "error", message });
    }
  }, [jaText]);

  const handleSave = useCallback(
    async (phrase: SuggestPhrase) => {
      if (isGuest) return; // 親がログイン導線に誘導している前提
      if (savedPhraseIds.has(phrase.phrase_id)) return;

      setSaveState({ kind: "saving", phraseId: phrase.phrase_id });
      try {
        const res = await fetch("/api/saved-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ja_text: jaText.trim() || null,
            en_text: phrase.en_text,
            source: "user" as const,
            phrase_id_ref: phrase.phrase_id,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          // 既存レコードあり（unique 制約）は「保存済み」扱いにして UI を揃える
          if (res.status === 409 && data.code === "ALREADY_SAVED") {
            setSavedPhraseIds((prev) => {
              const next = new Set(prev);
              next.add(phrase.phrase_id);
              return next;
            });
            setSaveState({ kind: "saved", phraseId: phrase.phrase_id });
            return;
          }
          throw new Error(data.error ?? "保存に失敗しました");
        }
        setSavedPhraseIds((prev) => {
          const next = new Set(prev);
          next.add(phrase.phrase_id);
          return next;
        });
        setSaveState({ kind: "saved", phraseId: phrase.phrase_id });
        posthog.capture("phrase_saved_from_chat", {
          ja_text_len: jaText.trim().length,
          en_text_len: phrase.en_text.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "保存に失敗しました";
        setSaveState({ kind: "error", phraseId: phrase.phrase_id, message });
      }
    },
    [isGuest, jaText, savedPhraseIds]
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <dialog> native の Escape キー処理と close イベントがキーボード等価操作として機能する（onClose で親 state を追従）
    <dialog
      ref={dialogRef}
      aria-labelledby="save-phrase-modal-title"
      onClose={() => {
        // Escape や背景クリック起点で閉じた場合、親 state をここで追従させる
        if (open) onRequestClose();
      }}
      onClick={(e) => {
        // 背景（dialog 本体）クリックで閉じる。内側の form/div クリックは currentTarget と一致しない
        if (e.target === e.currentTarget) onRequestClose();
      }}
      className="max-w-lg w-full rounded-xl border border-gray-700 bg-gray-900 p-0 text-gray-100 backdrop:bg-black/70"
    >
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="save-phrase-modal-title" className="text-lg font-semibold text-white">
            これ言えなかった
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onRequestClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-400">
          日本語で書いてください。分身の声で英訳を聞き、気に入ったものを保存できます。
        </p>
        {referenceUserText && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 px-3 py-2 text-xs text-gray-400">
            <span className="text-gray-500">さっき言ったのは：</span> {referenceUserText}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-gray-300">伝えたかった日本語</span>
          <textarea
            value={jaText}
            onChange={(e) => setJaText(e.target.value)}
            rows={3}
            maxLength={400}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100 focus:border-indigo-500 focus:outline-none"
            placeholder="例：週末にディズニーに行ったよ"
          />
        </label>

        <button
          type="button"
          onClick={handleRequestSuggest}
          disabled={suggestState.kind === "loading"}
          className="w-full rounded-lg bg-indigo-600 py-2 text-base font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {suggestState.kind === "loading" ? "英訳を考えています…" : "英訳候補を出す"}
        </button>

        {suggestState.kind === "error" && (
          <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">
            {suggestState.message}
          </p>
        )}

        {suggestState.kind === "ready" && (
          <div className="space-y-3">
            {suggestState.fallback && (
              <p className="text-xs text-amber-400">
                ※ API が一時的に利用できないため、汎用フレーズを表示しています
              </p>
            )}
            {suggestState.phrases.map((phrase) => {
              const saved = savedPhraseIds.has(phrase.phrase_id);
              const saveErrorForThis =
                saveState.kind === "error" && saveState.phraseId === phrase.phrase_id
                  ? saveState.message
                  : null;
              const saving = saveState.kind === "saving" && saveState.phraseId === phrase.phrase_id;

              return (
                <div
                  key={phrase.phrase_id}
                  className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/60 p-3"
                >
                  <p className="text-xs text-gray-400">{phrase.ja_intent}</p>
                  <p className="text-base text-white">{phrase.en_text}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <VoicePlayButton
                      phraseId={phrase.phrase_id}
                      enText={phrase.en_text}
                      voiceId={voiceId}
                      source="user"
                    />
                    {isGuest ? (
                      <Link
                        href="/login?mode=signup"
                        onClick={() =>
                          posthog.capture("signup_cta_clicked", {
                            source: "save_phrase_modal",
                            action: "signup",
                          })
                        }
                        className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:border-gray-400 hover:text-white"
                      >
                        登録して保存
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSave(phrase)}
                        disabled={saved || saving}
                        className="rounded-lg border border-indigo-500 px-4 py-2 text-sm text-indigo-200 transition-colors hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saved ? "保存済み" : saving ? "保存中…" : "保存する"}
                      </button>
                    )}
                    {voiceId === null && (
                      <Link
                        href="/settings/voice"
                        className="text-xs text-gray-400 underline hover:text-gray-200"
                      >
                        先に分身の声を作る
                      </Link>
                    )}
                  </div>
                  {saveErrorForThis && (
                    <p className="text-xs text-red-300" role="alert">
                      {saveErrorForThis}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </dialog>
  );
}
