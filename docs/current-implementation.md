# MyVoiceLab 現状実装の棚卸し

**対象フェーズ**：Phase 1 完了 / Phase 1.5 進行中
**作成日**：2026-04-14
**目的**：Cloudflare Workers（Hono）移行・DB 再選定・MVP 再設計に着手するための現状把握

---

## 1. プロジェクト全体像

ビジュアルを起点に、**声と性格を持つ"対話キャラクター"と英語で会話できる Web サービス**。
現在は単一 Next.js（App Router）アプリに **FE と API Routes（Edge Runtime）が同居**する構成。

### 想定する会話フロー（現状）
```
録音（MediaRecorder）
   ↓
/api/transcribe  → OpenAI Whisper（音声 → テキスト）
   ↓
/api/chat        → Claude Haiku（テキスト → 返答＋翻訳）
   ↓
/api/speak       → ElevenLabs（テキスト → 音声）
   ↓
再生（HTMLAudioElement）
```

---

## 2. 技術スタック（package.json 実測）

| 役割 | 実装 | 備考 |
|------|------|------|
| FE | Next.js 15.1.0（App Router, React 19） | `"use client"` 主体 |
| 言語 | TypeScript 5.8 strict | `any` 禁止 |
| スタイル | Tailwind CSS v3.4 | PostCSS・autoprefixer |
| Lint/Format | Biome 1.9.4 | `pnpm check` で一括 |
| 認証 | `@supabase/ssr` 0.9 / `@supabase/supabase-js` 2.100 | Cookie ベース SSR 対応 |
| 解析 | posthog-js 1.364 | `NEXT_PUBLIC_POSTHOG_*` |
| テスト | Vitest 4.1 | `test:unit` / `test:integration` 分離 |
| ビルド | `@cloudflare/next-on-pages` 1.13 | `pages:build` / `pages:deploy` |
| ランタイム | Cloudflare Pages（Edge）前提 | `wrangler.toml` で `nodejs_compat` 有効 |
| パッケージマネージャ | pnpm 9.15 | |

### 外部 API
- **OpenAI Whisper**（`whisper-1`）：音声認識
- **Anthropic Claude Haiku**（`claude-haiku-4-5-20251001`）：対話
- **ElevenLabs**（`eleven_turbo_v2_5`）：音声合成（デフォルト Voice ID: `hmVgSRXAUU4D4E9yl5iw`、`VOICE_OPTIONS` から他の声も選択可）

---

## 3. ファイル構成

```
voice-lab/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # LP（トップ）
│   ├── layout.tsx
│   ├── globals.css
│   ├── app/page.tsx                  # メイン対話UI（録音・チャット・再生）※753行の中核
│   ├── login/page.tsx                # 認証UI
│   ├── personas/                     # キャラ管理
│   │   ├── page.tsx
│   │   └── new/page.tsx
│   ├── settings/page.tsx
│   ├── privacy/                      # 静的規約ページ
│   ├── terms/
│   ├── reset-password/
│   ├── demo-screenshot/              # （用途要確認）
│   ├── components/
│   │   ├── PostHogProvider.tsx
│   │   └── lp/                       # LP背景・装飾（Aurora/Grid/Hero/Orbs/Pulse/ScrollReveal/ChatDemo）
│   └── api/                          # Edge Runtime API
│       ├── transcribe/route.ts       # Whisper
│       ├── chat/route.ts             # Claude Haiku（JSON返答・翻訳同梱）
│       ├── speak/route.ts            # ElevenLabs
│       ├── feedback/route.ts         # メッセージへの👍👎
│       └── account/delete/route.ts   # アカウント削除（cascade）
├── lib/
│   ├── chat.ts / chat.test.ts         # システムプロンプト生成・Claude 返答パース
│   ├── transcribe.ts / .test.ts      # MIME → 拡張子変換
│   ├── guestUsage.ts / .test.ts      # localStorage ベースのゲスト回数管理
│   ├── personas.ts                   # personas CRUD（Supabase Client）
│   ├── conversations.ts              # conversations / messages / feedback の CRUD
│   └── supabase/
│       ├── client.ts                 # ブラウザ用
│       └── server.ts                 # サーバー用（API Route / Server Component）
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260325_..._create_personas_conversations_messages.sql
│       └── 20260403_..._create_message_feedback.sql
├── middleware.ts                     # Supabase セッション維持＋認証リダイレクト
├── next.config.ts                    # ほぼ空（Cloudflare 前提）
├── wrangler.toml                     # Pages 出力 `.vercel/output/static`
├── biome.json
├── vitest.config.ts / vitest.setup.ts
└── CLAUDE.md
```

