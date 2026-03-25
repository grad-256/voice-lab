# VoiceLab — CLAUDE.md

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
ELEVENLABS_VOICE_ID=...        # 省略時は Bella（EXAVITQu4vr4xnSDxMaL）
```

---

## アーキテクチャ上の重要な決定

### API Routes はすべて Edge Runtime
```ts
export const runtime = "edge"; // 全 route.ts に必須
```
Cloudflare Pages（Workers）との互換性のため。

### ブラウザ音声フォーマットの自動選択
Chrome → `audio/webm;codecs=opus` / Safari → `audio/mp4` / Firefox → `audio/ogg`
`MediaRecorder.isTypeSupported()` で自動判定（`page.tsx` 参照）。

### stale closure 対策
`processAudio` は `messages` に依存するため、`processAudioRef` で最新版を保持。
`startRecording` 内の `recorder.onstop` は `processAudioRef.current?.()` 経由で呼ぶ。

### 最小録音時間
`MIN_RECORDING_MS = 1500`（1.5秒）。Whisper に渡す音声が短すぎると "you" などの hallucination が発生するため。

---

## フェーズロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| **Phase 0** | 最小 AI 音声アプリ（Whisper → Claude → ElevenLabs） | ✅ **完了** |
| Phase 1 | 語学学習者向け製品完成（認証・キャラ設定・UI仕上げ） | 待機中 |
| Phase 2 | AWS インフラ学習（Hono / Docker / Terraform / CI/CD）+ MCP Client | 待機中 |
| Phase 3 | MCP サーバー作成・公開 | 待機中 |
| Phase 4 | 収益化（Freemium・決済・MCP B2B 展開） | 待機中 |

---

## コーディング規約

- **TypeScript strict モード**：`any` は使わない
- **Biome** でフォーマット統一（`npm run check` で一括整形）
- **コメント**：日本語で書く（個人開発・学習目的のため）
- **エラーハンドリング**：API エラーはユーザーに日本語で表示
- **Edge Runtime 制約**：`fs`、`path` などの Node.js モジュールは使えない
- **環境変数**：`process.env.XXX ?? ""` でフォールバックを明示する

---

## よくある作業パターン

### API Route を追加するとき
1. `app/api/<name>/route.ts` を作成
2. 先頭に `export const runtime = "edge";` を追加
3. `process.env` でキーを参照
4. エラー時は `Response.json({ error: "..." }, { status: 500 })` で返す

### システムプロンプトを変更するとき
`app/api/chat/route.ts` の `SYSTEM_PROMPT` 定数を編集する。
（Phase 1 で UI から設定可能にする予定）

### ElevenLabs のボイスを変えるとき
`app/api/speak/route.ts` の `VOICE_ID` または `.env.local` の `ELEVENLABS_VOICE_ID` を変更する。
