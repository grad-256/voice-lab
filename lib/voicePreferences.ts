/**
 * 日記返答の読み上げ声を管理する localStorage ベースの軽量モジュール。
 *
 * 方針：
 *   - Quiet Journal 特化後、8 枠類似度マッチングは撤去済み。声は「プリセットから 1 つ選ぶ」簡易版のみ残す。
 *   - 選択は localStorage に保存（認証不要）。DB 永続化は将来の課題。
 *   - 必要であれば NEXT_PUBLIC_ELEVENLABS_VOICE_ID_* 環境変数でフォールバック voice_id を上書きできる。
 */

export type PresetVoiceId = "ethan" | "sarah" | "adam";

export interface PresetVoice {
  id: PresetVoiceId;
  /** ElevenLabs の voice_id。NEXT_PUBLIC_* で注入されなければ公開フォールバックを使う。 */
  voiceId: string;
}

// ElevenLabs の公開プリセット voice_id をフォールバックに採用。
// 日記の読み上げに合う落ち着いた 3 声（男性 × 2、女性 × 1）で構成。
// 表示用の label / description は messages/{ja,en}.json の settings.voice.presets.{id} を参照。
export const PRESET_VOICES: readonly PresetVoice[] = [
  {
    id: "ethan",
    voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID_ETHAN ?? "hmVgSRXAUU4D4E9yl5iw",
  },
  {
    id: "sarah",
    voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID_SARAH ?? "EXAVITQu4vr4xnSDxMaL",
  },
  {
    id: "adam",
    voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID_ADAM ?? "pNInz6obpgDQGcFmaJgB",
  },
];

const STORAGE_KEY = "voice_preference_id";

/** voiceId が設定されているプリセットだけを返す（env 未設定で空になった項目は除外）。 */
export function getAvailableVoices(): readonly PresetVoice[] {
  return PRESET_VOICES.filter((v) => v.voiceId !== "");
}

/**
 * localStorage に保存された選択を読む。SSR 環境や未選択時は null。
 * 旧バージョンで保存された "female" / "masaru" は、それぞれ "sarah" / null として扱う
 * （UI から再選択してもらう方針。破壊的移行ではなく沈黙で落とす）。
 */
export function getSelectedVoiceId(): PresetVoiceId | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "ethan" || raw === "sarah" || raw === "adam") return raw;
  // 旧 "female" は Sarah に互換マッピング
  if (raw === "female") return "sarah";
  return null;
}

/** 選択を localStorage に書き込む。SSR 環境では何もしない。 */
export function setSelectedVoiceId(id: PresetVoiceId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

/**
 * 現在選択中の声オブジェクトを返す。
 * - 未選択 or 保存値が有効でない場合は available の先頭（= ethan）を返す。
 * - available が空の場合は PRESET_VOICES[0] にフォールバック。
 */
export function getSelectedVoice(): PresetVoice {
  const selected = getSelectedVoiceId();
  const available = getAvailableVoices();
  if (selected) {
    const match = available.find((v) => v.id === selected);
    if (match) return match;
  }
  return available[0] ?? PRESET_VOICES[0];
}
