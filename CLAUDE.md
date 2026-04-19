# MyVoiceLab — CLAUDE.md

このファイルは Claude がこのプロジェクトで作業するときの共通コンテキストです。
必ずこのファイルを最初に読み、内容を踏まえて作業してください。

---

## プロジェクト概要

**ビジュアルを起点に、声と性格を持つ"対話キャラクター"を生成し、テキスト・音声でコミュニケーションできる AI サービス**

現在のターゲット：**語学学習者**（話す練習相手がいない・人間相手だと緊張する）

ChatGPT との差別化：「AI と話す」ではなく「AI で作った"他者"と話す」。対話相手を生成・管理・切り替えられる点がコアバリュー。

---

## 技術スタック

| 役割 | 技術 | 備考 |
|---|---|---|
| フロントエンド | Next.js 15（App Router） | UI + API Routes を兼ねる |
| 言語 | TypeScript（strict） | |
| スタイル | Tailwind CSS v3 | |
| Linter/Formatter | Biome | `biome.json` 参照 |
| 認証 | Supabase Auth | メール/パスワード認証 |
| STT | OpenAI Whisper（`whisper-1`） | 音声 → テキスト |
| 対話AI | Claude Haiku（`claude-haiku-4-5-20251001`） | テキスト → 返答 |
| TTS | ElevenLabs（`eleven_turbo_v2_5`） | テキスト → 音声 |
| ホスティング | Cloudflare Pages（予定） | `@cloudflare/next-on-pages` |
| リポジトリ構成 | **pnpm workspaces モノレポ** | `apps/web` / `apps/api` / `packages/shared`（Phase 2 で再編）。詳細は `docs/monorepo-structure.md` |
| DB | なし（Phase 1 途中） | 会話履歴は React state のみ |

---

## ファイル構成

```
voice-lab/
├── app/
│   ├── api/
│   │   ├── transcribe/route.ts   # Whisper：音声 → テキスト
│   │   ├── chat/route.ts         # Claude Haiku：テキスト → 返答
│   │   └── speak/route.ts        # ElevenLabs：テキスト → 音声
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # メイン UI（録音・チャット・音声再生）
├── biome.json                    # Linter/Formatter 設定
├── wrangler.toml                 # Cloudflare Pages 設定
├── .env.local                    # APIキー（git 管理外）
├── .env.local.example            # APIキーテンプレート
└── CLAUDE.md                     # このファイル
```

---

## 開発コマンド

```bash
pnpm dev           # ローカル開発サーバー起動（http://localhost:3000）
pnpm build         # プロダクションビルド
pnpm check         # Biome lint + format（推奨）
pnpm lint          # Biome lint のみ
pnpm format        # Biome format のみ
pnpm pages:build   # Cloudflare Pages 用ビルド
pnpm pages:deploy  # Cloudflare Pages にデプロイ
```

---

## 環境変数（.env.local）

```env
OPENAI_API_KEY=sk-...          # Whisper 音声認識
ANTHROPIC_API_KEY=sk-ant-...   # Claude Haiku 対話AI
ELEVENLABS_API_KEY=...         # ElevenLabs 音声生成
ELEVENLABS_VOICE_ID=...        # 省略時は hmVgSRXAUU4D4E9yl5iw

# Cloudflare AI Gateway（香港ルーティング対策。両方セット時のみ有効）
CF_ACCOUNT_ID=...              # Cloudflare Account ID
CF_AI_GATEWAY_NAME=...         # Gateway slug（例：my-voice-lab）
CF_AI_GATEWAY_TOKEN=cfut_...   # Authenticated Gateway モード時のトークン（任意）
```

---

## アーキテクチャ上の重要な決定

### API Routes はすべて Edge Runtime
```ts
export const runtime = "edge"; // 全 route.ts に必須
```
Cloudflare Pages（Workers）との互換性のため。

### AI Gateway 経由で LLM を叩く
OpenAI / Anthropic 呼び出しは `lib/aiGateway.ts` の `openaiEndpoint()` / `anthropicEndpoint()` ヘルパーを
通す。`CF_ACCOUNT_ID` と `CF_AI_GATEWAY_NAME` が揃っていれば Cloudflare AI Gateway 経由（米国 IP）で
LLM に到達するため、Pages Functions が香港 DC で処理された場合でも OpenAI / Anthropic の地域ブロック
（`unsupported_country_region_territory` / `forbidden`）を回避できる。
環境変数が未設定なら直接 `api.openai.com` / `api.anthropic.com` を叩くフォールバックになる。

