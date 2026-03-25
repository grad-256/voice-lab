"use client";

// 静的プリレンダリングを無効化（Supabase クライアントはビルド時に初期化できないため）
export const dynamic = "force-dynamic";

import { VOICE_OPTIONS, createPersona } from "@/lib/personas";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ────────────────────────────────────────────────
// キャラ作成フォーム
// ────────────────────────────────────────────────

// 話し方プリセット
const STYLE_PRESETS = [
  {
    label: "😊 フレンドリーな友達",
    name: "Emma",
    value:
      "You are Emma, a bubbly and encouraging 24-year-old from Toronto. You love chatting about everyday life, travel, and pop culture. Use casual, natural English with contractions and common slang. Never correct grammar mid-sentence — wait until the end of their thought, then gently rephrase it correctly. Keep the energy upbeat and fun!",
  },
  {
    label: "😤 スパルタ英語コーチ",
    name: "Coach Mike",
    value:
      "You are Coach Mike, a no-nonsense English drill instructor. Stop the user IMMEDIATELY when they make a grammar mistake and make them repeat the correct version out loud. Use short, punchy sentences. Push them hard. No small talk — every word counts. Your motto: 'Perfect practice makes perfect.'",
  },
  {
    label: "👔 外資系ビジネスメンター",
    name: "Sarah",
    value:
      "You are Sarah, a senior consultant at a global firm in New York. Speak in polished, professional English. Teach the user how to phrase ideas for board meetings, emails to executives, and client negotiations. Point out when phrasing sounds too casual for a business context and offer a more appropriate alternative.",
  },
  {
    label: "🎤 スラング＆ストリート英語",
    name: "Jake",
    value:
      "You are Jake, a 22-year-old from LA who grew up on hip-hop culture. Teach the user real street slang, internet English, and how young Americans actually talk — not textbook English. Use heavy slang yourself. React with surprise or amusement when they use overly formal phrases and show them how to say it the cool way.",
  },
] as const;

export default function NewPersonaPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [stylePrompt, setStylePrompt] = useState<string>(STYLE_PRESETS[0].value);
  const [voiceId, setVoiceId] = useState<string>(VOICE_OPTIONS[0].id);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !stylePrompt.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await createPersona({
        name: name.trim(),
        style_prompt: stylePrompt.trim(),
        voice_id: voiceId,
      });
      router.push("/personas");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "作成に失敗しました");
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors"
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-white">キャラクターを作成</h1>
        <p className="text-xs text-gray-400 mt-1">話し相手の設定を入力してください</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 名前 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            キャラクター名
            <span className="text-gray-500 font-normal ml-2">（会話相手の AI に付ける名前）</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="例：Emma"
            maxLength={20}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>

        {/* 話し方プリセット */}
        <div>
          <p className="block text-sm font-medium text-gray-300 mb-2">話し方プリセット</p>
          <div className="space-y-2">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setStylePrompt(preset.value);
                  setName(preset.name);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                  stylePrompt === preset.value
                    ? "border-indigo-500 bg-indigo-900/40 text-white"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* システムプロンプト（カスタム編集） */}
        <div>
          <label htmlFor="style_prompt" className="block text-sm font-medium text-gray-300 mb-2">
            プロンプト（自由編集）
          </label>
          <textarea
            id="style_prompt"
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            required
            rows={5}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Claude へのシステムプロンプト。英語で書くと精度が上がります。
          </p>
        </div>

        {/* ボイス選択 */}
        <div>
          <label htmlFor="voice_id" className="block text-sm font-medium text-gray-300 mb-2">
            ボイス
          </label>
          <select
            id="voice_id"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* エラー */}
        {errorMsg && (
          <div className="px-4 py-3 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-sm">
            {errorMsg}
          </div>
        )}

        {/* 送信 */}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {loading ? "作成中..." : "キャラクターを作成"}
        </button>
      </form>
    </main>
  );
}
