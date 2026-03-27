/**
 * chat ルートの純粋関数
 * Edge Runtime に依存しないロジックを切り出してテスト可能にする
 */

// JSON 返答の指示をシステムプロンプトに付加する
export function buildSystemPrompt(base: string): string {
	return `${base}

IMPORTANT: Always respond with a JSON object in exactly this format (no other text outside the JSON):
{"reply": "<your English response>", "translation": "<Japanese translation of your reply>"}`;
}

// Claude の返答（コードフェンス付きの場合あり）を JSON にパースする
export function parseClaudeResponse(raw: string): {
	reply: string;
	translation: string | null;
} {
	try {
		// コードフェンス（```json...```）が付いている場合は除去する
		const cleaned = raw
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/\s*```$/, "")
			.trim();
		const parsed = JSON.parse(cleaned) as {
			reply?: string;
			translation?: string;
		};
		return {
			reply: parsed.reply ?? raw,
			translation: parsed.translation ?? null,
		};
	} catch {
		// パース失敗時はそのまま返す
		return { reply: raw, translation: null };
	}
}
