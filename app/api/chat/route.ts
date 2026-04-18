export const runtime = "edge";

import { anthropicEndpoint, gatewayAuthHeaders } from "@/lib/aiGateway";
import {
  type ChatLocale,
  type ConversationLevel,
  buildDiarySystemPrompt,
  buildSystemPrompt,
  parseClaudeResponse,
} from "@/lib/chat";

// デフォルトのシステムプロンプト（英会話モード・キャラ未設定時のフォールバック）
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
  message?: string;
  history: Message[];
  systemPrompt?: string;
  level?: ConversationLevel;
  mode?: "english" | "diary";
  assistantFirst?: boolean;
  pastSummaries?: string[];
  locale?: ChatLocale;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { message, history, systemPrompt, level, mode, assistantFirst, pastSummaries, locale } =
      body;
    const isDiary = mode === "diary";
    const safeLocale: ChatLocale = locale === "en" ? "en" : "ja";

    // 英会話モード（既存）は message 必須。日記モードは assistant-first で message 空を許容する
    if (!isDiary && !message) {
      return Response.json({ error: "メッセージが空です" }, { status: 400 });
    }

    // Anthropic API は空 messages を拒否するため、日記の assistant-first 起動時はダミー user を入れて挨拶を誘導する。
    // LANGUAGE: Mirror the user's language を優先する Claude に対して、セッションマーカーを
    // UI ロケールと同言語にすることで OPENING の言語指示と矛盾させない。
    const sessionMarker = safeLocale === "en" ? "(session start)" : "（セッション開始）";
    let messages: Message[];
    if (message) {
      messages = [...history, { role: "user", content: message }];
    } else if (isDiary && assistantFirst && history.length === 0) {
      messages = [{ role: "user", content: sessionMarker }];
    } else {
      messages = [...history];
    }

    // 空 messages で Anthropic に到達させない防御
    if (messages.length === 0) {
      return Response.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const systemStr = isDiary
      ? buildDiarySystemPrompt({ pastSummaries, locale: safeLocale })
      : buildSystemPrompt(
          systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
          level ?? "intermediate",
          safeLocale
        );

    const response = await fetch(anthropicEndpoint("messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        ...gatewayAuthHeaders(),
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemStr,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      if (response.status === 429 || response.status === 529) {
        return Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 });
      }
      return Response.json({ error: "AI 応答の取得に失敗しました" }, { status: 500 });
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const raw = data.content[0]?.text ?? "";

    const { reply, translation } = parseClaudeResponse(raw);
    return Response.json({ text: reply, translation });
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