### Authenticated Gateway モード
Cloudflare Dashboard で「Authenticated Gateway」を ON にすると、全リクエストに
`cf-aig-authorization: Bearer {CF_AI_GATEWAY_TOKEN}` が必須になる。
`gatewayAuthHeaders()` ヘルパーが `CF_AI_GATEWAY_TOKEN` 環境変数を参照してヘッダを生成するので、
各 API route は `fetch` の `headers` に `...gatewayAuthHeaders()` をスプレッドで混ぜる。
トークン未設定なら空オブジェクトを返すため、Authentication OFF モードの gateway でもそのまま通る。

### ブラウザ音声フォーマットの自動選択
Chrome → `audio/webm;codecs=opus` / Safari → `audio/mp4` / Firefox → `audio/ogg`
`MediaRecorder.isTypeSupported()` で自動判定（`page.tsx` 参照）。

### stale closure 対策
`processAudio` は `messages` に依存するため、`processAudioRef` で最新版を保持。
`startRecording` 内の `recorder.onstop` は `processAudioRef.current?.()` 経由で呼ぶ。

### 最小録音時間
`MIN_RECORDING_MS = 1500`（1.5秒）。Whisper に渡す音声が短すぎると "you" などの hallucination が発生するため。

### コミットメッセージは英語（ASCII）のみ
Cloudflare Pages の API は日本語などのマルチバイト文字を含むコミットメッセージを拒否し、デプロイが失敗する。
`Invalid commit message, it must be a valid UTF-8 string. [code: 8000111]`
**git commit メッセージは必ず英語で書くこと。**

---

## フェーズロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| **Phase 0** | 最小 AI 音声アプリ（Whisper → Claude → ElevenLabs） | ✅ **完了** |
| **Phase 1** | 語学学習者向け製品完成（認証・キャラ設定・UI仕上げ） | ✅ **完了** |
| **Phase 1.5** | ゲストモード＋フリーミアム導線（ログイン不要で利用開始 → 制限 → 認証 → 有料版） | 🔄 **進行中** |
| Phase 2 | AWS インフラ学習（Hono / Docker / Terraform / CI/CD）+ MCP Client | 待機中 |
| Phase 3 | MCP サーバー作成・公開 | 待機中 |
| Phase 4 | 収益化（Freemium・決済・MCP B2B 展開） | 待機中 |P

---

## コーディング規約

- **TypeScript strict モード**：`any` は使わない
- **Biome** でフォーマット統一（`npm run check` で一括整形）
- **コメント**：日本語で書く（個人開発・学習目的のため）
- **エラーハンドリング**：API エラーはユーザーに日本語で表示
- **Edge Runtime 制約**：`fs`、`path` などの Node.js モジュールは使えない
- **環境変数**：`process.env.XXX ?? ""` でフォールバックを明示する

---

## 品質評価基準（ハーネスパターン）

Anthropic Labs の研究（[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)）をもとに定義。
実装完了時は必ず以下の基準でセルフチェックを行うこと。

### ハーネス構成（マルチエージェントフロー）

```
プロンプト1行
    ↓
[プランナー]  機能仕様・スプリント計画に展開
    ↓
[ジェネレーター]  コードを実装（スプリント単位）
    ↓
[エバリュエーター]  実際にアプリを操作してテスト
    ↓（不合格：具体的なバグ報告）
[ジェネレーター]  フィードバックをもとに修正
    ↓（合格まで繰り返す）
  完了
```

> **生成と評価を分離することが核心。** 作る側と評価する側が同じエージェントだと自己評価が甘くなる。
> Phase 2 以降で本格導入予定。Phase 1 では CLAUDE.md の基準によるセルフチェックで代替する。

### 機能品質
- 各機能はスタブ・モックでなく**実際に動作**しているか
- API エラー時にユーザーへ**日本語でフィードバック**しているか
- **Edge Runtime の制約**（`fs`、`path` 禁止）に違反していないか
- エッジケース（空入力・ネットワーク断・長時間無音）が処理されているか

