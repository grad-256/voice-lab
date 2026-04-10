---
name: launch-team
description: |
  VoiceLab の Agent Team を起動するスキル。
  「チームを起動して」「チームで実装して」「フルチームで進めて」「並行で進めて」
  「バックグラウンドで調べて」「裏で走らせて」「定期的に確認して」などのトリガーで使うこと。
  タスクの性質に応じて 3 つの実行パターン（A: 並列チーム / B: バックグラウンド / C: スケジュール）を
  使い分ける。Claude Code の native Agent Teams API（TeamCreate / TaskCreate / SendMessage）と
  Agent ツール（run_in_background / isolation: worktree）を使う。
---

# VoiceLab Agent Team 起動スキル v2

VoiceLab の開発チームを分散起動して並列実行します。
v2 では **3 つの実行パターン** を使い分けます。

> **前提**: `.claude/settings.json` に `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 設定済み。

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

## 実行パターンの使い分け（最初に判断する）

ユーザーの依頼を読んで **A / B / C のどれか** を決める。

### 判断フロー

```
[1] 繰り返し or 定期実行 が必要？ ──── Yes ──→ パターン C（スケジュール）
        │ No
        ▼
[2] 作業を横で見ながら進めたい？ ──── Yes ──→ パターン A（並列チーム）
        │ No
        ▼
[3] 独立したタスクを裏で走らせたい？── Yes ──→ パターン B（バックグラウンド）
        │ No
        ▼
     単一セッションで実行（harness-executor スキルを使う）
```

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
