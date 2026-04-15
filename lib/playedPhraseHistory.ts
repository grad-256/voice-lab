/**
 * 直近で再生したフレーズの履歴（mvp-scope.md 4.5 節 / Sprint 4）。
 *
 * 目的：再生→発話の突合（`phrase_used_in_chat`）のため、`<VoicePlayButton />` が
 * 再生成功時に push し、会話送信時に `app/app/page.tsx` が読み取り・突合する。
 *
 * 保存先：`sessionStorage`（タブ単位・30 分 TTL）。DB・PostHog には送らない。
 * ページリロードをまたぐ必要はない（セッション内のみの情報）。
 *
 * ここは純関数を提供し、ブラウザ側の副作用（window 参照）を最小化する。
 */

import { normalizeEnglish } from "./normalizeEnglish";

export const PLAYED_PHRASE_TTL_MS = 30 * 60 * 1000; // 30 分
export const PLAYED_PHRASE_STORAGE_KEY = "recent_played_phrases";
// 突合時に走査するだけなので上限は緩め。異常値を入れられても性能が破綻しないよう頭打ち。
const MAX_ENTRIES = 50;

export interface PlayedPhrase {
  phrase_id: string;
  en_text_normalized: string;
  source: "preset" | "user" | "suggest" | "saved" | "scene-ai";
  played_at: number;
}

export interface PushInput {
  phrase_id: string;
  en_text: string;
  source: PlayedPhrase["source"];
  now?: number;
}

/**
 * 既存履歴に 1 件追加する（純関数）。古い/不正なエントリは prune する。
 *
 * - 同一 `phrase_id` の重複は最新で上書き（`played_at` を更新）。
 * - `now - played_at > PLAYED_PHRASE_TTL_MS` のエントリは落とす。
 * - 50 件を超える場合は古いものから削除。
 */
export function pushPlayedPhrase(current: PlayedPhrase[], input: PushInput): PlayedPhrase[] {
  const now = input.now ?? Date.now();
  const fresh = current.filter(
    (p) => typeof p.played_at === "number" && now - p.played_at <= PLAYED_PHRASE_TTL_MS
  );
  const entry: PlayedPhrase = {
    phrase_id: input.phrase_id,
    en_text_normalized: normalizeEnglish(input.en_text),
    source: input.source,
    played_at: now,
  };
  const withoutDup = fresh.filter((p) => p.phrase_id !== entry.phrase_id);
  const next = [...withoutDup, entry];
  if (next.length > MAX_ENTRIES) {
    return next.slice(next.length - MAX_ENTRIES);
  }
  return next;
}

/**
 * TTL 切れ・型不正エントリを除去（純関数）。
 */
export function pruneExpired(current: PlayedPhrase[], now: number = Date.now()): PlayedPhrase[] {
  return current.filter(
    (p) =>
      p &&
      typeof p.phrase_id === "string" &&
      typeof p.en_text_normalized === "string" &&
      typeof p.played_at === "number" &&
      (p.source === "preset" ||
        p.source === "user" ||
        p.source === "suggest" ||
        p.source === "saved" ||
        p.source === "scene-ai") &&
      now - p.played_at <= PLAYED_PHRASE_TTL_MS
  );
}

/**
 * ユーザー送信テキストに対し、直近再生履歴から最も適切なマッチを返す（純関数）。
 *
 * 突合仕様（mvp-scope.md 4.5 節）：
 * 1. 第一優先：`prefilledPhraseId` が渡されていれば ID 突合（`match_strategy: "id"`）。
 * 2. 第二優先：正規化テキスト一致（`match_strategy: "normalized_text"`）。
 *    - 複数候補がある場合は最新の `played_at` を選ぶ（ユーザーが直前に聞いた方を優先）。
 *
 * @returns マッチがあれば突合結果、なければ null。
 */
export function matchPlayedPhrase(
  userText: string,
  history: PlayedPhrase[],
  options?: { prefilledPhraseId?: string | null; now?: number }
): {
  phrase_id: string;
  source: PlayedPhrase["source"];
  match_strategy: "id" | "normalized_text";
} | null {
  const now = options?.now ?? Date.now();
  const fresh = pruneExpired(history, now);
  if (fresh.length === 0) return null;

  const prefilledId = options?.prefilledPhraseId ?? null;
  if (prefilledId) {
    const direct = fresh.find((p) => p.phrase_id === prefilledId);
    if (direct) {
      return {
        phrase_id: direct.phrase_id,
        source: direct.source,
        match_strategy: "id",
      };
    }
  }

  const userNormalized = normalizeEnglish(userText);
  if (userNormalized.length === 0) return null;

  const candidates = fresh
    .filter((p) => p.en_text_normalized === userNormalized)
    .sort((a, b) => b.played_at - a.played_at);
  const top = candidates[0];
  if (!top) return null;

  return {
    phrase_id: top.phrase_id,
    source: top.source,
    match_strategy: "normalized_text",
  };
}

// ────────────────────────────────────────────────
// sessionStorage ラッパー（ブラウザ専用・SSR 安全）
// ────────────────────────────────────────────────

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPlayedPhrases(now: number = Date.now()): PlayedPhrase[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PLAYED_PHRASE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneExpired(parsed as PlayedPhrase[], now);
  } catch {
    return [];
  }
}

export function writePlayedPhrases(next: PlayedPhrase[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PLAYED_PHRASE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError などは握り潰し（突合は best-effort）
  }
}

/**
 * 実アプリから呼ぶエントリポイント：読む → push → 書く。
 */
export function recordPlayedPhrase(input: PushInput): void {
  const current = readPlayedPhrases(input.now);
  const next = pushPlayedPhrase(current, input);
  writePlayedPhrases(next);
}
