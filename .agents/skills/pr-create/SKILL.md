---
name: pr-create
description: |
  VoiceLab の PR 作成の日本語トリガー層（薄いディスパッチャー）。
  「PRを作って」「プルリクを出して」「PR作成」「マージしたい」
  「ブランチを main に入れたい」「変更をプッシュしてPR出して」
  などのトリガーで必ず使うこと。
  実体の PR 作成処理は plugin 版 commit-commands:commit-push-pr に委譲する。
---

# VoiceLab PR 作成ディスパッチャー

このスキルは**薄いラッパー**です。PR 作成の本体処理は plugin 版
`commit-commands:commit-push-pr` が担当し、VoiceLab 固有の品質チェックは
AGENTS.md の「品質評価基準（ハーネスパターン）」セクションが単一の真実です。
このファイルには品質基準を**重複して書きません**。

---

## 🚨 重要な運用ルール

1. **PR 作成は必ずこのスキル経由で行う**
   raw `gh pr create` を Codex が直接叩かない。日本語トリガーはこのスキルで受け、
   plugin 版に委譲することで VoiceLab 固有のルール（AGENTS.md 参照・英語コミット等）が確実に適用される。

2. **マージは Codex が実行しない**
   `gh pr merge` は Codex が叩かない。PR 作成・push 完了後、
   **「マージは Masaru さん側でお願いします」**と一言添えて委ねる。
   例外：Masaru さんが明示的に「マージまでやって」と指示した場合のみ。

3. **レビューは `pr-review` スキルを使う**
   PR 作成後にレビューを求められたら `pr-review` スキルを呼び出す（こちらも薄いディスパッチャー）。

---

## 処理手順

### STEP 1：事前確認

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --stat
pnpm test
```

テストが落ちていたら PR を作らず Masaru さんに報告して確認を取る。

### STEP 2：plugin 版に委譲

Skill tool で **`commit-commands:commit-push-pr`** を実行する。plugin 側が：

- commit message の生成（※ **必ず英語 ASCII のみ**。後述）
- remote への push（`-u origin <branch>` 相当）
- PR の作成

を一気通貫でやってくれる。

### STEP 3：VoiceLab 固有チェックを反映

plugin 生成の PR 本文に、AGENTS.md の「品質評価基準（ハーネスパターン）」
セクションから**該当項目**を拾ってチェックリストとして追記する。
変更に関係ない項目は省略してよい。

- **機能品質**：スタブ・モックでない / API エラー時に日本語フィードバック / Edge Runtime 制約 / エッジケース
- **UI/UX 品質**：一貫した世界観 / 量産カード NG
- **音声フロー品質**（音声まわりに触った場合のみ）：Whisper → Codex Haiku → ElevenLabs パイプライン / `MIN_RECORDING_MS = 1500` / ブラウザ別フォーマット分岐

### STEP 4：完了報告

PR URL を表示し、**「マージは Masaru さん側でお願いします」**の一言を必ず添える。

---

## コミットメッセージの言語ルール

> ⚠️ **コミットメッセージは必ず英語（ASCII のみ）で書く**。
>
> Cloudflare Pages の API が日本語などのマルチバイト文字を含むコミットメッセージを
> `Invalid commit message, it must be a valid UTF-8 string. [code: 8000111]` として
> 拒否し、デプロイが失敗する。AGENTS.md 参照。
>
> PreToolUse Bash hook が `.Codex/hooks/check-commit-ascii.sh` で自動検知する仕組みも入っている。
> PR タイトル・本文は日本語 OK（Cloudflare は PR 本体を見ない）。

---

## フォールバック

plugin 版 `commit-commands:commit-push-pr` が期待通り動かない場合は、
raw `gh pr create` へフォールバックしてよい。その場合も：

- コミットメッセージは英語 ASCII
- PR 本文のチェックリストは AGENTS.md の品質評価基準セクションを参照
- マージは Codex が実行しない（上記ルール 2 は変わらず）

を守る。

---

## ドラフト PR

変更が未完成・レビュー前の確認用なら、plugin 版呼び出し時に draft 指定を伝える。
