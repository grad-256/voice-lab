---
name: launch-team
description: |
  VoiceLab の Agent Team を起動するスキル。
  「チームを起動して」「チームで実装して」「フルチームで進めて」などのトリガーで使うこと。
  タスクの種類に応じて必要なメンバーだけを起動する。
---

# VoiceLab Agent Team 起動スキル

VoiceLab の開発チームを Agent Teams として立ち上げ、タスクを分担して実行します。

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

```
TeamCreate ツールで新しいチームを作成する。
team_name: voicelab-{タスク名}-{日付} （例: voicelab-pricing-page-20260403）
description: タスクの概要
```

---

## STEP 3：タスク登録

TaskCreate ツールで各メンバーのタスクを登録する。
- タスクは依存関係順に作成する（planner が先、frontend/backend は後）
- 各タスクの description には完了条件を明記する

---

## STEP 4：メンバー起動

Agent ツールで必要なメンバーを起動する（並行起動可能なものは同時に）。

各メンバーへの指示に必ず含めること：
- 担当タスク番号
- VoiceLab のコンテキスト（現フェーズ・技術スタック）
- 完了後に `team-lead` へ SendMessage で報告すること

---

## STEP 5：調整・統合

- メンバーからの報告を受け取り、次のタスクを割り当てる
- 依存関係に応じて順番を管理する（planner 完了 → frontend/backend 起動 など）
- 全タスク完了後に evaluator を起動して品質チェック

---

## STEP 6：シャットダウン

全タスク完了・evaluator が合格を出したら：
1. 各メンバーに `SendMessage: {type: "shutdown_request"}` を送る
2. 全員のシャットダウン確認後に `TeamDelete` を実行する

---

## 起動テンプレート（コピー用）

### プロダクト分析チーム
```
タスク: [分析したい内容]
起動: pdm + marketer
目的: Phase 1.5 の優先度判断
```

### 機能実装チーム
```
タスク: [実装する機能]
起動: planner → frontend（必要なら）+ backend（必要なら）→ evaluator
目的: 実装 + 品質保証
```

### フルチーム
```
タスク: [大きな機能・フェーズ全体]
起動: pdm + marketer → planner → frontend + backend + infrastructure → evaluator
目的: プロダクト判断から実装・デプロイまで一気通貫
```
