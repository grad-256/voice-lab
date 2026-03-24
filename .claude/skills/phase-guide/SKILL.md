# Phase Guide — VoiceLab 開発スキル

## コマンド

```
/phase-guide
```

このスキルは VoiceLab プロジェクトのフェーズ移行・機能追加・バグ修正を支援します。
新しいフェーズに入るとき・新機能を追加するとき・問題を解決するときに使用してください。

---

## このスキルが使われる場面

- 新しい API Route を追加したい
- フェーズを進めたい（Phase 0 → 1 など）
- バグを修正したい
- システムプロンプトを調整したい
- UI を改善したい

---

## ⚡ 起動時に必ず実行すること（必須）

このスキルが呼ばれたら、作業開始前に**必ず以下の順番で確認**してください。

### 1. Notion のロードマップを確認する

以下の URL を notion-fetch で取得し、現在のフェーズ・状態を把握する。

```
https://www.notion.so/301481455c788074b3c2f831f45db6e0
```

次に、現在進行中のフェーズの詳細ページも取得する。

| フェーズ | Notion URL |
|---|---|
| Phase 0 | https://www.notion.so/32b481455c7881d384a1ea7c471cb27a |
| Phase 1 | https://www.notion.so/32b481455c7881138393ee2cc17cb985 |
| Phase 2 | https://www.notion.so/32b481455c7881cdbf29c42529aaccde |
| Phase 3 | https://www.notion.so/32b481455c78819a8f2afe4cb93e8b69 |
| Phase 4 | https://www.notion.so/32b481455c7881c49ee3e42f6f586c6c |

### 2. CLAUDE.md を読む

```
/sessions/loving-friendly-cerf/mnt/voice-lab/CLAUDE.md
```

プロジェクトの技術スタック・アーキテクチャ・コーディング規約を確認する。

### 3. ユーザーに現状報告してから作業開始

「現在 Phase X が完了、次は Phase Y です。何をしますか？」のように現状を伝えてから作業に入る。

---

## 作業の進め方

### Step 1: 要件を整理する
- 何を作るか・変えるかを明確にする
- Notion のフェーズスコープ（やること・やらないこと）と照らし合わせる
- 現フェーズの範囲を超える場合はユーザーに確認する

### Step 2: 影響範囲を確認する
- 変更するファイルを `Read` で確認してから編集する
- Edge Runtime 制約に違反しないか確認（`fs`, `path` 等は NG）
- 環境変数の追加が必要なら `.env.local.example` も更新する

### Step 3: 実装する
- TypeScript strict に準拠（`any` 禁止）
- コメントは日本語で書く
- エラーハンドリングは日本語メッセージで

### Step 4: 確認する
- `pnpm check` で Lint/Format エラーがないか確認
- ブラウザで動作確認（録音 → 文字起こし → Claude → 音声再生）

---

## よく使うコードパターン

### API Route の基本形
```typescript
export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { xxx } = await req.json();
    // 処理
    return Response.json({ result: xxx });
  } catch (err) {
    console.error("xxx error:", err);
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
```

### 外部 API を fetch で呼ぶ
```typescript
const res = await fetch("https://api.xxx.com/v1/...", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.XXX_API_KEY ?? ""}`,
  },
  body: JSON.stringify({ ... }),
});
if (!res.ok) {
  const error = await res.text();
  console.error("API error:", error);
  return Response.json({ error: "..." }, { status: 500 });
}
```

---

## Phase 別の注意点

### Phase 0（現在・完了）
- DB なし・React state のみ
- システムプロンプトはコードに直書き
- Cloudflare Pages デプロイ未実施

### Phase 1（次）
- 認証追加（Clerk など）
- キャラ設定 UI
- DB 追加（Cloudflare D1 または Supabase）
- UI の仕上げ

### Phase 2
- Hono 導入・AWS インフラ
- Docker / Terraform / CI/CD
- MCP Client 導入

### Phase 3（最終目標の一つ）
**ゴール：** 自分のサービスを外部 AI（Claude Desktop・Cursor 等）から呼び出せる MCP サーバーとして公開する

公開する MCP ツール：
- `create_persona` — キャラクター作成
- `start_conversation` — 会話セッション開始
- `send_message` — テキスト送信→返答取得
- `speak` — テキスト→ElevenLabs 音声変換

技術：Phase 2 の Hono API + `@modelcontextprotocol/sdk`（TypeScript）+ Streamable HTTP

**完了定義：** Claude Desktop から MCP サーバーに接続し、キャラを作って音声会話できる状態

### Phase 4（最終目標・収益化）
**ゴール：** Freemium + Stripe 決済 + MCP B2B 展開の 3 本柱で収益化

Freemium 設計案：
- 無料：月 30 分・キャラ 1 体（$0）
- スタンダード：月 300 分・キャラ 5 体（$9/月）
- プロ：無制限（$19/月）

コスト目安：1 分の会話 ≈ $0.01（Whisper + Claude + ElevenLabs 合算）

**完了定義：** クレカなしでは月 30 分以上使えない状態で、有料ユーザーが 1 人以上いる

---

## 将来の応用アイデア（音声パイプラインの横展開）

**核心：Phase 0 で作った Whisper → Claude → ElevenLabs の側（パイプライン）は全サービス共通。プロンプトを変えるだけで別サービスになる。**

| アイデア | 難易度 | 差分 |
|---|---|---|
| 音声日記アプリ | ★★☆ | プロンプトを「日記アシスタント」に変えるだけ |
| 面接練習アプリ | ★★☆ | キャラ設定を「面接官の種類」に変えるだけ |
| 音声タスク管理 | ★★☆ | 返答をテキストリストとして表示する処理を追加 |
| 音声ナレッジベース（RAG） | ★★★ | 社内マニュアル等を登録して音声 Q&A（B2B 向け） |
| 音声インタビューツール | ★★★ | リサーチ・UX チーム向け自動文字起こし・要約 |

共通する強み：**テキスト入力ゼロ → ながら作業・移動中でも使える → ChatGPT にできない UX**

---

## 仮想会社 — VoiceLab Inc.

開発者1名（masaru）＋マーケター1名（参加予定）のスモールチーム。

### 社内ドキュメント（Notion）

| ドキュメント | URL |
|---|---|
| ロードマップ（メイン） | https://www.notion.so/301481455c788074b3c2f831f45db6e0 |
| チーム構成・役割定義 | https://www.notion.so/32b481455c78818f991ec86b2fb65d64 |
| タスク管理 | https://www.notion.so/32b481455c788168b28dc896cba50551 |
| Claude との効果的な働き方 | https://www.notion.so/32b481455c788193a295f6f17ad05b2f |
| 設計・実装方針・開発スタック | https://www.notion.so/32b481455c7881ddb091c75943b83542 |
| 仕様書 — VoiceLab App | https://www.notion.so/32b481455c7881fa8358c07d508323ed |
| 将来の応用アイデア | https://www.notion.so/32b481455c788108bbede7ffe96b5fc9 |

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| Whisper が "you" を返す | 録音が短すぎる（< 1.5秒） | 1.5秒以上話してから停止する |
| Claude API error: credit | Anthropic クレジット不足 | console.anthropic.com で追加 |
| 音声が再生されない | ElevenLabs API エラー | ダッシュボードでクレジット確認 |
| Edge Runtime エラー | Node.js モジュール使用 | Web API で代替する |
| blob size が小さい | マイクが音を拾えていない | ブラウザのマイク設定を確認 |
