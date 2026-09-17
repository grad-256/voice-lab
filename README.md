# MyVoiceLab

**話すだけで、日記になる。AI と声で話して、残す音声日記サービス。**

マイクを押してその日のことを話すと、AI が音声で受け止めて相槌を返し、
会話の内容を日記の形に整えて保存します。あとから読み返したり、週次リキャップ（直近の日記の要約）を音声で聞き返せます。

当初は「声と性格を持つ AI キャラクターと英語で話す練習相手」として開発を始め、
MVP 検討の過程で「声で残す日記」へ軸足を移しました（経緯は `docs/mvp-scope.md`）。

- 本番: https://myvoicelab.app
- 個人開発（設計・実装・インフラ・法務文書まで一人で担当）

---

## 何ができるか

| 機能 | 概要 |
|---|---|
| 音声日記 | 録音 → 文字起こし → AI 応答 → 音声合成 を 1 ターンで往復。AI は直近の日記の要約を踏まえて返す |
| 日記の保存・履歴 | 会話を要約して日記として保存。一覧・詳細から読み返せる |
| 週次リキャップ | 直近 5 件の日記を AI が週ごとに要約し、音声で聞き返せる（無料プランの件数上限） |
| 声の選択 | ElevenLabs のプリセット音声から、話し相手の声を選べる |
| ゲストモード | ログイン不要で体験開始。無料ターン上限を超えたら会員登録を案内（有料プランは準備中） |
| 多言語 UI | 日本語 / 英語（next-intl） |
| PWA | ホーム画面追加・Service Worker 対応 |

---

## アーキテクチャ

```
ブラウザ（MediaRecorder）
   │  audio/webm | audio/mp4 | audio/ogg（ブラウザごとに自動判定）
   ▼
Next.js API Routes（Edge Runtime, Cloudflare Pages）
   │
   ├─ /api/transcribe ── OpenAI Whisper ─────┐ Cloudflare AI Gateway 経由
   ├─ /api/chat ──────── Claude Haiku ───────┘
   ├─ /api/speak ─────── ElevenLabs TTS（直接呼び出し）
   ├─ /api/diary, /api/summarize, /api/weekly-recap
   └─ Supabase（Auth / Postgres / RLS）
```

### 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド / API | Next.js 15（App Router）, React 19, TypeScript strict |
| スタイル | Tailwind CSS v3 |
| 認証 / DB | Supabase Auth, Postgres（マイグレーションは `supabase/migrations/`） |
| STT | OpenAI Whisper |
| 対話 AI | Claude Haiku（週次要約のみ Claude Sonnet） |
| TTS | ElevenLabs（会話は `eleven_multilingual_v2`、週次要約は `eleven_v3`） |
| ホスティング | Cloudflare Pages（Edge Runtime） |
| LLM ゲートウェイ | Cloudflare AI Gateway |
| i18n | next-intl |
| テスト | Vitest（ユニット + API 統合テスト） |
| Lint / Format | Biome |
| 分析 | PostHog |

---

## 設計判断の記録

「なぜそう作ったか」は `docs/` に残しています。主なもの：

| ドキュメント | 内容 |
|---|---|
| [current-implementation.md](docs/current-implementation.md) | 現状実装の棚卸し。移行・再設計の出発点 |
| [db-selection.md](docs/db-selection.md) | D1 / Turso / Neon / Supabase を要件で比較し Supabase 継続を決定 |
| [fe-be-boundary.md](docs/fe-be-boundary.md) | 何をフロントに残し、何をバックエンドに出すかの境界定義 |
| [monorepo-structure.md](docs/monorepo-structure.md) | `apps/web` / `apps/api` / `packages/shared` のモノレポ構成決定 |
| [audio-storage.md](docs/audio-storage.md) | 音声データの保存対象・保持期間・ストレージ選定 |
| [ci-cd-design.md](docs/ci-cd-design.md) | 生成と評価を分離するハーネス思想を取り入れた CI/CD 設計 |
| [terraform-cloudflare.md](docs/terraform-cloudflare.md) | Cloudflare リソースの IaC 化検証。採用するが導入時期は Phase 2 と判断 |
| [mvp-scope.md](docs/mvp-scope.md) | MVP スコープ定義。外部 API の制約を受けたピボットの経緯を含む |
| [competitor-research.md](docs/competitor-research.md) | 競合サービスの UX リサーチとポジショニング |
| [voice-library-selection.md](docs/voice-library-selection.md) | プリセット音声 8 枠の選定基準と記録 |