---

## 4. API Routes（すべて Edge Runtime）

### 4.1 `/api/transcribe`（POST）
- `multipart/form-data` で audio Blob を受け取り OpenAI Whisper `/v1/audio/transcriptions` に転送
- MIME から拡張子を決定（`lib/transcribe.ts` の `getMimeExtension`）：mp4 / ogg / webm
- 認証**なし**（ゲストでも叩ける）
- 429 は `SERVICE_QUOTA_EXCEEDED` として返す

### 4.2 `/api/chat`（POST）
- Body：`{ message, history, systemPrompt?, level? }`
- `lib/chat.ts` の `buildSystemPrompt` でレベル別指示＋JSON出力指示をシステムプロンプトに注入
  - level は `beginner` / `intermediate` / `advanced`
- `parseClaudeResponse` で Claude 返答（コードフェンス混在の可能性あり）を `{ reply, translation }` にパース
- 認証**なし**
- 429 / 529 は `SERVICE_QUOTA_EXCEEDED`

### 4.3 `/api/speak`（POST）
- Body：`{ text, voiceId? }`
- ElevenLabs `/v1/text-to-speech/:voiceId`、`eleven_turbo_v2_5`、speed 0.75（語学学習向け）
- 音声バイナリ（audio/mpeg）を `Cache-Control: no-store` で返却
- 認証**なし**

### 4.4 `/api/feedback`（POST）
- ログイン必須
- `message_feedback` に `upsert`（`message_id + user_id` で一意）
- `rating`：`positive` / `negative`

### 4.5 `/api/account/delete`（DELETE）
- ログイン必須
- 順序：`messages` → `conversations` → `personas` → Supabase Auth Admin で user 削除
- `SUPABASE_SERVICE_ROLE_KEY` を fetch で直叩き（Supabase Admin REST）

---

## 5. 認証・ミドルウェア

### `middleware.ts`
- すべてのページリクエストで `supabase.auth.getUser()` を呼んでセッション検証
- 公開パス：`/`, `/app`, `/login`, `/privacy`, `/terms`, `/reset-password`
- 未ログイン＋非公開パス → `/login` リダイレクト
- ログイン済み＋`/login` → `/app` リダイレクト
- `api/` は matcher から除外（API は独自認証ロジック）

### Supabase クライアント
- `lib/supabase/server.ts`：API Route / Server Component 用。`cookies()` ベース
- `lib/supabase/client.ts`：ブラウザ用
- env 未設定時は `placeholder-*` でフォールバック（ビルド時エラー回避）

---

## 6. DB スキーマ（Supabase / Postgres）

### テーブル（すべて RLS 有効）
| テーブル | 主なカラム | ポリシー |
|---------|----------|---------|
| `personas` | id / user_id / name / style_prompt / voice_id / created_at | `auth.uid() = user_id` |
| `conversations` | id / user_id / persona_id / created_at | `auth.uid() = user_id` |
| `messages` | id / conversation_id / role('user'\|'assistant') / content / translation / created_at | 親 conversation の user_id と一致 |
| `message_feedback` | id / message_id / user_id / rating('positive'\|'negative') / created_at | `auth.uid() = user_id`、`(message_id, user_id)` unique |

### カスケード
- `conversations` 削除 → `messages` も削除（`on delete cascade`）
- `messages` 削除 → `message_feedback` も削除

**観察**：音声ファイルの保存テーブルは存在しない。会話履歴は「テキスト＋翻訳のみ」保持されている。

---

## 7. ゲストモード（Phase 1.5）

### 実装
- `lib/guestUsage.ts`：**localStorage** の `vl_guest_count` キーで管理
- `GUEST_LIMIT = 5`
- ゲスト用のデフォルトペルソナ `GUEST_PERSONA`（id: `"guest"`、名前 Yuki）が `app/app/page.tsx` にハードコード
- `/app` は公開パス。未ログインでもアクセス可

