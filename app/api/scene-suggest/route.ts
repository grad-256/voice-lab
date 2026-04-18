export const runtime = "edge";

/**
 * `/api/scene-suggest` — `/echo` プリセット場面の 3 フレーズを動的生成する。
 *
 * mvp-scope.md 7.Q1 で確定した 7 場面の「情景」「感情」を文脈として渡し、
 * Claude Sonnet 4.5 で文脈適合度の高いフレーズを返す。
 * 障害時は `lib/sceneSuggest.buildFallbackPhrases(scene_id)` で 3 件を返す（UX 優先）。
 *
 * `/api/chat` への混入は禁止（mvp-scope.md 3.9 / 決定事項 14）。
 */

import { anthropicEndpoint } from "@/lib/aiGateway";
import {
  SCENE_SUGGEST_MODEL,
  type SceneSuggestRequest,
  type SceneSuggestResponse,
  type SceneSuggestedPhrase,
  buildFallbackPhrases,
  buildSceneSuggestSystemPrompt,
  buildSceneSuggestUserContent,
  parseSceneSuggestResponse,
  toSceneSuggestedPhrases,
} from "@/lib/sceneSuggest";

const MAX_SCENE_ID_LENGTH = 64;
const MAX_SITUATION_LENGTH = 400;
const MAX_EMOTION_LENGTH = 200;
const MAX_USER_CONTEXT_LENGTH = 300;

function respondWithFallback(sceneId: string): SceneSuggestResponse {
  const phrases = toSceneSuggestedPhrases(buildFallbackPhrases(sceneId), () => crypto.randomUUID());
  return { phrases, fallback: true };
}

export async function POST(req: Request) {
  let body: Partial<SceneSuggestRequest>;
  try {
    body = (await req.json()) as Partial<SceneSuggestRequest>;
  } catch {
    return Response.json({ error: "リクエスト本文の解析に失敗しました" }, { status: 400 });
  }

  const sceneId = typeof body.scene_id === "string" ? body.scene_id.trim() : "";
  const situationJa = typeof body.situation_ja === "string" ? body.situation_ja.trim() : "";
  const emotionJa = typeof body.emotion_ja === "string" ? body.emotion_ja.trim() : "";
  const userContext =
    typeof body.user_context === "string"
      ? body.user_context.trim().slice(0, MAX_USER_CONTEXT_LENGTH)
      : null;

  if (sceneId.length === 0 || sceneId.length > MAX_SCENE_ID_LENGTH) {
    return Response.json({ error: "scene_id は必須です" }, { status: 400 });
  }
  if (situationJa.length === 0 || situationJa.length > MAX_SITUATION_LENGTH) {
    return Response.json({ error: "situation_ja は必須です（400 字以内）" }, { status: 400 });
  }
  if (emotionJa.length > MAX_EMOTION_LENGTH) {
    return Response.json({ error: "emotion_ja が長すぎます" }, { status: 400 });
  }

  // Claude Sonnet 4.5 呼び出し。失敗時はフォールバック。
  let rawPhrases: Array<{ ja_intent: string; en_text: string }> = [];
  try {
    const userContent = buildSceneSuggestUserContent({
      sceneId,
      situationJa,
      emotionJa,
      userContext,
    });

    const response = await fetch(anthropicEndpoint("messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SCENE_SUGGEST_MODEL,
        max_tokens: 512,
        system: buildSceneSuggestSystemPrompt(),
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      console.warn("scene-suggest upstream non-ok:", response.status);
    } else {
      const data = (await response.json()) as {
        content?: { type: string; text: string }[];
      };
      const raw = data.content?.[0]?.text ?? "";
      rawPhrases = parseSceneSuggestResponse(raw);
      if (rawPhrases.length === 0) {
        console.warn("scene-suggest parse failed, using fallback");
      }
    }
  } catch (err) {
    console.error("scene-suggest upstream error:", err);
  }

  if (rawPhrases.length === 0) {
    return Response.json(respondWithFallback(sceneId));
  }

  const phrases: SceneSuggestedPhrase[] = toSceneSuggestedPhrases(rawPhrases, () =>
    crypto.randomUUID()
  );
  const result: SceneSuggestResponse = { phrases };
  return Response.json(result);
}
