export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;

    if (!audio) {
      return Response.json({ error: "音声データが見つかりません" }, { status: 400 });
    }

    // MIME タイプから拡張子を決定（Safari は mp4、Chrome は webm）
    const mimeType = audio.type || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";

    // OpenAI Whisper API に送信
    const openaiForm = new FormData();
    openaiForm.append("file", audio, `audio.${ext}`);
    openaiForm.append("model", "whisper-1"); // 安定版
    // language 指定なし → 自動検出（日本語・英語どちらでも認識）

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Whisper API error:", error);
      return Response.json({ error: "音声認識に失敗しました" }, { status: 500 });
    }

    const data = (await response.json()) as { text: string };
    return Response.json({ text: data.text });
  } catch (err) {
    console.error("transcribe error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
