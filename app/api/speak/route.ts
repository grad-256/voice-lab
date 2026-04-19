export const runtime = "edge";

// ElevenLabs の標準ボイス ID
// ダッシュボードで確認・変更可能: https://elevenlabs.io/voice-lab
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "hmVgSRXAUU4D4E9yl5iw";

// 許可モデル一覧。呼び出し側が未知の文字列を送ってきた場合はフォールバックする。
const ALLOWED_MODELS = [
  "eleven_multilingual_v2", // 既定：会話ラリー・試聴向け（品質と応答速度のバランス）
  "eleven_v3", // 日記要約や場面プリセット等、レイテンシ許容・表現力重視向け
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];
const DEFAULT_MODEL: AllowedModel = "eleven_multilingual_v2";

export async function POST(req: Request) {
  try {
    const { text, voiceId, modelId } = (await req.json()) as {
      text: string;
      voiceId?: string;
      modelId?: string;
    };

    if (!text) {
      return Response.json({ error: "テキストが空です" }, { status: 400 });
    }

    // キャラのボイス ID を優先し、なければ環境変数 → 既定の VOICE_ID の順で使用
    const resolvedVoiceId = voiceId ?? VOICE_ID;

    // 呼び出し側が許可外モデル（未知文字列・空文字・null・undefined）を渡してきた場合は
    // 黙って DEFAULT にフォールバックする。ElevenLabs に未知モデル ID を流して 400 を
    // 返させるより、既定挙動に倒した方が UX・監査性とも安全。
    // `as AllowedModel` は includes() で whitelist を通過したあとの実行時ナローイング
    // （TS の型ガードとしては narrow が効かないため assertion を使う）。
    const resolvedModelId: AllowedModel = (ALLOWED_MODELS as readonly string[]).includes(
      modelId ?? ""
    )
      ? (modelId as AllowedModel)
      : DEFAULT_MODEL;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
      },
      body: JSON.stringify({
        text,
        model_id: resolvedModelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
        speed: 0.75, // 1.0が標準、0.75でゆっくり（語学学習向け）
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs API error:", error);
      if (response.status === 429) {
        return Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 });
      }
      return Response.json({ error: "音声生成に失敗しました" }, { status: 500 });
    }

    // 音声バイナリをそのままクライアントに返す
    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("speak error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
