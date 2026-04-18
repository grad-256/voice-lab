export const runtime = "edge";

import { gatewayAuthHeaders, openaiEndpoint } from "@/lib/aiGateway";
import { getMimeExtension } from "@/lib/transcribe";

// Track C-4：UI ロケールを Whisper の `language` ヒントに連動させる。
// ja / en のみ許可し、それ以外は自動検出（未指定）にフォールバックする。
type TranscribeLanguage = "ja" | "en";
const ALLOWED_LANGUAGES: ReadonlySet<TranscribeLanguage> = new Set(["ja", "en"]);

function isAllowedLanguage(value: string): value is TranscribeLanguage {
  return (ALLOWED_LANGUAGES as ReadonlySet<string>).has(value);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;

    if (!audio) {
      return Response.json({ error: "音声データが見つかりません" }, { status: 400 });
    }

    // MIME タイプから拡張子を決定（Safari は mp4、Chrome は webm）
    const mimeType = audio.type || "audio/webm";
    const ext = getMimeExtension(mimeType);

    // OpenAI Whisper API に送信
    const openaiForm = new FormData();
    openaiForm.append("file", audio, `audio.${ext}`);
    openaiForm.append("model", "whisper-1"); // 安定版

    // クライアントから渡された UI ロケールを ISO-639-1 の language ヒントとして付与する。
    // 指定があると Whisper の誤検出（英語発話を日本語と取り違えるなど）を抑制できる。
    // 未指定・不正値は自動検出にフォールバック。
    const languageRaw = formData.get("language");
    if (typeof languageRaw === "string" && isAllowedLanguage(languageRaw)) {
      openaiForm.append("language", languageRaw);
    }

    const response = await fetch(openaiEndpoint("audio/transcriptions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        ...gatewayAuthHeaders(),
      },
      body: openaiForm,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Whisper API error:", error);
      if (response.status === 429) {
        return Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 });
      }
      return Response.json({ error: "音声認識に失敗しました" }, { status: 500 });
    }

    const data = (await response.json()) as { text: string };
    return Response.json({ text: data.text });
  } catch (err) {
    console.error("transcribe error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
