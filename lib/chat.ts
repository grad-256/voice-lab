/**
 * chat ルートの純粋関数
 * Edge Runtime に依存しないロジックを切り出してテスト可能にする
 */

export type ConversationLevel = "beginner" | "intermediate" | "advanced";

const LEVEL_INSTRUCTIONS: Record<ConversationLevel, string> = {
	beginner: `\
=== STRICT LEVEL RULE: BEGINNER (A1-A2) ===
You MUST follow these rules. No exceptions.
1. Your reply MUST be ONE sentence only. Never write two sentences.
2. Use ONLY the simplest everyday words a child would know.
3. NEVER use idioms, phrasal verbs, or complex grammar.
4. If you want to ask something, keep it to a single yes/no question.
Violating any of these rules is not allowed.
===========================================`,
	intermediate: `\
=== STRICT LEVEL RULE: INTERMEDIATE (B1-B2) ===
You MUST follow these rules. No exceptions.
1. Your reply MUST be 1-2 sentences only. Never write three or more sentences.
2. Use natural everyday expressions and common idioms.
3. Ask at most one question per reply.
Violating any of these rules is not allowed.
===============================================`,
	advanced: `\
=== STRICT LEVEL RULE: ADVANCED (C1) ===
You MUST follow these rules. No exceptions.
1. Your reply MUST be 2-3 sentences only. Never exceed three sentences.
2. Use rich, varied vocabulary and natural complex expressions.
3. Include idioms or nuanced phrasing where appropriate.
Violating any of these rules is not allowed.
========================================`,
};

// JSON 返答の指示をシステムプロンプトに付加する（レベル指示を先頭に置く）
export function buildSystemPrompt(base: string, level: ConversationLevel = "intermediate"): string {
	return `${LEVEL_INSTRUCTIONS[level]}

${base}

OUTPUT FORMAT — THIS OVERRIDES EVERYTHING ELSE:
You MUST respond with ONLY a JSON object. No text before or after it. No code fences.
{"reply": "<your English response>", "translation": "<Japanese translation of your reply>"}`;
}

// Claude の返答（コードフェンス付き・途中混在の場合あり）を JSON にパースする
export function parseClaudeResponse(raw: string): {
	reply: string;
	translation: string | null;
} {
	const tryParse = (s: string) => {
		const parsed = JSON.parse(s) as { reply?: string; translation?: string };
		if (typeof parsed.reply === "string") return parsed;
		return null;
	};

	// 1. そのまま JSON としてパース
	try {
		const result = tryParse(raw.trim());
		if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
	} catch {}

	// 2. コードフェンス内の JSON を抽出（文字列のどこにあっても対応）
	const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenceMatch) {
		try {
			const result = tryParse(fenceMatch[1].trim());
			if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
		} catch {}
	}

	// 3. { } で囲まれた JSON オブジェクトを抽出
	const braceMatch = raw.match(/\{[\s\S]*\}/);
	if (braceMatch) {
		try {
			const result = tryParse(braceMatch[0]);
			if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
		} catch {}
	}

	// 4. パース完全失敗時はそのまま返す
	return { reply: raw, translation: null };
}
