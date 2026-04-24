import { anthropicEndpoint, gatewayAuthHeaders } from "@/lib/aiGateway";
import { type ChatLocale, buildDiarySystemPrompt, parseClaudeResponse } from "@/lib/chat";
import type { Message } from "./types";

type LLMParams = {
  message?: string;
  history: Message[];
  assistantFirst?: boolean;
  pastSummaries?: string[];
  safeLocale: ChatLocale;
  isLastTurn?: boolean;
};

type LLMResult = { response: Response; error: null } | { response: null; error: Response };

export async function callLLM(params: LLMParams): Promise<LLMResult> {
  const { message, history, assistantFirst, pastSummaries, safeLocale, isLastTurn } = params;

  // Anthropic API は空 messages を拒否するため、assistant-first 起動時はダミー user を入れて挨拶を誘導する。
  // セッションマーカーを UI ロケールと同言語にすることで OPENING の言語指示と矛盾させない。
  const sessionMarker = safeLocale === "en" ? "(session start)" : "（セッション開始）";
  let messages: Message[];
  if (message) {
    messages = [...history, { role: "user", content: message }];
  } else if (assistantFirst && history.length === 0) {
    messages = [{ role: "user", content: sessionMarker }];
  } else {
    messages = [...history];
  }

  if (messages.length === 0) {
    return {
      response: null,
      error: Response.json({ error: "メッセージが空です" }, { status: 400 }),
    };
  }

  const closingHint = isLastTurn
    ? '\n\nCLOSING — THIS IS THE LAST EXCHANGE:\nAfter responding to what the user just said, naturally wrap up the conversation with a warm, Baymax-style closing. Something like "もう大丈夫だよ" / "今日も話してくれてありがとう" / "またいつでも来てね" in Japanese, or "You\'re gonna be okay" / "Thanks for sharing today" / "Come back anytime" in English. Keep it brief and genuine — do NOT ask another question.'
    : "";
  const systemStr = buildDiarySystemPrompt({ pastSummaries, locale: safeLocale }) + closingHint;

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
      return {
        response: null,
        error: Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 }),
      };
    }
    return {
      response: null,
      error: Response.json({ error: "AI 応答の取得に失敗しました" }, { status: 500 }),
    };
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  const raw = data.content[0]?.text ?? "";
  const { reply, translation } = parseClaudeResponse(raw);
  return { response: Response.json({ text: reply, translation }), error: null };
}
