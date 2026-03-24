export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;

    if (!audio) {
      return Response.json({ error: "音声データが見つかりません" }, { status: 400 });
    }

    // OpenAI Whisper API に送信
    const openaiForm = new FormData();
    openaiForm.append("file", audio, "audio.webm");
    openaiForm.append("model", "gpt-4o-mini-transcribe"); // whisper-1 も可
    openaiForm.append("language", "en"); // 英語固定（語学学習用）

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

    const data = await response.json() as { text: string };
    return Response.json({ text: data.text });
  } catch (err) {
    console.error("transcribe error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
