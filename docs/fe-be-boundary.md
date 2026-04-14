# FE / BE 境界のざっくり定義（浅く速く）

**対象**：Phase 2 に向けた Cloudflare 分離構成
**作成日**：2026-04-14
**ステータス**：草案（詳細設計は C-1 で深掘りする）

> 本ドキュメントは「**何を FE に残し、何を BE に出すか**」の**大枠の合意**を取るためのもの。
> プロトコル詳細・認証方式の実装・エラー仕様などは `C-1: Hono + Cloudflare Workers 移行設計` で詰める。

---

## 1. 現状と目的

現状は **Next.js（App Router）が FE と API Routes を兼務**している（`docs/current-implementation.md` 参照）。
Phase 2 で **FE：Cloudflare Pages（Next.js）／ BE：Cloudflare Workers（Hono）** に分離する。

### 分離の目的
- **責務の明確化**：FE は描画・体験・認証 UI、BE はデータ・外部 API・業務ロジック
- **セキュリティ境界**：AI API Key（OpenAI / Anthropic / ElevenLabs）を FE バンドルから完全に隔離
- **スケール独立性**：BE だけ独立してデプロイ・モニタ・レート制御できる
- **将来の拡張**：MCP Server 化、外部クライアント（モバイル等）からの利用を視野

---

## 2. 責務の分担（ざっくり）

### 🟦 FE（Cloudflare Pages / Next.js 15 App Router）に残すもの

| 項目 | 理由 |
|------|------|
| すべての UI ページ（`app/**/page.tsx`） | 描画と体験は FE に集約 |
| LP・ランディング装飾（`app/components/lp/*`） | SSG / Edge SSR が適切 |
| shadcn/ui ベースの UI コンポーネント | 表示責務 |
| 録音・音声再生（MediaRecorder / HTMLAudioElement） | ブラウザ API の制約 |
| Supabase Auth の UI フロー（ログイン・登録・リセット） | Cookie/セッション操作が FE 側で必要 |
| posthog-js のイベント発火 | クライアント計測 |
| ゲスト体験の入口 UI（Step 0 含む） | 体験設計は FE の領域 |
| 画面遷移・ルーティング（middleware.ts の認証ガード） | App Router の機能 |

### 🟥 BE（Cloudflare Workers / Hono）に出すもの

| 項目 | 理由 |
|------|------|
| `/api/transcribe`（Whisper 呼び出し） | OpenAI API Key を FE に持たせない |
| `/api/chat`（Claude Haiku 呼び出し） | Anthropic API Key を FE に持たせない |
| `/api/speak`（ElevenLabs 呼び出し） | ElevenLabs API Key を FE に持たせない |
| `/api/feedback`（message_feedback 書き込み） | DB 書き込みは BE に集約 |
| `/api/account/delete`（ユーザー削除 + cascade） | Service Role Key を BE に隔離 |
| **新規** 使用回数管理（D-1 で設計） | サーバーサイドでのみ安全に管理可能 |
| **新規** 決済系（D-4 Stripe Webhook 等） | Webhook 検証を BE でやる |
| **新規** ボイスクローン関連 API（G-2） | ElevenLabs Voice Cloning Key と音声管理 |
| **新規** 会話履歴の取得・音声ストレージ署名付き URL 発行（B-5, A-5） | 権限制御と認証が必須 |

### 🟨 どちら寄りか論点があるもの（後で決める）

| 項目 | FE 案 | BE 案 | 初期方針 |
|------|------|------|---------|
| Supabase クライアントの読み取りクエリ（`personas` 一覧など） | ブラウザから直接 Supabase（RLS 依存） | BE 経由で取得 | **当面 FE 直叩き維持**（RLS で守られている）。BE 移行時に見直し |
| Supabase Auth のサーバー側検証 | middleware.ts で継続 | BE の各エンドポイントで Bearer 検証 | **両方**：FE の middleware はページガード、BE は API ガード |
| PostHog のサーバーサイド送信 | 不要 | 集計・加工のため導入可 | **FE のみで開始**。必要に応じて後追い |
| システムプロンプト（`SYSTEM_PROMPT`） | FE で UI 入力 → BE に送る | BE 内で完全管理 | **BE 管理**を原則。ユーザー編集分は body で受ける |
| レベル制御（`beginner/intermediate/advanced`） | 既に body 送信 | そのまま | 現状維持 |

---

## 3. API 境界（最小スケッチ）

