---
name: pr-create
description: |
  VoiceLab の PR（プルリクエスト）を作成するスキル。
  「PRを作って」「プルリクを出して」「PR作成」「マージしたい」
  「ブランチを main に入れたい」「変更をプッシュしてPR出して」
  などのトリガーで必ず使うこと。
  gh コマンドで適切なタイトル・本文の PR を作成し、VoiceLab の開発コンテキストを反映する。
---

# PR 作成スキル（VoiceLab）

## 事前確認

```bash
# 現在のブランチ名
git branch --show-current

# main との差分コミット
git log main..HEAD --oneline

# 変更ファイルの一覧
git diff main...HEAD --stat

# テストが通っているか
pnpm test
```

テストが落ちていたら PR を作る前にユーザーに報告して確認を取る。

---

## PR タイトルの命名規則

ブランチ名とコミット内容から判断して、以下の形式にする：

```
<type>: <日本語で何をしたか>（英語でも可）
```

| type | 使う場面 |
|------|---------|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメント変更のみ |
| `refactor` | 動作を変えないコードの整理 |
| `test` | テストの追加・修正 |
| `chore` | 設定・依存関係の変更 |

タイトルは 70 文字以内。

---

## PR 本文のテンプレート

```markdown
## 概要
<!-- 何をなぜ変更したか、1〜3 行で -->

## 変更内容
<!-- 箇条書きで変更点を列挙 -->
-

## テスト
<!-- どう確認したか -->
- [ ] `pnpm test` 全通過
- [ ] ローカルで動作確認済み

## チェックリスト（CLAUDE.md より）
- [ ] スタブ・モックでなく実際に動作している
- [ ] API エラー時に日本語でフィードバックしている
- [ ] Edge Runtime の制約に違反していない（fs/path 禁止）
- [ ] TypeScript strict モード（any 禁止）
```

---

## PR を作成する

```bash
gh pr create \
  --title "<タイトル>" \
  --body "$(cat <<'EOF'
<本文>
EOF
)" \
  --base main
```

作成後は PR の URL を表示する。

---

## ドラフト PR にする場合

変更が未完成・レビュー前の確認用なら `--draft` を追加する：

```bash
gh pr create --draft --title "..." --body "..."
```