### 課題（Notion で指摘済み）
- localStorage は **ブラウザ開発者ツール・シークレットモード・clear で簡単に回避可能**
- → D-1（サーバーサイド使用回数管理への移行）で解消予定

---

## 8. クライアント側の対話UI（`app/app/page.tsx`、753 行）

### 主要ロジック
- MediaRecorder で録音 → Blob 生成 → `/api/transcribe` に POST
- `processAudio` は `messages` state に依存するため、**`processAudioRef` で最新版を保持**（stale closure 対策、CLAUDE.md に明記）
- `recorder.onstop` は `processAudioRef.current?.()` 経由で呼ぶ
- `MIN_RECORDING_MS = 1500`（Whisper のハルシネーション回避）
- ブラウザ別 MIME 自動選択（`MediaRecorder.isTypeSupported()`）：
  - Chrome：`audio/webm;codecs=opus`
  - Safari：`audio/mp4`
  - Firefox：`audio/ogg`
- posthog.js でイベントトラッキング
- Status は `idle / recording / processing / speaking` の4値

---

## 9. 環境変数

### 必須（`.env.local.example` より）
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY            # アカウント削除 API 用
OPENAI_API_KEY                       # Whisper
ANTHROPIC_API_KEY                    # Claude Haiku
ELEVENLABS_API_KEY                   # TTS
ELEVENLABS_VOICE_ID                  # 省略時 hmVgSRXAUU4D4E9yl5iw
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
```

---

## 10. テスト構成

### Vitest
- `pnpm test:unit`：`lib/` 配下のユニットテスト
  - `lib/chat.test.ts`（システムプロンプト生成・JSONパース）
  - `lib/transcribe.test.ts`（MIME判定）
  - `lib/guestUsage.test.ts`（カウント増減）
- `pnpm test:integration`：`app/api/` 配下の統合テスト
  - `transcribe / chat / speak` の `route.integration.test.ts`

---

## 11. デプロイ

- **コマンド**：`pnpm pages:build` → `pnpm pages:deploy`
- **ビルド出力**：`.vercel/output/static`（`@cloudflare/next-on-pages` の仕様）
- **動的ページ要件**：Server Component でも `export const runtime = "edge"` を付けないと Cloudflare Pages でビルド失敗
- **コミットメッセージ制約**：マルチバイト文字はデプロイ時 `code: 8000111` で拒否される → **commit は英語のみ**（CLAUDE.md に明記）

---

## 12. 既知の制約・構造的課題

| # | 課題 | 影響 | 対応予定タスク |
|---|------|------|----------------|
| 1 | localStorage ベースのゲスト回数管理が回避可能 | 収益化前に必須で解消 | D-1 |
| 2 | 音声ファイルを保存していない（履歴はテキストのみ） | 「自分の声で振り返り」機能の前提が未整備 | B-5, A-5 |
| 3 | API Routes は Next.js に同居 → BE の独立性がない | Hono への移行余地 | C-1, C-2 |
| 4 | `app/app/page.tsx` が 753 行の巨大コンポーネント | 機能追加時の保守性 | C-3（shadcn/ui 導入時にリファクタ） |
| 5 | AI サービス API Key が FE と同じ Next.js 環境変数 | Workers 環境に移行時に再設計要 | C-4 |
| 6 | `/api/transcribe` `/api/chat` `/api/speak` は無認証 | レート制限・不正利用対策なし | D-1, D-2 で設計見直し |
| 7 | プロダクト方向性（とっさの英語・Step 0）が未反映 | LP / UI が旧コンセプトのまま | B-3, B-7 |
| 8 | ボイスクローン機能は未実装 | 差別化の核が手付かず | G-2 |

---

## 13. 次のステップ（本ドキュメントの使い方）

1. **A-2（FE/BE 境界のざっくり定義）**：本ドキュメントを元に「Hono 移行で何が FE に残り何が BE に出ていくか」を定義
2. **A-4（DB 選定）**：現在の Supabase から移行するか維持するかを、本ドキュメント Section 6 のスキーマと RLS 要件を前提に判断
3. **A-5（音声ストレージの扱い）**：Section 6 で指摘した「音声ファイル未保存」を解消する設計を決める
4. **B-3（Step 0 体験設計）**：Section 4.3 の ElevenLabs 呼び出しパスを拡張して Voice Cloning を差し込むポイントを見極める
