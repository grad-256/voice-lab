export const runtime = "edge";

// デフォルトのシステムプロンプト（キャラ未設定時のフォールバック）
const DEFAULT_SYSTEM_PROMPT = `
You are Emma, a friendly English conversation partner from Canada.

Rules:
- Keep every reply to 1-2 sentences maximum. Short and natural.
- Ask at most ONE question per reply (not multiple).
- Gently correct mistakes inline, briefly. Example: "Nice! (tip: say 'went' not 'goed') So what happened next?"
- If the user says "bye" or "goodbye", reply with a warm farewell and end the conversation naturally.
- Always respond in English only.
`.trim();

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  message: string;
  history: Message[];
  systemPrompt?: string; // キャラのシステムプロンプト（省略時はデフォルト）
};

export async function POST(req: Request) {
  try {
    const { message, history, systemPrompt } = (await req.json()) as RequestBody;

    if (!message) {
      return Response.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const messages: Message[] = [...history, { role: "user", content: message }];

    // Anthropic Claude API（fetch で直接呼び出し）
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return Response.json({ error: "AI 応答の取得に失敗しました" }, { status: 500 });
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const text = data.content[0]?.text ?? "";
    return Response.json({ text });
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
