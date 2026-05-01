---
name: pr-review
description: |
  VoiceLab の PR レビューの日本語トリガー層（薄いディスパッチャー）。
  「PRをレビューして」「このPRを確認して」「差分を見て」「コードレビューして」
  「マージしていい？」「これで問題ない？」などのトリガーで必ず使うこと。
  実体のレビュー処理は plugin 版 pr-review-toolkit:review-pr に委譲する。
  甘い「問題なし」禁止・必ず根拠を示す。
---

# VoiceLab PR レビューディスパッチャー

このスキルは**薄いラッパー**です。PR レビューの本体処理は plugin 版
`pr-review-toolkit:review-pr` が担当し（specialized agents によるコードレビュー・
テスト観点・silent failure・型設計・コメント解析等を網羅）、VoiceLab 固有の
品質チェックは AGENTS.md の「品質評価基準（ハーネスパターン）」セクションが
単一の真実です。このファイルには品質基準を**重複して書きません**。

---

## 🚨 重要な運用ルール

1. **PR レビューは必ずこのスキル経由で行う**
   raw `gh pr diff` で差分を見て終わり、にしない。日本語トリガーはこのスキルで受け、
   plugin 版に委譲することで specialized agents による網羅チェックと
   VoiceLab 固有ルールの両方を当てる。

2. **マージは Codex が実行しない**
   レビュー結果が ✅ 問題なし 判定でも `gh pr merge` を叩かない。
   レポート末尾に **「マージは Masaru さん側でお願いします」**と一言添える。
   例外：Masaru さんが明示的に「このままマージして」と指示した場合のみ。

3. **甘い「問題なし」は禁止**
   動きそうに見えても「実際に動くか」を懐疑的に確認する。問題なしと判定するなら
   必ず**根拠**（なぜ問題ないか）を明示する。

4. **修正して再 PR が必要になったら `pr-create` スキルを使う**

---

## 処理手順

### STEP 1：差分の把握

```bash
# PR 番号がわかる場合
gh pr view <番号> --json title,body,files,commits,additions,deletions
gh pr diff <番号>

# 現ブランチを見る場合
git diff main...HEAD
git log main..HEAD --oneline
```

### STEP 2：plugin 版に委譲

Skill tool で **`pr-review-toolkit:review-pr`** を実行する。plugin 側が
specialized agents を呼び分けて以下を網羅チェックする：

- コード品質（style / best practices / convention）
- silent failure / inadequate error handling
- テストカバレッジ
- 型設計
- コメントの正確性
- コードの簡素化余地

### STEP 3：VoiceLab 固有観点を追加適用

plugin のレビュー結果に、AGENTS.md の「品質評価基準（ハーネスパターン）」
セクションの観点から**該当項目**を追加チェックする。変更に関係ない項目は省略してよい。

- **機能品質**：スタブでない / 日本語フィードバック / Edge Runtime 制約 / エッジケース
- **UI/UX 品質**：一貫した世界観 / 量産カード NG / ローディング・エラー状態の視覚化
- **音声フロー品質**（音声関連のみ）：
  - Whisper → Codex Haiku → ElevenLabs パイプラインの接続
  - `MIN_RECORDING_MS = 1500` の遵守
  - Chrome / Safari / Firefox の音声フォーマット分岐

### STEP 4：判定レポートを出力

```
## PR レビュー結果：[✅ 問題なし / ⚠️ 軽微な指摘 / ❌ 要修正]

### 概要
（何を変更した PR か・全体の印象）

### ✅ 良い点
- ...

### ❌ 必須修正
- `ファイル名:行番号` — 問題の説明 → 修正方法

### ⚠️ 任意の改善提案
- ...

### テスト確認
- pnpm test：[通過 / 未確認 / 失敗]

### 判定理由
（なぜこの判定になったか。問題なし判定でも根拠必須）

---
マージは Masaru さん側でお願いします。
```

---

## 判定基準

| 判定 | 条件 |
|---|---|
| ✅ 問題なし | AGENTS.md の必須チェックが全通過 + `pnpm test` 通過 + plugin のレビュー指摘なし |
| ⚠️ 軽微な指摘 | 必須チェック通過・テスト通過だが、推奨項目 or plugin が軽微な指摘を挙げた |
| ❌ 要修正 | 必須チェックが 1 つでも NG、またはテストが落ちている、または plugin が重大な指摘を挙げた |

「たぶん大丈夫」「小さい問題だから」という判断は禁止。
疑わしい場合は「要修正」とし、修正後に再レビューを求める。

---

## フォールバック

plugin 版 `pr-review-toolkit:review-pr` が期待通り動かない場合は、
raw `gh pr diff` で差分を見つつ AGENTS.md の品質評価基準セクションで
手動レビューする。その場合もマージ方針（Codex はマージしない）は変わらず。
