---
name: launch-team
description: |
  VoiceLab の Agent Team を起動するスキル。
  「チームを起動して」「チームで実装して」「フルチームで進めて」などのトリガーで使うこと。
  タスクの種類に応じて必要なメンバーだけを起動する。
  Claude Code の native Agent Teams API（TeamCreate / TaskCreate / SendMessage）を使う。
---

# VoiceLab Agent Team 起動スキル

VoiceLab の開発チームを **native Agent Teams** として立ち上げ、タスクを分担して並列実行します。

> **前提**: `.claude/settings.json` に `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` が設定済み、Claude Code v2.1.32+ で動作。

---

## チーム構成

| エージェント | 役割 | 起動条件 |
|---|---|---|
| **pdm** | 優先度・KPI・ユーザーファネル分析 | プロダクト判断が必要なとき |
| **marketer** | コピー・プライシング・感情設計 | 訴求・UI文言の設計が必要なとき |
| **planner** | 仕様書・スプリント計画 | 実装前の設計が必要なとき |
| **frontend** | UI・ページ・クライアントロジック | フロントエンド実装があるとき |
| **backend** | API Routes・外部API・Supabase | バックエンド実装があるとき |
| **infrastructure** | Cloudflare・Supabase設定・デプロイ | インフラ変更があるとき |
| **evaluator** | 品質レビュー・合否判定 | 実装完了後のチェック |

---

## STEP 1：タスク分類

ユーザーのリクエストを以下に分類する：

| タイプ | 起動するメンバー |
|---|---|
| **プロダクト分析** | pdm + marketer |
| **機能実装** | planner → frontend + backend → evaluator |
| **インフラ変更** | planner → infrastructure → evaluator |
| **フル開発** | pdm + marketer → planner → frontend + backend + infrastructure → evaluator |

---

## STEP 2：チーム作成

`TeamCreate` ツールで新しいチームを作成する。

```
team_name: voicelab-{タスク名}-{日付} （例: voicelab-pricing-page-20260404）
description: タスクの概要
```

---

## STEP 3：タスク登録

`TaskCreate` ツールで各メンバーのタスクを登録する。

- タスクは依存関係順に作成する（planner が先、frontend/backend は後）
- 各タスクの description には **完了条件** を明記する
- 依存関係は `depends_on` で指定し、ブロック解除を自動化する

例：
```
Task 1: planner   → 仕様書作成（依存なし）
Task 2: frontend  → UI実装（depends_on: Task 1）
Task 3: backend   → API実装（depends_on: Task 1）
Task 4: evaluator → 品質チェック（depends_on: Task 2, Task 3）
```

---

## STEP 4：チームメンバーを生成する（native Agent Teams）

> **重要**: `Agent` ツール（subagent）は使わない。native Agent Teams では Claude がチームメンバーを別プロセスとして自動生成する。

チームメンバーを生成するには、自然言語で指示する：

```
「planner agent type を使って planner teammate を生成してください。
 担当タスク: Task 1（仕様書作成）
 完了後は team-lead へ SendMessage で報告すること。」
```

各メンバーへの生成プロンプトに必ず含めること：
- 担当タスク番号と完了条件
- VoiceLab のコンテキスト（現フェーズ・技術スタック）
- 完了後に `SendMessage` でリーダーへ報告する指示
- 並行実行可能なメンバーは同時に生成する

---

## STEP 5：調整・統合

- チームメンバーからの報告（`SendMessage`）を受け取り、次のタスクを割り当てる
- 依存関係のブロックが解除されたタスクに次のメンバーを割り当てる
  - 例: planner 完了 → frontend + backend を並行起動
- 全タスク完了後に evaluator を生成して品質チェック
- In-process モード: `Shift+Down` でメンバーをサイクル
- Split pane モード（tmux）: 各ペインで直接操作

---

## STEP 6：シャットダウンとクリーンアップ

全タスク完了・evaluator が合格を出したら：

1. 各メンバーにシャットダウンリクエストを送る：
   ```
   「researcher teammate にシャットダウンするよう指示してください」
   ```
2. 全員のシャットダウン確認後に `TeamDelete` を実行する

> **注意**: TeamDelete はリーダーのみが実行する。アクティブなメンバーが残っていると失敗する。

---

## 起動テンプレート

### 機能実装チーム（最小構成）
```
タスク: [実装する機能]
チーム構成: planner → frontend（or backend）→ evaluator
目的: 実装 + 品質保証
```

### フルチーム（大型機能）
```
タスク: [大きな機能・フェーズ全体]
チーム構成: pdm + marketer → planner → frontend + backend（並行）→ evaluator
目的: プロダクト判断から実装まで一気通貫
```

### プロダクト分析チーム
```
タスク: [分析したい内容]
チーム構成: pdm + marketer
目的: Phase の優先度判断・訴求設計
```
