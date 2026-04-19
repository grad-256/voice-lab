---
name: launch-team
description: |
  VoiceLab の Agent Team を起動するスキル。
  「チームを起動して」「チームで実装して」「フルチームで進めて」「並行で進めて」
  「バックグラウンドで調べて」「裏で走らせて」「定期的に確認して」などのトリガーで使うこと。
  **Masaru さんは tmux split で進捗を見たい人なので、何も指定がない場合は必ずパターン A（tmux split）を使う。**
  タスクの性質に応じて 3 つの実行パターン（A: 並列チーム / B: バックグラウンド / C: スケジュール）を
  使い分ける。Claude Code の native Agent Teams API（TeamCreate / TaskCreate / SendMessage）と
  Agent ツール（run_in_background / isolation: worktree）を使う。
---

# VoiceLab Agent Team 起動スキル v3

VoiceLab の開発チームを分散起動して並列実行します。
v3 では **デフォルトはパターン A（tmux split）**。Masaru さんはペイン越しに進捗を見たい人なので、
「並列で」「チームで」「複数作業を並行して」と言われたら **反射的に A を選ぶ**。

> **前提**: `.claude/settings.json` に `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMmode: "tmux"` 設定済み。

## v3 での変更点（重要）

- **既定は Pattern A（tmux split）**。Masaru さんから明示的に「裏で走らせて」「定期実行で」と言われない限り、必ず A を使う。
- **Agent ツールの `run_in_background: true` を安易に使わない**。それは「見えない並列実行」= Pattern B であり、
  Masaru さんが毎回「画面に出てこない」と不満を示した実績がある。
- **権限問題の注意**：Pattern A（`TeamCreate` + `Agent(team_name, name)` で spawn）だと teammate が
  親セッションの permission を継承しやすい。**Pattern B（`run_in_background`）は default permission で立ち上がるため Edit/Write が拒否されやすい**。
  これも A をデフォルトにすべき理由。

---

## チーム構成

| エージェント | 役割 | 起動条件 |
|---|---|---|
| **pdm** | 優先度・KPI・ユーザーファネル分析 | プロダクト判断が必要なとき |
| **marketer** | コピー・プライシング・感情設計 | 訴求・UI文言の設計が必要なとき |
| **branding** | 世界観・トーン・ビジュアル一貫性 | ブランド軸の定義・デザイン方向性が必要なとき |
| **legal-checker** | 特商法・プラポリ・利用規約・AI規約整合性 | 収益化前・LP公開前・ボイスクローン導入前 |
| **planner** | 仕様書・スプリント計画 | 実装前の設計が必要なとき |
| **frontend** | UI・ページ・クライアントロジック | フロントエンド実装があるとき |
| **backend** | API Routes・外部API・Supabase | バックエンド実装があるとき |
| **infrastructure** | Cloudflare・Supabase設定・デプロイ | インフラ変更があるとき |
| **evaluator** | 品質レビュー・合否判定 | 実装完了後のチェック |

---

## 実行パターンの使い分け（v3：A がデフォルト）

### 判断フロー

```
[1] 「毎日」「〇〇分ごとに」と時間指定あり？ ─ Yes ─→ パターン C（スケジュール）
        │ No
        ▼
[2] 「裏で」「待ってる間に」「調査だけ」等の明示？ ─ Yes ─→ パターン B（バックグラウンド）
        │ No
        ▼
     **デフォルト：パターン A（tmux split）で起動する**
```

### ルール（Masaru さんの過去フィードバックから確定）

- **何も言われなくても「複数の独立タスク」なら A**：Masaru さんが tmux 越しに進捗を見たい
- **「チームで」「並列で」は確定で A**
- 単発タスクで「調べておいて」だけなら B-1
- 明確に「別 worktree で試して」と言われたら B-2
- Pattern B を使うときは **必ず「tmux に出ない旨」を事前にひとこと告げる**（認識齟齬防止）

---

## 🅐 パターン A：並列チーム（tmux split、リアルタイム協調）

**使いどころ**
- 複数の専門領域（frontend + backend + infra）が同時に動く必要がある
- 途中でメンバー間の調整が発生する（API契約の合意など）
- Masaru さんがペイン越しに進捗を見ながら進めたい

**典型例**
- 「LP再設計と API 拡張を同時に進めて」
- 「フルチームで Phase 1.5 の残タスクを片付けて」
- 「ログイン導線の UI と認証ロジックを並行で」

**起動手順**

1. `TeamCreate` でチーム作成（`team_name: voicelab-{タスク名}-{日付}`）
2. `TaskCreate` で依存関係つきタスクを登録
   ```
   Task 1: planner   → 仕様書作成（依存なし）
   Task 2: frontend  → UI実装（depends_on: Task 1）
   Task 3: backend   → API実装（depends_on: Task 1）
   Task 4: evaluator → 品質チェック（depends_on: Task 2, Task 3）
   ```
3. 自然言語で teammate を生成（`Agent` ツールは**使わない**）
   ```
   「planner agent type を使って planner teammate を生成してください。
    担当タスク: Task 1（仕様書作成）
    完了後は team-lead へ SendMessage で報告すること。」
   ```
4. 各メンバーの報告（`SendMessage`）を受けて次のタスクを割り当てる
5. tmux モード：`Shift+Down` でメンバー間をサイクル
6. 完了後に `TeamDelete` でクリーンアップ

