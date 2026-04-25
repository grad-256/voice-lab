export const runtime = "edge";

import { anthropicEndpoint, gatewayAuthHeaders } from "@/lib/aiGateway";
import { CLAUDE_HAIKU } from "@/lib/models";

// 声の日記：会話履歴から title + summary を生成する。
// クライアント（/diary）が「終わり」で確定したときに呼び出し、
// 結果を /api/diary に POST して保存する流れ。

type TranscriptItem = { role: "user" | "assistant"; text: string };

type RequestBody = {
  transcript?: TranscriptItem[];
  language?: "ja" | "en" | "mixed";
};

type SummaryResult = {
  title: string;
  summary: string;
  language: "ja" | "en" | "mixed";
};

const SYSTEM_PROMPT = `You summarize voice-diary conversations into a short, readable log entry.

OUTPUT RULES:
- Return a single JSON object. No code fences. No extra text before or after.
- Format: {"title": "...", "summary": "...", "language": "ja" | "en" | "mixed"}
- title: one short headline (under ~40 characters). No emojis, no "〜について" boilerplate. Capture the main topic from the user's side.
- summary: 3-6 short lines of natural prose separated by "\\n". Keep concrete details the user mentioned. Be factual and specific.
- Mirror the user's language. If the user spoke Japanese, write in Japanese. If English, write in English. Mixed → dominant side.
- "language" field: "ja" | "en" | "mixed" matching what you wrote.
- The "role" field in the input marks who said what. The "assistant" turns are the AI partner; focus the entry on the user's content and feelings.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const transcript = body.transcript;

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return Response.json({ error: "transcript が空です" }, { status: 400 });
    }

    // ユーザー発話が 1 件もない会話は要約する意味がない
    const hasUser = transcript.some((t) => t.role === "user");
    if (!hasUser) {
      return Response.json({ error: "ユーザーの発話がありません" }, { status: 400 });
    }

    const convo = transcript
      .map((t) => `${t.role === "user" ? "User" : "AI"}: ${t.text}`)
      .join("\n");

    const res = await fetch(anthropicEndpoint("messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        ...gatewayAuthHeaders(),
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Please summarize the following conversation into the JSON format specified in the system prompt:\n\n${convo}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 529) {
        return Response.json({ error: "SERVICE_QUOTA_EXCEEDED" }, { status: 429 });
      }
      console.error("summarize claude error:", await res.text());
      return Response.json({ error: "要約の生成に失敗しました" }, { status: 500 });
    }

    const data = (await res.json()) as { content: { type: string; text: string }[] };
    const raw = data.content[0]?.text ?? "";

    const parsed = tryParseSummary(raw);
    if (!parsed) {
      console.error("summarize parse error, raw:", raw);
      return Response.json({ error: "要約の解析に失敗しました" }, { status: 500 });
    }
    return Response.json(parsed);
  } catch (err) {
    console.error("summarize error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

function tryParseSummary(raw: string): SummaryResult | null {
  const attempt = (s: string): SummaryResult | null => {
    try {
      const obj = JSON.parse(s) as { title?: unknown; summary?: unknown; language?: unknown };
      if (typeof obj.title !== "string" || typeof obj.summary !== "string") return null;
      const langRaw = typeof obj.language === "string" ? obj.language : "ja";
      const language: "ja" | "en" | "mixed" =
        langRaw === "en" ? "en" : langRaw === "mixed" ? "mixed" : "ja";
      return { title: obj.title.trim(), summary: obj.summary.trim(), language };
    } catch {
      return null;
    }
  };

  const direct = attempt(raw.trim());
  if (direct) return direct;

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const v = attempt(fence[1].trim());
    if (v) return v;
  }

  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    const v = attempt(brace[0]);
    if (v) return v;
  }

  return null;
}
