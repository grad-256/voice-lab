export const runtime = "edge";

import { callTTS } from "./_lib/tts";
import type { RequestBody } from "./_lib/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body.text) {
      return Response.json({ error: "テキストが空です" }, { status: 400 });
    }

    const result = await callTTS(body);
    if (result.error) return result.error;
    return result.response;
  } catch (err) {
    console.error("speak error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