BE は **`https://api.myvoicelab.com`（仮）** をエンドポイントにする前提。
FE は **`https://myvoicelab.com`**。**異なるサブドメイン**で運用。

### 認証方針（浅く速く）
- FE は Supabase Auth の **セッション Cookie** でログイン状態を保持
- BE への認証付きリクエストは **Supabase access_token を `Authorization: Bearer` で渡す**
- BE は `SUPABASE_JWT_SECRET` で検証、または `@supabase/supabase-js` の `getUser()` 相当を呼ぶ
- 無認証で許容する API（ゲスト用）：`/transcribe` `/chat` `/speak`
  - ただし **レート制限・使用回数ガードは必須**（D-1 で導入）

### エンドポイント（現状踏襲＋新規）
| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| POST | `/transcribe` | なし（＋レート制限） | 音声 → テキスト |
| POST | `/chat` | なし（＋レート制限） | テキスト → 返答＋翻訳 |
| POST | `/speak` | なし（＋レート制限） | テキスト → 音声 |
| POST | `/feedback` | 必須 | メッセージへの 👍👎 |
| DELETE | `/account` | 必須 | アカウント削除 |
| GET | `/conversations/:id` | 必須 | 会話履歴取得（B-5） |
| POST | `/voice-clone` | 必須（＋プラン制限） | ボイスクローン作成（G-2） |
| POST | `/stripe/webhook` | 署名検証 | Stripe Webhook（D-4） |
| GET | `/usage` | 必須 or ゲストID | 使用回数確認（D-1） |

### CORS
- FE オリジン（`https://myvoicelab.com`）からのみ許可
- `credentials: "include"` で Cookie / Authorization を送る

---

## 4. 環境変数の分離

### FE（Cloudflare Pages）
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_API_BASE_URL          # BE のエンドポイント（新規）
```

### BE（Cloudflare Workers）
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # account delete / admin 操作
SUPABASE_JWT_SECRET                # Bearer 検証用（導入する場合）
OPENAI_API_KEY
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
STRIPE_SECRET_KEY                  # D-4 以降
STRIPE_WEBHOOK_SECRET              # D-4 以降
```

**原則**：AI ツール・Service Role・Stripe Secret は **BE のみ**。FE からは絶対に見えない。

---

## 5. データの所有

| データ | 所有 | 書き込み可能な側 |
|-------|------|-----------------|
| `personas` | DB | BE 経由が原則（当面 FE 直叩きも許容） |
| `conversations` / `messages` | DB | BE 経由が原則 |
| `message_feedback` | DB | BE のみ |
| 音声ファイル（将来） | R2 or Supabase Storage | BE のみ（署名付き URL を FE に渡す） |
| ゲスト使用回数 | 現：localStorage / 将来：DB+ID | 将来は BE のみ（D-1） |

---

## 6. 段階的移行ステップ（C-1 で詳細化）

1. **Step A**：Hono プロジェクトを `apps/api`（モノレポ）または別リポに用意して「空の Workers」をデプロイ
2. **Step B**：`/transcribe` だけを Hono に移して FE から叩き先を切り替え、正常動作を確認
3. **Step C**：`/chat` `/speak` を順次移す
4. **Step D**：`/feedback` `/account/delete` を移す（認証付き API のパターン確立）
5. **Step E**：Next.js 側の `app/api/**` を完全撤去
6. **Step F**：新規 API（`/conversations`, `/usage`, `/voice-clone`, `/stripe/webhook`）を BE にのみ追加

---

## 7. 今回は踏み込まない事項（後続タスクに委ねる）

| 事項 | 委ねる先 |
|------|---------|
| Hono のディレクトリ構成・ミドルウェア・ルーティング詳細 | C-1 |
| Hono 実装への具体的コード移植 | C-2 |
| DB 選定（Supabase 継続か D1 / Turso / Neon か） | A-4 |
| 音声ストレージ（R2 / Supabase Storage） | A-5 |
| Terraform で管理するインフラ要素 | A-6 |
| CI/CD のテスト分割・デプロイ戦略 | A-7 |
| 使用回数管理のスキーマ | D-1 |

---

## 8. 合意事項（この段階での結論）

- **FE は UI と認証 UI・ブラウザ API に集中する**
- **BE は外部 API Key・Service Role Key・DB 書き込み・決済を所有する**
- **API は別ドメイン運用、CORS + Bearer トークンで疎結合にする**
- **Supabase 直叩きの読み取りは当面維持**、将来 BE 経由に統一の方向
- **移行は `/transcribe` から一本ずつ** 着実に進める
