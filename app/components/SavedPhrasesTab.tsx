"use client";

import { VoicePlayButton } from "@/app/components/VoicePlayButton";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * `/echo` の「保存したフレーズ」タブ（Sprint 5 / mvp-scope.md 6 章）。
 *
 * 責務：
 *   - 認証ユーザー：`GET /api/saved-phrases` で自分の保存フレーズを取得し、source フィルタと再生・削除を提供
 *   - ゲスト：ログイン誘導 CTA を表示（GET は叩かない）
 *   - 再生は `<VoicePlayButton source="saved" />` を再利用（突合履歴にも記録される）
 */

type Source = "preset" | "user" | "suggest";
type Filter = "all" | Source;

export interface SavedPhraseItem {
  id: string;
  ja_text: string | null;
  en_text: string;
  source: Source;
  phrase_id_ref: string | null;
  created_at: string;
}

interface SavedPhrasesTabProps {
  /** 認証状態が解決する前は null。未ログイン時は false。 */
  authMode: boolean | null;
  /** `/settings/voice` で決定した分身の声。未設定時は null → 再生ボタンは無効化。 */
  voiceId: string | null;
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "preset", label: "プリセット" },
  { value: "user", label: "自分" },
  { value: "suggest", label: "サジェスト" },
];

export function SavedPhrasesTab({ authMode, voiceId }: SavedPhrasesTabProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<SavedPhraseItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = authMode === false;

  const fetchItems = useCallback(
    async (source: Filter, signal?: AbortSignal) => {
      if (isGuest || authMode === null) return;
      setLoading(true);
      setError(null);
      try {
        const url = source === "all" ? "/api/saved-phrases" : `/api/saved-phrases?source=${source}`;
        const res = await fetch(url, { signal });
        if (!res.ok) {
          throw new Error("一覧の取得に失敗しました");
        }
        const json = (await res.json()) as { items: SavedPhraseItem[] };
        if (!signal?.aborted) {
          setItems(json.items);
        }
      } catch (err) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : "一覧の取得に失敗しました";
        setError(message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [authMode, isGuest]
  );

  useEffect(() => {
    if (authMode !== true) return;
    const controller = new AbortController();
    void fetchItems(filter, controller.signal);
    return () => controller.abort();
  }, [authMode, filter, fetchItems]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("このフレーズを削除しますか？")) return;
    try {
      const res = await fetch(`/api/saved-phrases?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      setItems((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "削除に失敗しました";
      setError(message);
    }
  }, []);

  if (isGuest) {
    return (
      <section className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-8 text-center">
        <p className="text-base text-white">保存したフレーズ</p>
        <p className="mt-2 text-sm text-rose-200/80">
          保存機能はログインが必要です。アカウントを作ると、場面や会話からフレーズを溜められます。
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-rose-500 hover:bg-rose-400 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-rose-900/40 transition-colors"
        >
          ログイン / 新規登録
        </Link>
      </section>
    );
  }

  if (authMode === null) {
    return <p className="text-center text-sm text-gray-500">読み込み中…</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filter === f.value
                ? "bg-rose-500 text-white"
                : "border border-gray-700 text-gray-300 hover:border-gray-500"
            }`}
            aria-pressed={filter === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && items === null ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : items && items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 p-8 text-center">
          <p className="text-base text-white">まだ保存したフレーズはありません</p>
          <p className="mt-2 text-sm text-gray-400">
            場面の「保存」や会話画面の「これ言えなかった」で保存すると、ここに並びます。
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {items?.map((item) => (
            <li key={item.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">{sourceLabel(item.source)}</p>
                  <p className="mt-1 text-base font-semibold text-white">{item.en_text}</p>
                  {item.ja_text && <p className="mt-1 text-xs text-gray-400">{item.ja_text}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 text-xs text-gray-500 hover:text-rose-300 transition-colors"
                  aria-label="削除する"
                >
                  削除
                </button>
              </div>
              <div className="mt-3">
                <VoicePlayButton
                  phraseId={item.phrase_id_ref ?? `saved-${item.id}`}
                  enText={item.en_text}
                  voiceId={voiceId}
                  source="saved"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {voiceId === null && items && items.length > 0 && (
        <p className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-3 text-center text-sm text-rose-200">
          先に{" "}
          <Link href="/settings/voice" className="underline hover:text-white">
            分身の声を作る
          </Link>{" "}
          と、保存したフレーズを再生できます。
        </p>
      )}
    </section>
  );
}

function sourceLabel(source: Source): string {
  switch (source) {
    case "preset":
      return "プリセット場面から";
    case "user":
      return "会話で保存";
    case "suggest":
      return "サジェストから";
  }
}
