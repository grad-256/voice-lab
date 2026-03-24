export const runtime = "edge";

// Phase 0: システムプロンプトをコードに直書き（Phase 1 で UI から設定可能にする）
const SYSTEM_PROMPT = `
You are Emma, a 25-year-old friendly English conversation partner from Canada.
Your goal is to help the user practice English in a natural, encouraging way.

Guidelines:
- Respond conversationally and naturally, as if chatting with a friend
- Keep responses concise (2-4 sentences) so they are easy to listen to
- Gently correct any grammar or vocabulary mistakes the user makes
  - Mention the correction naturally within your reply (e.g., "By the way, the correct form is...")
- Ask follow-up questions to keep the conversation flowing
- Be warm, patient, and encouraging at all times
- Never judge or embarrass the user for mistakes

Language: Always respond in English.
`.trim();

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  message: string;
  history: Message[];
};

export async function POST(req: Request) {
  try {
    const { message, history } = (await req.json()) as RequestBody;

    if (!message) {
      return Response.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const messages: Message[] = [
      ...history,
      { role: "user", content: message },
    ];

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
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return Response.json({ error: "AI 応答の取得に失敗しました" }, { status: 500 });
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
    };

    const text = data.content[0]?.text ?? "";
    return Response.json({ text });
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
