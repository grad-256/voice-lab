/**
 * Cloudflare AI Gateway 経由で OpenAI / Anthropic を叩くためのエンドポイント解決ヘルパー。
 *
 * 背景（Notion「香港ルーティング問題対応」）：
 * Cloudflare Pages Functions が日本のユーザーを香港データセンターで処理することがあり、
 * 香港の IP から OpenAI / Claude を直接叩くと両社のサポート対象外地域ブロックに引っかかる
 * （Whisper: `unsupported_country_region_territory` / Claude: `forbidden`）。
 * AI Gateway は Cloudflare のグローバルインフラ経由で LLM に接続するため、
 * Function が香港で動いても米国 IP で LLM に到達できる。
 *
 * 環境変数が揃っていない場合はフォールバックとして各プロバイダの公式エンドポイントを返すので、
 * ローカル開発・CI では従来通りの挙動を維持できる。
 */

function getGatewayBase(): string | null {
  const accountId = process.env.CF_ACCOUNT_ID;
  const gateway = process.env.CF_AI_GATEWAY_NAME;
  if (!accountId || !gateway) return null;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}`;
}

/**
 * OpenAI 向けエンドポイント。
 * `path` は公式 API の `/v1/` 以降の部分（例: `audio/transcriptions`・`chat/completions`）。
 * AI Gateway 経由時は `{base}/openai/{path}` を返す。
 */
export function openaiEndpoint(path: string): string {
  const base = getGatewayBase();
  const trimmed = path.replace(/^\/+/, "");
  if (!base) return `https://api.openai.com/v1/${trimmed}`;
  return `${base}/openai/${trimmed}`;
}

/**
 * Anthropic 向けエンドポイント。
 * `path` は公式 API の `/v1/` 以降の部分（例: `messages`）。
 * AI Gateway の Anthropic パスは `/anthropic/v1/{path}` と `v1` を明示する必要があるので注意。
 */
export function anthropicEndpoint(path: string): string {
  const base = getGatewayBase();
  const trimmed = path.replace(/^\/+/, "");
  if (!base) return `https://api.anthropic.com/v1/${trimmed}`;
  return `${base}/anthropic/v1/${trimmed}`;
}

/** 現在 AI Gateway 経由で叩く設定になっているか（ログ出力やメトリクス判定用） */
export function isGatewayEnabled(): boolean {
  return getGatewayBase() !== null;
}

/**
 * AI Gateway の Authenticated Gateway モードで必要となる認証ヘッダを返す。
 *
 * Cloudflare Dashboard の AI Gateway 設定で「Authenticated Gateway」を ON にしている場合、
 * 全リクエストに `cf-aig-authorization: Bearer {CF_AI_GATEWAY_TOKEN}` が必須になる。
 * Gateway 自体が未設定（`isGatewayEnabled()` が false）の場合は返す意味がないので空オブジェクトを返す
 * （直接 api.openai.com / api.anthropic.com を叩くフォールバック経路では不要なヘッダ）。
 * Gateway は設定されているがトークンが未設定の場合も空オブジェクトを返し、
 * Authentication OFF モードの gateway でそのまま通るようにする（段階移行を壊さない）。
 */
export function gatewayAuthHeaders(): Record<string, string> {
  if (!isGatewayEnabled()) return {};
  const token = process.env.CF_AI_GATEWAY_TOKEN;
  if (!token) return {};
  return { "cf-aig-authorization": `Bearer ${token}` };
}
