import { ALLOWED_MODELS, type AllowedModel, DEFAULT_MODEL, type RequestBody } from "./types";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "hmVgSRXAUU4D4E9yl5iw";

type TTSResult = { response: Response; error: null } | { response: null; error: Response };

export function resolveModel(modelId: string | undefined): AllowedModel {
  return (ALLOWED_MODELS as readonly string[]).includes(modelId ?? "")
    ? (modelId as AllowedModel)
    : DEFAULT_MODEL;
}

export async function callTTS(params: RequestBody): Promise<TTSResult> {
  const { text, voiceId, modelId, speed } = params;
  const resolvedVoiceId = voiceId ?? VOICE_ID;
  const resolvedModelId = resolveModel(modelId);

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
      speed: typeof speed === "number" && speed > 0 && speed <= 4 ? speed : 0.75,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("ElevenLabs API error:", error);
    if (response.status === 429) {
      return {
        response: null,
        error: Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 }),
      };
    }
    return {
      response: null,
      error: Response.json({ error: "音声生成に失敗しました" }, { status: 500 }),
    };
  }

  const audioBuffer = await response.arrayBuffer();
  return {
    response: new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    }),
    error: null,
  };
}
