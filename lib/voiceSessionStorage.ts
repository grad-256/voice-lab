/**
 * ゲスト（未認証）ユーザーの「分身の声」voice_id を localStorage で保持する純粋関数群。
 *
 * mvp-scope.md 3.7 節：認証済みは `voice_sessions` テーブル、ゲストは localStorage。
 * ログイン時に本キーから値を取り出して `POST /api/voice-session` に upsert する経路は
 * 別 PR（onAuthStateChange トリガー）で実装する。
 *
 * SSR セーフ：`typeof localStorage === "undefined"` でガード。
 */

export const VOICE_SESSION_STORAGE_KEY = "vl_guest_selected_voice_id";

// API 側と同じく、極端に長い値・改行混入は不正データとして扱う
const MAX_VOICE_ID_LENGTH = 64;

export function getGuestSelectedVoiceId(): string | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(VOICE_SESSION_STORAGE_KEY);
  if (value === null) return null;
  // 過去に書き込まれた壊れた値（空文字・改行混入）は null 扱いにして安全に剥がす
  if (value.length === 0 || value.length > MAX_VOICE_ID_LENGTH || /[\r\n\t]/.test(value)) {
    return null;
  }
  return value;
}

export function setGuestSelectedVoiceId(voiceId: string): void {
  if (typeof localStorage === "undefined") return;
  if (voiceId.length === 0 || voiceId.length > MAX_VOICE_ID_LENGTH || /[\r\n\t]/.test(voiceId)) {
    throw new Error("setGuestSelectedVoiceId: voiceId の形式が不正です");
  }
  localStorage.setItem(VOICE_SESSION_STORAGE_KEY, voiceId);
}

export function clearGuestSelectedVoiceId(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(VOICE_SESSION_STORAGE_KEY);
}