### 実装上の主な判断

- **API Routes はすべて Edge Runtime**。Cloudflare Pages（Workers）で動かすため、Node.js 専用モジュールは使わない
- **LLM 呼び出しは Cloudflare AI Gateway を経由**。Pages Functions が海外 DC で処理された場合の地域ブロックを回避しつつ、環境変数未設定時は直接 API へフォールバック
- **録音の最小時間を 1.5 秒に制限**。短すぎる音声を Whisper に渡すと幻覚出力が発生するため
- **ブラウザごとの録音フォーマットを自動判定**。Chrome / Safari / Firefox で `MediaRecorder` の対応形式が異なる
- **無料プランの利用制限ロジックを純粋関数として分離**。DB 操作を含めないことでユニットテストを容易にした（`lib/freePlanUsage.ts`）
- **法務文書（利用規約・プライバシーポリシー）は Notion 公開ページで運用**。改訂頻度が高い文書をデプロイから切り離した

---

## AI エージェントを使った開発プロセス

Claude Code のエージェント機能を使い、役割ごとに分けたエージェント（planner / frontend / backend / infrastructure / evaluator / pdm / marketer / legal-checker など）で開発を進めています。
生成と評価を別のエージェントに分離し、evaluator が不合格を出したら修正に戻す運用です。
定義は `.claude/agents/`、共通コンテキストは `CLAUDE.md` を参照してください。

---

## ローカルで動かす

```bash
pnpm install
cp .env.local.example .env.local   # 各 API キーを設定
pnpm dev                            # http://localhost:3000
```

必要な環境変数は `.env.local.example` を参照してください（OpenAI / Anthropic / ElevenLabs / Supabase / Cloudflare AI Gateway）。

### コマンド

```bash
pnpm dev               # 開発サーバー
pnpm build             # プロダクションビルド
pnpm check             # Biome lint + format
pnpm test              # 全テスト
pnpm test:unit         # lib/ のユニットテスト
pnpm test:integration  # app/api/ の統合テスト
pnpm pages:build       # Cloudflare Pages 用ビルド
pnpm pages:deploy      # Cloudflare Pages へデプロイ
```

---

## ディレクトリ構成

```
voice-lab/
├── app/
│   ├── [locale]/        # 画面（LP / 日記 / 履歴 / リキャップ / 設定 / 料金 など）
│   └── api/             # Edge Runtime の API Routes
├── lib/                 # 純粋ロジック・API クライアント（テスト対象）
├── docs/                # 設計判断の記録
├── supabase/migrations/ # DB スキーマ
├── messages/            # i18n 辞書（ja / en）
├── .claude/             # エージェント定義・フック・スキル
└── CLAUDE.md            # 開発時の共通コンテキスト
```

---

## ロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 最小音声パイプライン（Whisper → Claude → ElevenLabs） | 完了 |
| 1 | 認証・声の設定・UI 仕上げ | 完了 |
| 1.5 | ゲストモード + フリーミアム導線（決済連携は未着手） | 進行中 |
| 2 | Hono + Cloudflare Workers への API 分離、Terraform、CI/CD、MCP Client | 待機中 |
| 3 | MCP サーバー公開 | 待機中 |
| 4 | 収益化（決済・B2B 展開） | 待機中 |