### UI/UX 品質
- UI は**一貫した世界観**を持つか（色・タイポグラフィ・レイアウトの統一）
- テンプレート的な AI デザインを避けているか（白背景・紫グラデーション・量産カードは NG）
- ユーザーが迷わず操作できるか（録音→返答→再生のフローが直感的か）

### 音声フロー品質（MyVoiceLab 固有）
- Whisper → Claude Haiku → ElevenLabs のパイプラインが途切れなく繋がっているか
- 録音が `MIN_RECORDING_MS = 1500` 以上確保されているか
- ブラウザごとの音声フォーマット（Chrome/Safari/Firefox）が正しく切り替わるか

> **セルフレビューは甘くなりがち。** 少しでも怪しい点があれば「不合格」として修正すること。
> 「概ね良い」「小さな問題だから大丈夫」という判断は禁止。

---

## エージェントチーム構成

`.claude/agents/` に以下のエージェントが定義されている。

| エージェント | 役割 | 主な用途 |
|---|---|---|
| **planner** | 仕様書展開 | 1行プロンプト → スプリント計画 |
| **evaluator** | 品質レビュー | 実装完了後のテスト・合否判定 |
| **pdm** | プロダクト戦略 | 優先度・KPI・ユーザージャーニー分析 |
| **marketer** | 訴求設計 | コピー・プライシング・感情設計（とっさの英語ペルソナ） |
| **branding** | ブランド統一 | 世界観・トーン・ビジュアル一貫性の維持 |
| **legal-checker** | 法的チェック | 特商法・プラポリ・利用規約・AI規約整合性・ボイスクローン法務 |
| **frontend** | フロントエンド実装 | UI・ページ・クライアントロジック（Next.js / Tailwind） |
| **backend** | バックエンド実装 | API Routes・外部API統合・Supabase操作 |
| **infrastructure** | インフラ管理 | Cloudflare Pages・Supabase設定・デプロイ・CI/CD |

### チームの使い方
- **実装タスク**：`planner` → `frontend` / `backend` / `infrastructure` → `evaluator`
- **プロダクト判断**：`pdm` + `marketer` → `planner` で仕様統合
- **フルチーム**：`pdm` → `planner` → `frontend` + `backend` + `infrastructure`（並行） → `evaluator`
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`（`.claude/settings.json`）で有効化済み
- チーム起動は `/launch-team` スキルで自動化（`.claude/skills/launch-team/SKILL.md`）

---

## よくある作業パターン

### API Route を追加するとき
1. `app/api/<name>/route.ts` を作成
2. 先頭に `export const runtime = "edge";` を追加
3. `process.env` でキーを参照
4. エラー時は `Response.json({ error: "..." }, { status: 500 })` で返す

### ページ（Server Component）を追加するとき
- 動的なページには `export const runtime = "edge";` を先頭に追加する
- Cloudflare Pages は非静的ルートがすべて Edge Runtime である必要があるため
- 静的ページ（`○` 表示）は不要だが、`createClient` などを使う動的ページは必須

### ページレイアウトの規約（画面超過の再発防止）
`app/layout.tsx` の body は既に `min-h-screen flex flex-col` で 100vh を確保しており、
内部は `<div className="flex-1 flex flex-col">{children}</div>` + footer の構造になっている。

- **ページ側の `<main>` に `min-h-screen` を直接書かない**。body とダブルがけになり、
  `main = 100vh` + `footer = 自然高` で画面超過（`/echo` 事例）。代わりに `flex-1 w-full` を使う
- **footer を隠したい画面**（会話画面の `/app` など）だけ、明示的に `h-screen overflow-hidden` を書く
- 該当例：`/echo`・`/settings/voice`・`/privacy`・`/terms` は `flex-1 w-full`、`/app` のみ `h-screen overflow-hidden`

### システムプロンプトを変更するとき
`app/api/chat/route.ts` の `SYSTEM_PROMPT` 定数を編集する。
（Phase 1 で UI から設定可能にする予定）

### ElevenLabs のボイスを変えるとき
`app/api/speak/route.ts` の `VOICE_ID` または `.env.local` の `ELEVENLABS_VOICE_ID` を変更する。
