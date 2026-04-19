export const runtime = "edge";

// ElevenLabs の標準ボイス ID
// ダッシュボードで確認・変更可能: https://elevenlabs.io/voice-lab
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "hmVgSRXAUU4D4E9yl5iw";

export async function POST(req: Request) {
  try {
    const { text, voiceId } = (await req.json()) as { text: string; voiceId?: string };

    if (!text) {
      return Response.json({ error: "テキストが空です" }, { status: 400 });
    }

    // キャラのボイス ID を優先し、なければ環境変数 → 既定の VOICE_ID の順で使用
    const resolvedVoiceId = voiceId ?? VOICE_ID;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3", // 最速・低レイテンシ
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