**完了条件**: 全タスク完了 + evaluator 合格 → 完了レポート出力 → `TeamDelete`

---

## 🅑 パターン B：バックグラウンド／ワークツリー隔離

**使いどころ**
- 独立性が高く、途中で介入不要なタスク
- 調査・リサーチ・データ収集（結果だけほしい）
- 実験的リファクタ・破壊的な変更（現ブランチを汚したくない）
- Masaru さんは別の作業をしていて、終わったら通知してほしい

**典型例**
- 「Posthog イベントの網羅性を調査して」
- 「この PR の全コメントを読んで修正案をまとめて」
- 「`app/api/chat/route.ts` を streaming 対応にリファクタして（別worktreeで）」
- 「CLAUDE.md を他プロジェクトの例と比較してブラッシュアップ案を出して」

**起動手順**

2 つのモードがある。

### B-1. バックグラウンド実行（現在のディレクトリ）

`Agent` ツールを `run_in_background: true` で起動する。

```
Agent({
  description: "Posthog event coverage audit",
  subagent_type: "Explore",
  run_in_background: true,
  prompt: "..."
})
```

- メインセッションは即座にブロック解除される
- エージェント完了時に自動通知が届く
- Masaru さんは待たずに別タスクを進められる

**使いどころ**: 読み取り中心のタスク（調査・grep・分析）

### B-2. Worktree 隔離実行（破壊的な変更を安全に）

`Agent` ツールを `isolation: "worktree"` で起動する。

```
Agent({
  description: "Refactor chat route to streaming",
  subagent_type: "backend",
  isolation: "worktree",
  prompt: "..."
})
```

- 新しい git worktree で作業するため現ブランチは無傷
- 変更があれば完了時に worktree パスとブランチ名が返ってくる
- 問題なければ後で cherry-pick / merge して取り込む

**使いどころ**: 書き込みが多いタスク（リファクタ・機能実装・実験）

### パターン B の注意点

- **完了条件を明確に書く**：途中確認ができないので、プロンプトに「成果物の形式」「終わる条件」を具体的に書く
- **長すぎるタスクは避ける**：10 分以上かかるものは進捗が見えず不安になる。分割するか A に切り替える
- **evaluator は別途走る**：PostToolUse + Stop フックが自動で品質チェックをトリガーする（後述）

---

## 🅒 パターン C：スケジュール／ループ実行

**使いどころ**
- 定期的なチェック・モニタリング
- 長時間の状態監視（デプロイ進行状況など）
- 日次／週次の定型タスク

**典型例**
- 「5 分おきに Cloudflare Pages のデプロイステータスを確認」
- 「毎日朝 9 時に main ブランチの CI 状況をレポート」
- 「新しい Supabase エラーログを 10 分ごとにチェック」

**起動手順**

- 単発ループ：`loop` スキルを使う
  - `/loop 5m /check-deploy` のように起動
- 永続スケジュール：`schedule` スキルを使う
  - cron 形式でリモートトリガーを登録

### パターン C の注意点

- **無限ループに注意**：停止条件を明確にするか、手動で `cancel-ralph` 等で止める
- **コスト意識**：頻度の高い定期実行は API 消費につながる
- **失敗時の挙動**：エラー時にどうするか（通知／自動リトライ／停止）を決めておく

---

## パターン選択チートシート

| 依頼の特徴 | 選ぶパターン |
|---|---|
| 「一緒に作って」「チームで」「並行して」 | **A** |
| 「調べておいて」「裏で」「待ってる間に」 | **B-1** |
| 「別ブランチで試して」「実験的に」「壊れないように」 | **B-2** |
| 「〇〇分ごとに」「毎日」「定期的に」 | **C** |
| 短い単発タスク・ちょっとした修正 | パターン不使用、直接作業 |
| 1 機能の完結した実装 | `harness-executor` スキル（このスキルではない） |

---

## パターン併用例

大きな機能開発では複数パターンを組み合わせる。

```
例: Phase 1.5 の残タスクを全部片付ける

1. パターン A で pdm + marketer + planner を起動 → 仕様統合
2. パターン A で frontend + backend を並行実装
3. パターン B-1 で evaluator を並行実行（自動フック発火）
4. パターン C で Cloudflare デプロイを 3 分おきにモニタ
```

---

## 自動品質チェック（Hooks 連携）

v2 から、**コード変更を検知したら自動で evaluator が走る**ようにフックが入っています。

- `app/` / `components/` / `lib/` 配下の `.ts`/`.tsx` を Edit/Write すると
  `.claude/flags/evaluator-pending` フラグが立つ
- ターン終了時（Stop フック）にフラグがあれば、Claude に「evaluator を起動せよ」と指示が入る
- evaluator 完了で合格なら次へ、不合格ならフィードバックループ

→ **パターン A / B どちらでもこのフックは共通で動作する**ので、実装完了後に「evaluator 忘れてた」が起きません。

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| teammate が生成されない | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 確認、v2.1.32+ 確認 |
| バックグラウンドタスクが返ってこない | `KillShell` や `TaskStop` で停止、プロンプトを短くして再実行 |
| worktree が残留している | `ExitWorktree` でクリーンアップ、または `git worktree list` で確認 |
| 自動evaluatorが走らない | `.claude/settings.json` の hooks 設定確認、`.claude/flags/` ディレクトリ存在確認 |
| evaluator が無限ループ | `.claude/flags/evaluator-pending` を手動削除 |
