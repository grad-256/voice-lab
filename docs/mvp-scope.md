# MVP スコープ定義（B-2 再々改訂版：既存キャラ対話 + 分身の声 + サジェスト 統合 MVP）

**作成日**：2026-04-14（初版）
**改訂日**：2026-04-14（B-2 大方向転換：ElevenLabs voice slot 制約受けての分身の声ピボット）
**再改訂日**：2026-04-14（前改訂版の「Step 0 単体スコープ」誤解釈を全面訂正）
**再々改訂日**：2026-04-14（evaluator 12 点不合格指摘の反映：突合仕様・改修境界・API 方針・ゲスト移行経路・依存関係図・段階番号語彙除去）

**再々改訂の背景**：
- B-5 レビューで evaluator（品質レビューエージェント）が「重大度：高 5 件・中 7 件」の不合格判定。主要論点：
  - `phrase_used_in_chat` の突合仕様が未定義で KPI 計算不能
  - Sprint 2/3 で既存 `app/app/page.tsx` の改修境界が未定義（stale closure 回帰リスク）
  - `voice_features_vector` カラムと「永続化しない」方針の矛盾
  - `/api/chat` 拡張 vs `/api/suggest` 新設が未決でジェネレーターが着手不可
  - ゲスト UUID → user_id マッピングの実装経路未定義
  - 依存関係図の論理破綻（Sprint 4 依存に Sprint 2 欠落 等）
  - 「Step 0」語彙が 5.1・KPI・イベント定義に残り誤解招来
- 本書は上記を全面反映した修正版。B-6（MVP プロト実装）の入力仕様として使用する。

**前提ドキュメント**：
- `docs/competitor-research.md`（B-1 成果物）
- `docs/current-implementation.md`（現状コード把握）
- `docs/fe-be-boundary.md`（FE/BE 責務）
- `docs/monorepo-structure.md`（物理構造の憲法）
- `.claude/agents/marketer.md`（ペルソナ・コピー方針）
- `.claude/agents/branding.md`（world view / トーン）
- `CLAUDE.md`（プロジェクト全体）
- memory `project_b2_pivot.md`（ピボット判断経緯）
- memory `project_current_implementation_vs_mvp.md`（訂正版：既存機能は維持）

**位置付け**：
- 本書は **B-6（MVP プロト実装）の入力仕様**である。
- ジェネレーター（frontend / backend / infrastructure）が迷わず着手できる粒度で書く。
- ただし「どのファイル名に書くか」「どのライブラリを入れるか」は実装側で判断する領域として残す。

---

## 1. 決定事項（1 行ずつ）

1. **MVP は "既存キャラ対話 + 分身の声 + サジェスト" の統合体験である。** 既存のキャラ作成・選択・会話は維持・発展。単体スコープには後退しない。
2. **既存機能は破棄・非表示にしない。** `app/personas/*`、`app/app/page.tsx`（会話 UI）、`lib/personas.ts`、`lib/conversations.ts`、`app/api/chat`、`app/api/speak`、`app/api/transcribe` はすべて維持。新機能は**追加**で実装する。
3. **DB スキーマ変更は追加のみ。** 既存テーブルの破壊的変更（DROP / RENAME 等）は行わない。
4. **分身の声（録音分析に基づくマッチング）を新規追加する。** 10〜15 秒の録音 → ブラウザ内で特徴量抽出 → ElevenLabs Voice Library プリセット voice 5〜10 個とのコサイン類似度マッチング → 上位 3 候補から選択。
5. **録音データ・特徴量ベクトルは永続保存しない。** 特徴量抽出後に録音 Blob を即破棄、マッチング完了後に特徴量ベクトルも破棄。サーバー・DB・ストレージに一切残さない。**`voice_sessions` テーブルに特徴量ベクトル用カラムは設けない。**
6. **1 ユーザー = 1 分身声（固定、いつでも再マッチング可能）。** 複数ストックは持たない。再マッチングで上書き。
7. **分身の声は「発話側」、キャラの声は「相手側」。** 両者は別物として併存する。混同しない。
8. **分身の声で英語フレーズを聞く手段は二通り用意する。** (a) 独立画面（プリセット場面一覧・保存済みフレーズ一覧・いつでも再生可）、(b) 会話画面内（サジェストに紐づく再生ボタン）。
9. **サジェスト機能を新規追加する。** 出現タイミング（会話前 / 会話中 / 両方）と自動再生 ON/OFF は**ユーザーが設定画面で選択可**。
10. **分身の声で聞けるフレーズの出所は 3 系統すべて入れる。** (a) プリセット場面（運営用意 5〜10 個）、(b) ユーザー登録（会話中「これ言えなかった」を保存）、(c) サジェスト由来（サジェストで出たフレーズがそのまま再生可）。
11. **差別化 5 点セット**：**分身の声（録音分析に基づく）× とっさの場面 × 心理ハードル × 既存キャラ対話との接続 × 日本語ペルソナ**。5 点のうち 1 つでも欠けたら YourBestAccent の劣化版になる。
12. **本 MVP は現行 Next.js リポジトリ上で実装する。** モノレポ再編（`apps/web` / `apps/api`）は C-1 着手時に実施。Hono 移行は MVP 後。
13. **段階番号語彙（「Step 0」「Step 1」等）は本 MVP 仕様書および実装コード・イベント名・KPI 名から排除する。** 機能や体験は意味のある名前で指す。
14. **サジェスト生成は `/api/suggest` を新設して実装する。既存 `/api/chat` への生成ロジック混入は禁止。** `/api/chat` は会話返答のみを担う責務境界を維持する。
15. **分身の声の保存・取得は認証済み API（`/api/voice-session`）経由で RLS を効かせる。** Sprint 1 完了条件の一部。

---

## 2. MVP スコープ（入れる / 入れない の線引き）

### 2.1 入れる

#### 既存機能（維持・必要に応じて拡張）

| 機能 | 扱い |
|------|------|
| LP（`app/page.tsx`） | 維持。コピーは「分身の声」ナラティブに合わせて微調整可 |
| Supabase Auth（メール/パスワード） | 維持 |
| キャラ作成・選択・一覧（`app/personas/*`） | **維持**。削除・非表示禁止 |
| 会話 UI（`app/app/page.tsx`） | 維持＋拡張。非破壊改修境界は 3.6 節参照 |
| 対話パイプライン（Whisper → Claude Haiku → ElevenLabs） | 維持。**順序・stale closure 対策・MIME 判定は不可侵**（3.6 節） |
| 設定画面（`app/settings/*`） | 維持＋拡張（サジェストタイミング・自動再生 ON/OFF・分身声の再マッチング導線） |
| 計測基盤（PostHog） | 維持＋新イベント追加 |
| ゲスト制限（`lib/guestUsage.ts` の GUEST_LIMIT） | **5 → 10** に引き上げ（Q2 / 5.4 節）。会話・分身声作成・サジェスト採用・独立画面再生の 4 種を同一カウンタに加算 |

#### 新規追加機能

| 機能 | 内容 |
|------|------|
| 分身の声作成フロー | 10〜15 秒録音 → ブラウザ内特徴量抽出 → プリセット voice とのマッチング → 上位 3 候補提示 → 1 つを選択 |
| マッチング納得感 UI | 分析アニメーション・候補ごとの理由文・選択後フィードバック |
| 分身の声で英語を聞く独立画面 | プリセット場面 5〜10 個の一覧・各場面の英フレーズ再生・保存済みフレーズ一覧・検索 |
| 会話画面内の分身再生ボタン | サジェストフレーズに紐づく再生ボタン（自動再生 ON の場合はタップ不要） |
| サジェスト機能 | 会話前 / 会話中 / 両方（ユーザー選択）に英語フレーズを提示。Claude Haiku ベース生成 |
| 「これ言えなかった」保存 | 会話中のユーザー発話から「後で分身の声で聞きたいフレーズ」を保存 |
| ユーザー設定拡張 | サジェストタイミング選択・自動再生 ON/OFF・分身声の再マッチング |
| プリセット場面コンテンツ | 5〜10 個（例：駅で道、トイレの場所、会計、乗り換え、空港で荷物） |
| ゲスト時の体験 | 分身の声作成・独立画面での再生・既存キャラ対話すべてゲストで可能。既存 GUEST_LIMIT に新イベントを加算してフリーミアム導線に接続 |
| 計測（PostHog） | 本書 4.3 節の新イベントを発火 |
| 認証済み書込 API | `/api/voice-session`（POST/GET）と RLS（`user_id = auth.uid()`） |
| サジェスト API | `/api/suggest`（新設、Edge Runtime、Claude Haiku） |
| 発話突合ロジック | `phrase_used_in_chat` を 2 段階キーで判定（4.5 節） |

### 2.2 入れない（MVP スコープアウト）

| 機能 | 理由・担当フェーズ |
|------|-------------------|
| ユーザー自身の声クローン（IVC / PVC） | ElevenLabs の slot 制約と不整合。本 MVP はプリセット voice のみ |
| 録音データ・特徴量ベクトルの永続保存 | 法務リスク最小化のため**実装禁止**（3.9 節） |
| 真似録音 + 比較再生 | 次期 MVP。MVP では「聞く」「サジェスト起点で会話」までに留める |
| 発音スコアリング | ブランド方針として否定（「正しさではなく慣れ」） |
| マイページ・達成度ダッシュボード | B-8 |
| 多言語（日本語学習・中国語等） | MVP は英語のみ |
| 決済・Stripe 連携 | D フェーズ |
| モバイルアプリ | 後続 |
| voice confrontation 対策（生声中和フィルタ等） | 原理的に不要（生声を再生しない設計） |
| Hono / Workers 移行・モノレポ再編 | C-1 / C-2 |
| 複数分身声のストック・切替 | MVP では 1 ユーザー = 1 分身声固定 |

---

## 3. 体験設計の詳細

### 3.1 初回体験フロー（未ログイン / ゲスト）

```
[1] ランディング（既存 LP）
    「"まっすぐ行って左です" が、とっさに出なかった日に。」
    [ はじめる ] ボタン

[2] キャラ選択 or 新規作成（既存機能）
    - 既存のキャラ一覧から選択、または新規作成
    - 既存 UI をそのまま使う

[3] 分身の声を作る（新規・初回のみ必須）
    - 「あなたの声から、あなたに近い分身の声を見つけます」の説明 1 画面
    - マイク許可
    - 日本語の指定文を 10〜15 秒音読（同意チェック必須・3.10 節参照）
    - 録音完了 → ブラウザ内で特徴量抽出 → 録音データ即破棄

[4] 分身の声マッチング結果画面（新規・差別化ナラティブの核）
    - 分析中アニメーション 2〜3 秒
    - 上位 3 候補を順に提示（試聴 + 選ばれた理由文）
    - 1 つを選択 → 「この声を、あなたの分身として覚えました」

[5] 次のアクションを提示（二択）
    (a) [ 分身の声で英語を聞いてみる ] → 独立画面（プリセット場面一覧）
    (b) [ このキャラと会話を始める ] → 既存会話 UI（サジェスト設定は初期値）

[6-a] 独立画面：分身の声で聞く
    - プリセット場面カード一覧（5〜10 個）
    - タップで場面内の英フレーズ 3 つを表示・再生
    - [ もう一度 ] [ 次のフレーズ ] [ 別の場面へ ]
    - [ 会話を始める ] で (6-b) へ遷移可

[6-b] 会話画面（既存機能 + サジェスト UI 追加）
    - 既存のキャラ対話フロー
    - ユーザー設定に応じてサジェストが会話前/中に出現
    - サジェストには分身声の再生ボタン（自動再生 ON なら自動）
    - 会話中ユーザー発話の横に「これ言えなかった」保存ボタン
```

### 3.2 2 回目以降のフロー

```
- 分身の声作成はスキップ（selected_voice_id が DB/localStorage に保存済み）
- ランディング or ホーム → キャラ選択 → 会話 or 独立画面
- 独立画面は常時アクセス可能（ヘッダ or ナビから）
- 設定画面から「分身の声を選び直す」導線でマッチング再実行
- 保存済みフレーズが独立画面のタブに追加される
```

### 3.3 分身の声マッチング納得感設計（差別化ナラティブの核）

単なる voice 選択 UI ではなく「**あなたの声を分析した結果**」であることが体験に残らないと、「自分の声で練習している」ナラティブが成立しない。

#### 設計要点

1. **分析プロセスの可視化**
   - 録音完了後、2〜3 秒の「分析中」演出（音声波形・抽出中の特徴量名が流れる等）。
   - 単純なローディングスピナーは不可。「何を分析しているか」が視覚的に伝わること。

2. **候補ごとの理由文表示**
   - 各候補に「なぜこの声が選ばれたか」の 1 行理由文を必ず添える。
   - 例：
     - 「あなたの低めで落ち着いたトーンに近い声」
     - 「あなたの話すテンポに近い声」
     - 「あなたの明るめの声質に近い、もう一人の候補」
   - 特徴量の寄与度（ピッチ / トーン明度 / テンポ等）からテンプレート + ルールベースで生成。

3. **選択後のフィードバック**
   - 選択確定時に「この声を、あなたの分身として覚えました」と短く肯定する。
   - 選択が「記憶された」感覚を残す。

4. **理由文の定性フィードバック回収**
   - 選択確定後に「この理由文はしっくりきましたか？」の 3 択を配置し、今後の改善材料に。

### 3.4 サジェスト UI 仕様

#### 出現タイミング（ユーザー設定）

| 設定値 | 挙動 |
|--------|------|
| `before_chat` | 会話画面に入ったとき、会話開始前にサジェスト（関連フレーズ 3 つ）を提示 |
| `during_chat` | 会話中、キャラの返答後にサジェストを提示（次のユーザー発話の助け） |
| `both` | 両方 |

#### 自動再生 ON/OFF（ユーザー設定）

| 設定値 | 挙動 |
|--------|------|
| `auto_play: true` | サジェスト表示時に分身の声で自動再生 |
| `auto_play: false` | 再生ボタン表示のみ、タップで再生 |

#### サジェスト UI 要素

- 日本語の情景/意図（「道を教えたいとき」等）
- 英語フレーズ（1〜3 個）
- 各フレーズに [ ▶ 分身の声で聞く ] ボタン
- [ このフレーズで話す ] ボタン（次発話として扱い、ID 突合に繋げる）
  - **現行 UI（音声録音専用）**：画面下部に「次に話す：〜」のヒントバナーを表示し、`pendingPrefill` として `phrase_id` を保持。直後の音声発話で `match_strategy: "id"` として `phrase_used_in_chat` を発火（Sprint 4 実装）
  - **将来（テキスト入力を追加した場合）**：会話入力欄に英文をプレフィル（MVP ではこれで十分）
- [ 保存する ] ボタン（`saved_phrases` テーブルに `source="suggest"` で保存）
- [ 閉じる ]

#### サジェスト生成ロジック

- MVP では **Claude Haiku** ベース、**`/api/suggest` 新設**（決定事項 14）。
- 入力：`persona_id`、直近の会話履歴（最新 N ターン）、（`before_chat` の場合は）キャラの設定場面。
- 出力：日本語情景 + 英語フレーズ 1〜3 個の JSON。各フレーズに `phrase_id`（サーバー側で UUID 発行）を付与。
- ルールベースのフォールバックも用意（API 障害時）。プリセット 3 フレーズを persona タイプ別に用意。

### 3.5 独立画面の仕様（分身の声で英語を聞く）

- ルート：**`/echo`**（Sprint 0 で確定、Q9 参照）。
- タブ構成：
  - **プリセット場面**：運営用意の 5〜10 個のカード一覧。タップで場面詳細（英フレーズ 3 つ + 再生 UI）
  - **保存したフレーズ**：`saved_phrases` の一覧（source 別フィルタ：全部 / プリセット / 自分 / サジェスト）
  - **検索**（任意、Sprint 後半で実装可）：フレーズ検索
- 各フレーズに共通の UI：
  - 日本語意図 + 英語フレーズ
  - [ ▶ 再生 ]（分身声）
  - [ もう一度 ]
  - [ 保存 ]（source に応じて動作差分。プリセット → `saved_phrases` 追加 / 既保存 → 解除）
  - 英訳字幕の表示/非表示
- モバイル/PC 両対応。

### 3.6 会話画面内の分身再生ボタン配置（既存 `app/app/page.tsx` 改修境界）

本節は Sprint 2/3 で既存 `app/app/page.tsx` に変更を加える際の**不可侵境界**を定義する。回帰リスク最小化のため、ジェネレーターは本節の制約下で実装すること。

#### 変更禁止（不可侵）

以下を変更・削除・差し替えしてはならない。CLAUDE.md と整合する項目。

- **`processAudioRef`**：stale closure 対策として `messages` 依存の処理を保持するための参照。構造・更新タイミング・`recorder.onstop` からの呼び出し経路を維持する。
- **`MIN_RECORDING_MS = 1500`**：Whisper hallucination 回避のための最低録音時間。
- **ブラウザ別 MIME 判定**：Chrome `audio/webm;codecs=opus` / Safari `audio/mp4` / Firefox `audio/ogg` を `MediaRecorder.isTypeSupported()` で自動判定するロジック。
- **`messages` ステート構造**：既存の型・更新粒度。
- **Whisper → Claude → ElevenLabs の呼び出し順序**：パイプラインの接続順を変えない。
- **既存のエラーハンドリング日本語メッセージ**：メッセージ文言は改善可だが、捕捉ポイントを減らしてはならない。

#### 追加可能（許可領域）

- `messages` を**読み取り専用**で参照する新規コンポーネント。
- 新規コンポーネントが持つ**独立ステート**（既存の会話ステートから切り離す）。
- 新規 API 呼び出し（`/api/suggest`、`/api/voice-session`、`/api/speak` 追加呼び出し）。
- 既存レイアウトの余白・サイドパネル領域への挿入。

#### UI 部品の配置方針

以下 3 つのコンポーネントを `components/` 配下に独立ファイルとして分離し、`app/app/page.tsx` からは propsで受け渡す。

- **`<SuggestPanel />`**：会話前 / 中に表示するサジェストパネル。`suggest_timing`・`auto_play_voice`・直近履歴を受け取り、`/api/suggest` を呼ぶ。
- **`<VoicePlayButton />`**：分身の声で再生する共通ボタン。`phrase_id`・`en_text`・`voice_id` を受け取り、`/api/speak` を呼ぶ。独立画面（Sprint 2）でも再利用する。
- **`<SavePhraseModal />`**：「これ言えなかった」起点のモーダル。ユーザー発話テキストを受け取り、英訳候補を `/api/suggest` で取得 → `saved_phrases` へ保存。

#### 具体配置

- **サジェスト内**：3.4 節参照。フレーズごとに [ ▶ 分身の声で聞く ] を配置（`<VoicePlayButton />`）。
- **ユーザー発話の横（「これ言えなかった」導線）**：
  - ユーザー発話バブルに [ これ言えなかった ] ボタンを小さく配置。
  - タップで `<SavePhraseModal />` が開く。
  - 英訳カードごとに [ ▶ 分身の声で聞く ] と [ 保存する ] を配置。
  - 保存時は `saved_phrases` に `{ ja_text, en_text, en_text_normalized, source: "user" }` で登録。
- **既存会話 UI の破壊的変更を避けるため、追加要素は既存レイアウトの余白に挿入する**。

### 3.7 技術実装アプローチ

**注意**：以下は**アプローチの方針**であり、具体的な関数名や API の細部は実装時にジェネレーターが最新ドキュメント（context7 等）で確認する。

#### 録音・特徴量抽出・マッチング

- **録音 UI**：既存の `MediaRecorder` フロー（MIME 判定ロジック）を踏襲。10〜15 秒のカウントダウン UI + 最低 8 秒チェックを追加。
- **特徴量抽出（クライアント側）**：Sprint 0 で Q8 を **B 案（最小録音 + Web Audio 直・ハイブリッド）** に確定。**`pitchfinder@^2.3`**（YIN / AMDF）で F0 推定 + Web Audio API `AnalyserNode` で RMS・スペクトル重心の最小計算。Meyda.js は採用しない（理由は 7 章 Q8）。抽出項目：
  - ピッチ中心値（F0 平均）→ `pitchfinder` で推定
  - トーン明度（スペクトル重心）→ `AnalyserNode` で計算
  - テンポ / 性別（F0 平均から自動推定）
  - 明度・テンポの微調整はユーザーがスライダーで行う（ハイブリッド）
  - 抽出完了後、**録音 Blob は即破棄**（`URL.revokeObjectURL` + 参照削除）。
- **類似度マッチング**：クライアント側で 5 次元属性タグベクトル（ピッチ / 明度 / テンポ / 性別 / 年代）のコサイン類似度を計算。上位 3 つの `{ voice_id, score, reason_text }` をステートに保持。
- **プリセット voice データ**：ElevenLabs Voice Library から事前選定した 5〜10 個の `voice_id` を JSON で静的配置（`lib/presetVoices.ts` 等）。属性タグ（ピッチ・明度・テンポ・性別・年代）を人手付与。
- **TTS**：既存 `/api/speak` を使用。リクエスト body に `voiceId` を渡す仕組みは実装済。モデル `eleven_turbo_v2_5` を継続。

#### サジェスト生成

- **`/api/suggest` 新設（Edge Runtime）**。Claude Haiku (`claude-haiku-4-5-20251001`) を利用。
- **`/api/suggest` の新設は Sprint 3 で実施する**（「これ言えなかった」モーダルが最初の利用者）。Sprint 4 ではクライアント側の会話前 / 中サジェスト UI がこの同一エンドポイントを呼ぶ。Sprint 4 でのエンドポイント新設は行わない。
- 入力（Sprint 3 最小仕様）：`{ ja_text, persona_id? }`。Sprint 4 で必要に応じて `recent_messages`・`timing` を拡張。
- 出力：`{ phrases: [{ phrase_id, ja_intent, en_text, en_text_normalized }] }`。
- API 障害時のルールベースフォールバックも Sprint 3 で実装。
- `/api/chat` への生成ロジック混入は禁止（決定事項 14）。`/api/chat` は会話返答のみ。

#### 分身の声の永続化 API

- **`POST /api/voice-session`**：`{ selected_voice_id }` を受け取り upsert（1 ユーザー 1 レコード）。`auth.uid()` が必須。
- **`GET /api/voice-session`**：ログインユーザーの `selected_voice_id` を返す。
- **RLS ポリシー**：`voice_sessions.user_id = auth.uid()` で select/insert/update/delete すべて制限。
- **ゲスト時**：localStorage に保存（`selected_voice_id`）。API は呼ばない。

#### プリセット場面データ

- JSON を `lib/presetScenes.ts` 等に静的配置（MVP では DB に入れない）。将来 Supabase の `preset_scenes` に移行可能な形で構造化。

#### DB スキーマ追加（既存破壊なし。詳細 DDL は backend が設計）

- **`voice_sessions`**
  - `id` (uuid, pk)
  - `user_id` (uuid, fk → auth.users)
  - `selected_voice_id` (text)
  - `created_at`, `updated_at`
  - **`voice_features_vector` カラムは設けない**（決定事項 5）。
  - RLS：`user_id = auth.uid()`
- **`saved_phrases`**
  - `id`, `user_id`, `ja_text`, `en_text`, **`en_text_normalized` (text, 必須)**, `source` (`"preset" | "user" | "suggest"`), `phrase_id_ref` (text, nullable：サジェスト起源の場合は元の `phrase_id`), `created_at`
  - RLS：`user_id = auth.uid()`
- **`preset_scenes`**（`id`, `ja_scene`, `en_phrases[]`, `ja_hints[]`）※運営コンテンツ、MVP では JSON でも可
- **`play_logs`**：PostHog に集約するため MVP では DB に持たない（必要になれば後続で追加）
- **`user_settings`**（既存拡張）：`suggest_timing` (`"before_chat" | "during_chat" | "both"`, default `"both"`)、`auto_play_voice` (`boolean`, default `true`)

#### ゲスト → 認証ユーザーへの移行経路

本節は evaluator 指摘 5 への対応。実装経路を明記する。

1. **Sprint 0 事前調査**：`lib/guestUsage.ts` を読解し、既存のゲスト UUID 生成・localStorage キー規約・登録時の引き継ぎフックの有無を確認する。
2. **既存フックがある場合**：そこに本 MVP 用の引き継ぎ処理（`selected_voice_id` と `saved_phrases` 相当の localStorage）を追加する。
3. **既存フックがない場合**：Supabase クライアントの `onAuthStateChange` で `SIGNED_IN` イベント時に以下を一括で実行する：
   - localStorage から `selected_voice_id` を取得 → `POST /api/voice-session` で upsert → 成功後に localStorage を削除
   - localStorage から保存フレーズ（`guest_saved_phrases` 等）を取得 → `saved_phrases` へ bulk insert → 成功後に localStorage を削除
   - 失敗時は localStorage を保持してリトライ可能にする（破壊的に削除しない）
4. **引き継ぎ完了トースト**：「あなたの分身の声と保存したフレーズを引き継ぎました」を UI に出す。

#### Edge Runtime 制約

- `fs` / `path` 等の Node.js モジュールは使用不可。
- 全 API Route に `export const runtime = "edge";` を付与。

### 3.8 UI/UX 設計の原則

- **world view**：`.claude/agents/branding.md` のトーンに合わせる。量産 SaaS 感（白背景 + 紫グラデ + 量産カード）は NG。
- **コピーの核**：「聞くだけで OK」「話さなくていい」「あなたの分身の声で慣れる」「とっさの英語に」。
- **封印ワード（既存維持）**：「AI と話そう」「チャットボット」「ロールプレイ」「最短」「No.1」「必ず」。
- **既存 UI との一貫性**：新規画面（分身作成・独立画面・設定拡張）は既存キャラ対話 UI と同じデザイン言語を使う。
- **一画面一目的**：独立画面のフレーズ再生部は「場面・フレーズ・再生ボタン」の 3 要素以外を極力置かない。
- **再生 UI**：再生ボタンは大きく、[ もう一度 ] は同サイズで隣に（再生回数 KPI を取りに行く）。
- **マッチング画面**：分析アニメーション・理由文・候補プレビューを「体験のハイライト」として丁寧に作る。
- **アクセシビリティ**：字幕の表示/非表示、音量調整、視覚のみで完結するフロー。
- **エラー**：日本語で簡潔に（「ネットワークが不安定です。もう一度試してください」等）。

### 3.9 禁止事項（実装規約）

本 MVP では以下を**実装禁止**とする：

- **既存機能（personas / conversations / chat）を削除・非表示にしない**。UI からのリンク外しも禁止。
- **DB の破壊的変更（DROP TABLE / RENAME / カラム削除等）を行わない**。追加のみ。
- **録音データを保存しない**。`File` / `Blob` / `ArrayBuffer` のいずれの形でも、サーバー・DB・ストレージ・IndexedDB・localStorage のいずれにも保存不可。
- **特徴量ベクトルを永続化しない**。マッチング計算中のメモリ上のみ保持し、完了時点で破棄。**`voice_sessions` に特徴量ベクトル用カラムは設けない**。
- **録音を外部 API（ElevenLabs / OpenAI 等）に送信しない**。特徴量抽出はブラウザ内で完結。
- **同意文言には「録音データは保存しません」「特徴量抽出後に即破棄します」を明記する**（3.10 節）。
- **`/api/chat` へサジェスト生成ロジックを混入させない**。サジェストは必ず `/api/suggest` で扱う（決定事項 14）。
- **段階番号語彙（「Step 0」「Step 1」「フェーズ 0」等の番号付き段階名）をコード・UI・イベント名・KPI 名・コミットメッセージに使用しない**。意味のある名前で指す（例：「分身の声で聞く体験」「サジェスト採用」「発話転化」）。
- **`app/app/page.tsx` の不可侵項目（3.6 節）を改変しない**。

### 3.10 同意文言（最小版・Sprint 1 前に legal-checker 確認）

MVP の最小同意文言ドラフト：

> 録音した音声データから、あなたの声の特徴（高さ・明るさ・テンポ等）を分析します。
> 録音データ自体は分析直後に破棄し、サーバーには送信しません。
> 分析結果（特徴量）も保存せず、分身の声の選択が終わった時点で削除します。

- legal-checker エージェントに Sprint 1 着手前にレビュー依頼。
- 既存の利用規約・プラポリへの追記（録音は保存しない旨）が必要かも確認。

---

## 4. 計測設計（KPI + イベント定義）

### 4.1 最重要 KPI

| KPI | 定義 | 仮説 |
|-----|------|------|
| **会話開始率**（既存 KPI 維持） | 分身の声作成完了後に会話を 1 ターン以上行った割合 | 70% 以上 |
| **分身の声再生回数 / ユーザー** | 1 ユーザーあたりの `phrase_play` 合計 | 初回セッションで 5 回以上 |
| **サジェスト採用率** | サジェスト表示時に再生 or プレフィル送信が起きた割合 | 30% 以上 |
| **再生→発話転化率**（分身再生フレーズの会話内発話率） | サジェスト or 独立画面で再生したフレーズが、その後の会話で実際にユーザー発話として送信された割合（`phrase_used_in_chat` / 対応する `phrase_play`） | 10% 以上 |

### 4.2 副次 KPI

| KPI | 定義 |
|-----|------|
| voice_matching_dropoff | 分身の声マッチング UI 途中での離脱率 |
| voice_candidate_selection_distribution | 候補 A/B/C の選ばれ方分布 |
| scene_completion_rate | 独立画面での場面完了率 |
| saved_phrase_count_per_user | `saved_phrases` への保存数 |
| guest_to_signup_rate | ゲスト制限モーダル表示 → 登録完了の割合 |
| day1_return_rate | 登録日翌日に再訪した割合 |

### 4.3 イベント定義（PostHog）

| イベント名 | プロパティ | 発火タイミング |
|-----------|-----------|---------------|
| `voice_sample_recording_started` | - | 録音開始 |
| `voice_sample_recording_completed` | `duration_ms` | 録音完了 |
| `voice_features_extracted` | `extraction_ms`, `feature_dims` | 特徴量抽出成功 |
| `voice_features_extraction_failed` | `reason` | 特徴量抽出失敗 |
| `voice_match_computed` | `top_candidate_ids`, `top_scores`, `compute_ms` | マッチング計算完了 |
| `voice_candidate_previewed` | `voice_id`, `candidate_rank` (1/2/3) | 候補試聴 |
| `voice_candidate_selected` | `voice_id`, `candidate_rank`, `time_to_select_ms` | 候補選択確定 |
| `voice_matching_dropoff` | `stage` | マッチング UI 途中離脱 |
| `voice_reason_feedback` | `voice_id`, `feedback` | 理由文 3 択フィードバック |
| `scene_selected` | `scene_id` | プリセット場面カードタップ |
| `scene_completed` | `scene_id`, `total_plays` | 場面詳細で全フレーズ再生 or 離脱直前の場面完了とみなせる状態 |
| `phrase_play` | `phrase_id`, `source` (`preset`/`saved`/`suggest`/`user`), `voice_id`, `context` (`library`/`chat`), `en_text_normalized` | フレーズ再生（最重要） |
| `phrase_replay` | `phrase_id`, `count` | 同フレーズ 2 回目以降の再生 |
| `phrase_saved_from_chat` | `ja_text_len`, `en_text_len` | 「これ言えなかった」保存完了 |
| `suggest_shown` | `timing` (`before_chat`/`during_chat`), `phrase_count` | サジェスト表示 |
| `suggest_clicked` | `timing`, `action` (`play`/`prefill`/`save`) | サジェスト内アクション |
| `chat_turn_completed` | `persona_id`, `used_suggest` (bool), `user_text_normalized` | キャラとの 1 ターン完了（突合キーとして正規化テキストを付与） |
| `phrase_used_in_chat` | `phrase_id`, `source`, `match_strategy` (`id` / `normalized_text`) | 過去再生したフレーズがユーザー発話として送信されたと判定（4.5 節） |
| `guest_limit_reached` | `trigger` | ゲスト制限モーダル表示 |
| `signup_completed_from_voice_flow` | `entry_point` (`library`/`chat`) | 分身導線経由の登録完了 |
| `voice_rematched` | - | 再マッチング実行 |
| `settings_suggest_timing_changed` | `from`, `to` | 設定変更 |
| `settings_auto_play_changed` | `from`, `to` | 設定変更 |

### 4.4 計測品質チェック

- すべてのイベントに `session_id`（ゲスト UUID）を付与。ゲスト→登録の連続性を追跡可能に。
- **特徴量ベクトル本体は PostHog に送らない**。送るのは `voice_id` と スコアまで。
- 既存の会話イベント（もし既存に定義があれば）との二重発火を避ける。
- `phrase_used_in_chat` の算出ロジックは 4.5 節の仕様で実装する。

### 4.5 `phrase_used_in_chat` の突合仕様

**目的**：分身の声で再生したフレーズが、その後の会話でユーザー発話として送信されたかを判定する（再生→発話転化率の算出に必須）。

#### 突合キー（2 段階）

1. **第一優先：`phrase_id` 直接突合**
   - サジェスト由来・独立画面のプリセット由来・保存フレーズ由来はすべて `phrase_id` を持つ。
   - 会話送信時にクライアント側で「直近 30 分以内に再生した `phrase_id` リスト」を保持し、送信テキストに対応する `phrase_id` が一意に特定できる場合はこれで突合。
   - `match_strategy: "id"` で発火。

2. **第二優先：正規化テキスト一致**
   - ユーザーが音声で話した場合（Whisper 出力と再生テキストが完全一致しない可能性）や、プレフィルを編集した場合は `phrase_id` では突合できない。
   - ユーザー送信テキストを正規化 → 直近 30 分以内に再生したフレーズの `en_text_normalized` と一致するものがあれば突合。
   - `match_strategy: "normalized_text"` で発火。

#### 正規化ルール（`normalizeEnglish(text: string) => string`）

- 小文字化
- 前後空白除去（`trim()`）
- 連続空白統合（`/\s+/g` → 1 スペース）
- 句読点除去（`.`, `,`, `?`, `!`, `;`, `:`, `"`, `'`, `"`, `"`, `'`, `'`）
- 半角/全角統一（全角英数 → 半角、全角スペース → 半角）
- 縮約形展開（`don't → do not`, `it's → it is`, `can't → can not` 等、最小辞書）

#### 保持期間

- **再生履歴（クライアント側）**：セッション内 30 分。`sessionStorage` または React state。ページリロードをまたぐ必要はない。
- **`saved_phrases.en_text_normalized`**：永続（DB 保存）。
- **`chat_turn_completed.user_text_normalized`**：PostHog イベントプロパティとして送信。DB には保存しない。

#### 実装配置

- 正規化関数は `lib/normalizeEnglish.ts`（純関数、テスト容易）。
- 再生履歴保持は `components/VoicePlayButton` 内で `sessionStorage` に `recent_played_phrases: [{ phrase_id, en_text_normalized, played_at }]` を push。
- 会話送信時に `app/app/page.tsx` が send 直前に再生履歴を読み、突合 → 一致すれば `phrase_used_in_chat` を発火。

---

## 5. ゲスト→登録の導線（フリーミアム設計）

### 5.1 ゲスト体験の最低到達ライン

ゲスト（未ログイン）のまま以下 3 点まで到達できるようにする。これが登録動機を生む最小体験である。

1. **分身の声作成**（録音 → 特徴量抽出 → 上位 3 候補から 1 つを選択 → localStorage に `selected_voice_id` 保存）
2. **最初のフレーズ再生**（独立画面のプリセット場面から 1 フレーズ以上を分身の声で再生）
3. **最初のキャラ対話 1 ターン**（キャラ選択 → 会話で 1 往復成立）

#### 原則

- 既存 `lib/guestUsage.ts` の GUEST_LIMIT 仕組みを流用する。
- **カウント対象の追加**：既存会話ターン数に加えて、`phrase_play`（独立画面 + 会話内）、`suggest_clicked`（play/prefill/save のいずれか）も同一 GUEST_LIMIT に加算。
- **登録障壁を下げる**：上記 3 点までは登録なしで到達可能にする。
- **登録の理由を体験から生む**：「続けたい」「選んだ分身の声をまた使いたい」「保存したフレーズをまた聞きたい」という感情が発生してから提示。

### 5.2 制限モーダルの要件

- タイトル：**「続きは、あなたの分身の声と一緒に。」**（marketer が最終確定）
- 本文：「選んだ分身の声・保存したフレーズ・キャラとの会話履歴を、アカウントで保存します。」
- CTA：[ メールで登録する ]（プライマリ）/ [ あとで ]（セカンダリ）
- 「あとで」押下時は再訪時に再表示。

### 5.3 登録後の継続性（実装経路明記）

ゲスト時の `selected_voice_id` と `saved_phrases` 相当のローカル情報を、登録完了時に user に紐付ける。具体経路は 3.7 節「ゲスト → 認証ユーザーへの移行経路」を参照。

- 既存 `lib/guestUsage.ts` に引き継ぎフックがある場合はそこに追加。
- 既存フックがない場合は `onAuthStateChange` の `SIGNED_IN` を起点に一括移行。
- `POST /api/voice-session` で upsert、`saved_phrases` は bulk insert。
- 成功後に対応する localStorage キーを削除、失敗時は保持してリトライ可能にする。
- 「あなたの分身の声を引き継ぎました」トースト表示。
- 既存キャラ（personas）がゲスト時点で作成済みの場合も登録に引き継ぐ（既存挙動があれば踏襲、なければこの MVP で追加しない）。

### 5.4 GUEST_LIMIT のしきい値

- Sprint 0 で **10** に確定（Q2）。既存 `lib/guestUsage.ts` の `GUEST_LIMIT = 5` を引き上げる。
- カウント対象：会話 1 往復 / 分身の声作成（ゲストは 1 回のみ・再マッチ不可）/ サジェスト採用 / 独立画面フレーズ再生 の 4 種を同一カウンタに加算。
- 上限到達時は既存の登録誘導モーダルを再利用。
- MVP リリース後 2 週間の PostHog データを見て 8〜12 の範囲で微調整可能とする。

---

## 6. スプリント分解（B-6 MVP プロト実装までの具体タスク）

**前提**：現 Next.js リポジトリ上で実装。既存機能を壊さないを最優先。モノレポ再編は C-1。

担当エージェントタグ：`[FE]` frontend / `[BE]` backend / `[INF]` infrastructure / `[ALL]` 複数関与

### Sprint 0：事前調査・前提確定 `[ALL]`

**ゴール**：Sprint 1 以降が迷わず着手できる前提情報を全て揃える。
**依存**：なし
**完了条件**（2026-04-14 全項目完了）：
- [x] `lib/guestUsage.ts` を読解：localStorage キー `vl_guest_count`、`GUEST_LIMIT = 5` の単純カウンタ。**登録時の引き継ぎフックは未実装**（Sprint 1 で `onAuthStateChange` ベース移行経路を実装、3.7 節）
- [x] ElevenLabs 月次試算：α Creator $22 / β Pro $99 / 有料化直前 Scale $330。前提と移行判断ポイントは 7 章 Q4 に明記
- [x] 独立画面のルート名確定：**`/echo`**（7 章 Q9）
- [x] プリセット voice 候補：8 枠構成確定、具体 voice は Sprint 1 着手前に Masaru が Voice Library 実物確認（7 章 Q11）
- [x] プリセット場面確定：必須 3 + 推奨 4 = **7 個**（7 章 Q1）
- [x] legal-checker 同意文言レビュー済み：パターン A（ブラウザ完結）採用、7 章 Q7 に本文。**Sprint 1 着手前に弁護士確認推奨論点**：impersonation 条項 / 景表法 / 13 歳未満扱い
- [x] Open Questions Q1〜Q11 全て 7 章に確定記載

### Sprint 1：分身の声を作る（録音 + 特徴量抽出 + マッチング + 候補選択 UI + DB + 認証 API） `[FE] [BE]`

**ゴール**：ユーザーが 10〜15 秒録音 → 特徴量抽出 → 上位 3 候補から選択 → `selected_voice_id` が保存される（認証済みは `voice_sessions`、ゲストは localStorage）。
**依存**：Sprint 0
**完了条件**：
- [ ] マイク許可 → 10〜15 秒カウントダウン付き録音 UI
- [ ] ブラウザ別 MIME 判定（Chrome `audio/webm;codecs=opus` / Safari `audio/mp4` / Firefox `audio/ogg`）が動く
- [ ] 同意チェックボックス（3.10 節の文言、legal-checker レビュー済）必須
- [ ] 最低 8 秒未満はやり直し促し
- [ ] ブラウザ内で特徴量抽出（`pitchfinder@^2.3` で F0 推定 + Web Audio API `AnalyserNode` で RMS・スペクトル重心、Meyda.js は不採用）
- [ ] 抽出直後に録音 Blob を破棄（参照削除・`revokeObjectURL`）
- [ ] プリセット voice 5〜10 個の特徴量 JSON が静的配置されている
- [ ] コサイン類似度計算で上位 3 候補を算出
- [ ] 分析中アニメーション 2〜3 秒（単純スピナー禁止）
- [ ] 候補 3 つが試聴再生できる（既存 `/api/speak` 利用、`voiceId` 渡し）
- [ ] 候補ごとに理由文 1 行（テンプレート + ルールベース）
- [ ] 1 つを選択 → 「この声を、あなたの分身として覚えました」
- [ ] 理由文 3 択フィードバック（しっくりきた / どちらでもない / しっくりこなかった）
- [ ] `voice_sessions` テーブル新設（`voice_features_vector` カラムは持たない）
- [ ] RLS ポリシー（`user_id = auth.uid()`）が効いている
- [ ] `POST /api/voice-session`（upsert）と `GET /api/voice-session`（取得）が実装されている（Edge Runtime）
- [ ] ゲスト時は localStorage に `selected_voice_id` を保存
- [ ] ゲスト → 認証ユーザーの移行経路（3.7 節）が動作（Sprint 0 で確定した経路で実装）
- [ ] 失敗時（マイク不可・無音・API 不対応等）は日本語で明示しリトライ可能
- [ ] Edge Runtime 制約遵守
- [ ] **録音データ・特徴量ベクトルが永続化されていないことをコードレビューで確認**

### Sprint 2：分身の声で英語を聞く独立画面 `[FE] [BE]`

**ゴール**：プリセット場面 5〜10 個の一覧から選び、分身の声でフレーズを繰り返し聞ける。
**依存**：Sprint 1
**完了条件**：
- [ ] プリセット場面データ 5 個以上が JSON 定義（駅で道 / トイレ / 会計 / 乗り換え / 空港荷物 等）
- [ ] 独立画面（Sprint 0 で確定したルート名）を追加
- [ ] タブ：プリセット場面 / 保存したフレーズ（Sprint 5 で中身追加）
- [ ] 場面カード一覧 → タップで場面詳細（日本語情景 + 英フレーズ 3 つ + 再生）
- [ ] [ ▶ 再生 ] タップで `selected_voice_id` を使った `/api/speak` 呼び出し → 再生
- [ ] `<VoicePlayButton />` コンポーネントとして実装（Sprint 3 以降で会話画面から再利用）
- [ ] [ もう一度 ] [ 次のフレーズ ] [ 別の場面へ ] ボタン
- [ ] 英訳字幕の表示/非表示トグル
- [ ] `phrase_play` / `phrase_replay` / `scene_selected` / `scene_completed` を発火
- [ ] モバイル/PC 両対応
- [ ] 既存機能（personas / conversations / chat）へのデグレなし
- [ ] `app/app/page.tsx` の不可侵項目（3.6 節）に変更なし

### Sprint 3：会話画面「これ言えなかった」統合 `[FE] [BE]`

**ゴール**：既存会話 UI を拡張し、「ユーザー発話 → これ言えなかった → 英訳候補 → 分身の声で再生 → 保存」が動く。
**依存**：Sprint 2
**完了条件**：
- [ ] `/api/suggest` を新設（Edge Runtime、Claude Haiku `claude-haiku-4-5-20251001` 利用）
- [ ] `/api/suggest` は最小仕様として「日本語テキストを受けて英訳候補 1〜3 個を JSON で返す」を満たす。入力 `{ ja_text, persona_id? }`、出力 `{ phrases: [{ phrase_id, ja_intent, en_text, en_text_normalized }] }`
- [ ] `/api/suggest` に API 障害時のルールベースフォールバック（プリセット 3 フレーズ）を実装
- [ ] `/api/suggest` のリクエスト/レスポンス型を `lib/` 等に型定義として切り出し、Sprint 4 での会話前/中サジェスト利用時に共用できる形にする
- [ ] `app/app/page.tsx` の 3.6 節不可侵項目に変更なし（レビューで確認）
- [ ] 「これ言えなかった」ボタンをユーザー発話バブルに追加（既存レイアウト非破壊）
- [ ] `<SavePhraseModal />` を `components/` 配下に新設
- [ ] モーダルで日本語 → 英訳候補 1〜3 個を Claude Haiku 経由で取得（上記で新設した `/api/suggest` を利用）
- [ ] 各候補に `<VoicePlayButton />`（Sprint 2 で作成）と [ 保存する ] ボタン
- [ ] 保存時に `saved_phrases` に `{ ja_text, en_text, en_text_normalized, source: "user" }` で登録
- [ ] `saved_phrases` の RLS ポリシー（`user_id = auth.uid()`）が効いている
- [ ] `phrase_saved_from_chat` 発火
- [ ] `/api/chat` にサジェスト生成ロジックが混入していないことをレビューで確認
- [ ] 既存会話フロー（Whisper → Claude → ElevenLabs）が回帰なく動く

### Sprint 4：サジェスト機能 + 突合実装 `[FE] [BE]`

**ゴール**：ユーザー設定に従って会話前 / 中にサジェストが出現し、再生→発話の突合が動く。
**依存**：Sprint 2, Sprint 3
**前提**：`/api/suggest` は **Sprint 3 で新設済み**。Sprint 4 はそれをクライアントから呼び出すのみで、エンドポイント自体の新設は行わない。
**完了条件**：
- [ ] Sprint 3 で新設済みの `/api/suggest` を会話前 / 中のサジェスト生成に利用する。必要に応じて入力項目（直近会話履歴、`timing`）を追加拡張するが、エンドポイント新設はしない
- [ ] `<SuggestPanel />` を `components/` 配下に実装
- [ ] 会話画面に `before_chat` サジェストパネル（会話開始前に表示）
- [ ] `during_chat` はキャラ返答後にサジェストを挟む
- [ ] 各フレーズに `<VoicePlayButton />` + [ このフレーズで話す ] + [ 保存する ]
- [ ] 「このフレーズで話す」は入力欄にプレフィル（MVP 仕様）
- [ ] `suggest_shown` / `suggest_clicked` を発火
- [ ] ユーザー設定（`suggest_timing`）を読む（Sprint 6 での UI 完成前は DB デフォルト `both`）
- [ ] API 障害時のルールベースフォールバック
- [ ] 正規化関数 `lib/normalizeEnglish.ts` を実装（4.5 節の仕様）
- [ ] `<VoicePlayButton />` 内で再生時に `sessionStorage` の `recent_played_phrases` に push（phrase_id + en_text_normalized + played_at）
- [ ] 会話送信時に `app/app/page.tsx` が再生履歴と突合して `phrase_used_in_chat` を発火（`match_strategy` 付き、3.6 節の不可侵項目は維持）
- [ ] `chat_turn_completed` に `user_text_normalized` プロパティを付与
- [ ] `/api/chat` にサジェスト生成ロジックが混入していないことをレビューで確認

### Sprint 5：保存フレーズ一覧 `[FE] [BE]`

**ゴール**：`saved_phrases` が独立画面の「保存したフレーズ」タブで閲覧・再生・削除できる。
**依存**：Sprint 4
**完了条件**：
- [ ] 独立画面の「保存したフレーズ」タブが機能
- [ ] source 別フィルタ（全部 / プリセット / 自分 / サジェスト）
- [ ] 再生 UI（`<VoicePlayButton />` 再利用）
- [ ] 削除操作（RLS 下で動作）
- [ ] プリセット場面 → 保存も動く（`source: "preset"` でコピー保存。保存時に `normalizeEnglish` を呼んで `en_text_normalized` を同時保存）
- [ ] サジェストからの保存（Sprint 4 の導線）の受け皿が完成
- [ ] 保存一覧からの再生も `recent_played_phrases` に記録され、突合対象に入る

### Sprint 6：ユーザー設定拡張 `[FE] [BE]`

**ゴール**：設定画面からサジェストタイミングと自動再生 ON/OFF を切り替えられる。分身の声を再マッチングできる。
**依存**：Sprint 5
**完了条件**：
- [ ] `app/settings/*` に以下のセクションを追加（既存 UI 非破壊）：
  - [ ] サジェストタイミング（ラジオ：`before_chat` / `during_chat` / `both`）
  - [ ] サジェスト時の自動再生（トグル）
  - [ ] 分身の声を選び直す（Sprint 1 のマッチングフローを再利用）
- [ ] 変更が即反映される（会話画面リロード不要 or リロードで反映）
- [ ] `settings_suggest_timing_changed` / `settings_auto_play_changed` / `voice_rematched` を発火
- [ ] 既存設定項目への回帰なし

### Sprint 7：計測（PostHog イベント実装 + KPI ダッシュボード） `[FE] [INF]`

**ゴール**：4.3 節の全イベントが PostHog に届き、4.1 節の KPI が見える。
**依存**：Sprint 6
**完了条件**：
- [ ] 4.3 節の全イベントを実装・発火
- [ ] `session_id`（ゲスト UUID）を全イベントに付与
- [ ] PostHog ダッシュボードで 4.1 節の主要 KPI を表示
- [ ] 特徴量ベクトル本体がイベントに含まれていないことを確認
- [ ] 4.5 節「再生→発話転化率」の算出が PostHog 上で可能（`phrase_used_in_chat` / 対応する `phrase_play`）
- [ ] `match_strategy` の分布（`id` vs `normalized_text`）が可視化されている（第一優先が優勢であることを確認）

### Sprint 8：QA + 評価（エバリュエーター合格までループ） `[ALL]`

**ゴール**：評価エージェントが「既存キャラ対話 + 分身の声 + サジェストの統合体験を問題なく完走できる」と判定する。
**依存**：Sprint 7
**完了条件**：
- [ ] Chrome（`audio/webm;codecs=opus`）/ Safari（`audio/mp4`）/ Firefox（`audio/ogg`）で全フロー通し動作。ブラウザ別録音フォーマット回帰なしを明示確認
- [ ] モバイル（iOS Safari / Android Chrome）で主要フロー到達
- [ ] ネットワーク切断時のリトライ動作
- [ ] エラーメッセージが全て日本語
- [ ] Edge Runtime 制約違反なし
- [ ] 録音データ・特徴量ベクトルが永続化されていないことを再確認（`voice_sessions` のスキーマも目視確認）
- [ ] **既存機能（personas / conversations / chat）の回帰なし**（回帰テスト項目を別途明記）
- [ ] `app/app/page.tsx` の 3.6 節不可侵項目に変更なしを最終確認
- [ ] `/api/chat` にサジェスト生成ロジックが混入していないことを再確認
- [ ] 段階番号語彙（Step 0/1 等）がコード・UI・イベント名・KPI 名に残っていないことを全文検索で確認
- [ ] `pnpm check` `pnpm build` 通過
- [ ] エバリュエーター合格判定

### 依存関係図

```
Sprint 0 ──▶ Sprint 1 ──▶ Sprint 2 ──▶ Sprint 3 ──▶ Sprint 4 ──▶ Sprint 5 ──▶ Sprint 6 ──▶ Sprint 7 ──▶ Sprint 8
```

- 全スプリント直列。並行実施は行わない（不可侵境界の違反リスク・突合仕様の前後依存を考慮）
- Sprint 0 が起点（既存コード読解・Q1〜Q11 回答が全ての前提、2026-04-14 完了）
- **Sprint 3 で `/api/suggest` を新設完了していることが Sprint 4 の必須前提**。Sprint 4 ではエンドポイントの新設は行わず、クライアント側（`<SuggestPanel />`）から呼び出すのみ。
- Sprint 4 は Sprint 2（`<VoicePlayButton />` 実装）と Sprint 3（`<SavePhraseModal />` 実装と `/api/suggest` 新設完了）に依存
- Sprint 8（QA）は Sprint 7 まで全完了後

### 粒度の目安

- 各スプリント 1〜3 日で完了する単位
- Sprint 0 は 0.5〜1 日（調査中心）
- Sprint 1 は最大（録音 + 抽出 + マッチング + UI + DB + 認証 API + ゲスト移行）なので 3 日想定
- Sprint 4 は突合実装を含むため 2〜3 日想定
- Sprint 8（QA）は合格までループで変動

---

## 7. Sprint 0 決定事項（確定済み・2026-04-14）

Sprint 0 で Open Questions Q1〜Q11 の回答を全て確定した。以下は Sprint 1 以降のジェネレーター・エバリュエーターが参照する確定仕様。

### Q1. プリセット場面（確定：7 個）

MVP リリース時のプリセット場面は以下 7 個。各場面は (a) 場面名 (b) シチュエーション (c) 典型フレーズ 2〜3 個 (d) ユーザー感情 を `lib/presetScenes.ts` に静的 JSON で保持する。

**必須 3 個（ローンチ時最優先）**
1. **駅で道を聞かれる**：観光客への道案内で詰まる。`"Go straight and turn left at the corner."` / `"It's about a 5-minute walk."` / `"You'll see it on your right."`
2. **トイレの場所を教える**：店内で聞かれて上階を案内できない。`"The restroom is upstairs."` / `"Go up these stairs, it's on the second floor."` / `"It's at the back on the left."`
3. **会計・支払いのやりとり**：レジで「カードで」「袋不要」「領収書ください」。`"Card, please."` / `"I don't need a bag."` / `"Can I have a receipt?"`

**推奨 4 個（ローンチ時同梱）**
4. **電車の乗り換え案内**：路線・乗換駅が言えない。`"Change at Shibuya and take the Yamanote Line."` / `"It's two stops from here."` / `"The next train comes in 3 minutes."`
5. **空港で荷物・入国**：手荷物・席希望・入国審査。`"I'd like a window seat."` / `"I'm here for sightseeing."` / `"Just this carry-on."`
6. **カフェ・レストラン注文**：持ち帰り・アイス・抜き指示。`"For here, please."` / `"Iced, not hot."` / `"No milk, thanks."`
7. **道で話しかけられた雑談**：短い返しが続かない。`"Is this your first time in Japan?"` / `"Where are you from?"` / `"How long are you staying?"`

**オプション 3 個（将来追加検討）**：ホテルトラブル / 体調・薬局 / 仕事自己紹介

### Q2. ゲスト制限しきい値（確定：統合カウント 10）

`lib/guestUsage.ts` の `GUEST_LIMIT = 5` を **10** に引き上げ、以下 4 種のイベントを同一カウンタに加算する。

| イベント | カウント |
|---|---|
| 会話 1 往復（ユーザー発話 → AI 返答） | +1 |
| 分身の声作成（候補選択完了時） | +1（ゲストは 1 回のみ、再マッチ不可） |
| サジェスト採用（クリック or 自動再生） | +1 |
| 独立画面フレーズ再生 | +1 |

**上限到達時の挙動**：登録画面への誘導モーダル表示（既存 UX を流用）。

**理由**：5.1 節の最低到達 3 点（分身声 1 + フレーズ再生 1 + 対話 1 往復）に「価値を実感する余裕」を足した値。既存 5 のままでは新イベント加算後に最低到達すら困難になる。

### Q3. サジェスト生成方式（確定：Claude Haiku + ルールフォールバック）

- **メイン**：Claude Haiku（`claude-haiku-4-5-20251001`）で persona × 直近会話履歴 × 場面 から動的生成。`/api/suggest` 専用（`/api/chat` 混入禁止）。
- **フォールバック**：Haiku API 障害時はプリセット場面に紐づく 3 フレーズ（静的 JSON）を返す。
- **レイテンシ目標**：`before_chat` は会話入場時に隠蔽、`during_chat` は `stream: true` で初期トークン 300ms 以内。
- **3 系統の統合**：`saved_phrases.source = "preset" | "user" | "suggest"` でタグ付け。サジェスト由来は `phrase_id_ref` に `/api/suggest` の `phrase_id` を保持。

### Q4. ElevenLabs 課金プラン（確定：段階的移行）

前提：1 アクティブユーザー / 日 ≒ 1,546 文字（会話 864 + 独立画面 480 + サジェスト 202、自動再生 70%）。

| 段階 | DAU | 月次文字数 | プラン | 月額実質 |
|---|---|---|---|---|
| α 期 | 5 | 約 155k | **Creator** | $22（初月 $11）→ 超過込み $38.5 |
| β 期 | 30 | 約 927k | **Pro** | $99 → 超過込み $201.5 |
| 有料化直前 | 100 | 約 3.09M | **Scale** | $330 → 超過込み $526 |

**移行判断ポイント**：
- Creator → Pro：**DAU 3 到達 or 月次文字数 80k 到達**で事前移行（超過単価より上位プラン月額が安くなる分岐点）
- Pro → Scale：月次文字数残 20%（400k 到達）or DAU 60
- Scale → Business：DAU 150 or 月次 3M 超過の定常化

**サジェスト自動再生**：既定 **ON**（`user_settings.auto_play_voice = true`）。OFF にするとβ期月次は約 790k まで下がり Pro 内に収まるため、ユーザー設定で変更可能とする。

**voice slot**：Voice Library 使用は slot 消費 0（公式 Help 明記）のため全段階で制約なし。

### Q5. `phrase_used_in_chat` の突合仕様（確定済・4.5 節に本体）

- 2 段階キー（`phrase_id` 直接突合 / 正規化テキスト一致）で判定。
- 縮約形展開辞書 MVP 初期語彙：`don't`, `it's`, `can't`, `I'm`, `you're`, `they're`, `won't`, `isn't`, `doesn't`。

### Q6. サジェスト API の実装方式（確定：`/api/suggest` 新設）

- `/api/chat` 拡張ではなく `/api/suggest` を新設（決定事項 14）。
- レート制限：同一 `persona_id` + 直近 3 メッセージハッシュでの重複生成を 60 秒抑制。

### Q7. 法務同意文言（確定：パターン A・ブラウザ完結）

Q8 の B 案（ブラウザ完結）採用により、同意文言はパターン A を使用。分身の声作成画面の録音ボタン直前に以下を表示し、チェックボックス必須とする。

> **「分身の声」を作る前に、ご確認ください**
>
> これからマイクで 10〜30 秒ほどのあなたの声を録音します。録音された音声と、そこから計算される声の特徴データは、**すべてあなたのブラウザ内だけで処理され、当サービスのサーバーには一切送信されません**。ブラウザを閉じた時点で、録音データも特徴データも消えます。
>
> 作成される「分身の声」は、あなたの声を複製・合成したものではありません。ElevenLabs 社が提供する公開音声ライブラリの中から、あなたの声と似た特徴を持つ**別の人の声**を候補としてお見せするものです。類似度はあくまで推定であり、完全一致を保証するものではありません。
>
> 保存されるのは、あなたが選んだ候補の識別番号（voice_id）のみです。あなたの声そのもの、および声の特徴データは当サービスのどこにも残りません。
>
> 同意を取り消したい場合は、マイページの「分身の声を削除」からいつでも選択した voice_id を削除できます。

**Sprint 1 着手前の弁護士確認推奨論点**：ElevenLabs 規約の impersonation 条項との整合 / 景品表示法上の優良誤認リスク（「別の人の声」の強調表現） / 13 歳未満保護者同意の扱い。

### Q8. 特徴量抽出の実装場所（確定：B 案・最小録音 + Web Audio 直）

**採用**：**ブラウザ完結のハイブリッド方式**。Meyda.js は採用しない。

- **ライブラリ**：`pitchfinder@^2.3`（YIN / AMDF で F0 推定）+ Web Audio API の `AnalyserNode`（RMS・スペクトル重心の最小計算）
- **フロー**：10〜15 秒録音 → `decodeAudioData` → `pitchfinder` で F0 推定 → 性別・ピッチ帯を自動推定 → **ユーザーが明度/テンポを 2 軸スライダーで微調整** → 属性タグベクトル（5 次元：ピッチ / 明度 / テンポ / 性別 / 年代）で `lib/presetVoices.ts` とコサイン類似度 → 上位 3 候補提示
- **Meyda.js を採用しなかった理由**：(1) ElevenLabs voice 側の埋め込みベクトルが非公開のため手動属性タグへ揃える必要があり、高次元特徴量はオーバースペック (2) Meyda は楽曲解析向けで話者類似度の標準手法（x-vector / ECAPA-TDNN）ではない (3) v5 系のメンテナンス頻度が低下
- **データフロー**：録音 Blob → 特徴量計算（全てメモリ上）→ 属性ベクトル 5 次元のみ state 保持 → ユーザー選択後 `POST /api/voice-session { selected_voice_id }` で voice_id のみ送信。Blob・特徴量ベクトルは `URL.revokeObjectURL` + 変数 null 化で破棄
- **フォールバック**：`pitchfinder` 初期化失敗時は属性タグを手動選択する簡易 UI（性別 × ピッチ 2 軸）で代替

### Q9. 独立画面のルート名（確定：`/echo`）

- **採用パス**：`/echo`
- **日本語呼び方**：「エコー」「こだま」
- **理由**：`personas`（他者）/ `conversations`（対話）と並んだとき、`echo` は「自分の声の反響」という独立画面固有の体験を短く象徴できる。量産 SaaS 的でなく、ブランド世界観（驚きの入り口）と整合。`/my-voice` は機能記述的すぎ（本実装は類似マッチであり「自分の声」ではない）、`/mirror` はキャラ対話と意味が重複、`/voice-lab` はプロダクト名と重複してナビ内で浮く。

### Q10. 分身の声の再マッチング頻度制限（確定：無料 1 日 3 回・月 10 回）

| 対象 | 1 日上限 | 月上限 | クールダウン |
|---|---|---|---|
| ゲスト | **1 回のみ**（Q2 でゲストは分身声作成 1 回） | 同左 | — |
| 無料登録ユーザー | **3 回** | **10 回** | **60 秒** |
| 課金ユーザー | 実質無制限（1 日 30 回ソフトキャップ） | — | 30 秒 |

**理由**：1 回 ≒ 180 文字消費（候補 3 × 60 文字）× 10 回/月 = 1,800 文字 / ユーザー。DAU 50 想定で月 90k 文字 → Creator（100k）内に収まる。3 回/日あれば「やり直したい」欲求をほぼ満たせる。

**エンフォース場所**：クライアント（即座のフィードバック）+ `/api/voice-session` 側で最終検証。

### Q11. プリセット voice 選定（確定：8 枠構成・具体 voice は Sprint 1 着手前に Masaru が Voice Library 実物確認）

**8 枠構成**

| 枠 | 性別 | 年齢帯 | トーン |
|---|---|---|---|
| A | 男性 | 20 代前半 | 明るめ・やや高め |
| B | 男性 | 30 代 | 落ち着き・中低域 |
| C | 男性 | 40〜50 代 | 落ち着き・低め・温度感あり |
| D | 女性 | 20 代前半 | 明るめ・柔らかい |
| E | 女性 | 30 代 | 中音域・落ち着き |
| F | 女性 | 40〜50 代 | 温度感あり・中低域 |
| G | 中性的 | 20〜30 代 | フラット・中音域 |
| H | 中性的 | 30〜40 代 | クール・知的 |

**選定基準**（Voice Library 実物確認時のチェック項目）
1. 日本人話者が「自分に近い」と感じやすい（過度に演劇的・癖が強すぎない・子音が立ちすぎない）
2. 英語発音は**中庸**（強いアメリカ/イギリス訛りを避け、国際英語寄りの明瞭さ）
3. ブランド世界観との整合（やさしい・寄り添う・量産 SaaS 的でない）
4. TTS 品質（`eleven_turbo_v2_5` で 5〜15 単語が破綻なく再生される）
5. 5 軸（ピッチ / 明度 / テンポ / 性別 / 年代）で**分散**が確保される組み合わせ

**避ける voice**：ElevenLabs デフォルト枠（Bella / Adam / Rachel / Antoni 等）は量産 SaaS でよく聞く声のためブランド差別化の観点で避けるか少数に留める。

**属性タグ付け**：選定後、Claude 協力で短い発話サンプルから 5 次元ベクトルを人手測定して `lib/presetVoices.ts` に JSON 化。

---

## 8. スコープアウト（再掲・MVP に入れないもの）

| 項目 | 担当フェーズ |
|------|-------------|
| ユーザー自身の声クローン（IVC / PVC） | 将来検討（ElevenLabs の設計変更 or 他 TTS 検討後） |
| 真似録音 + 比較再生 | 次期 MVP |
| 発音スコアリング | 実装しない（ブランド方針） |
| マイページ・達成度ダッシュボード | B-8 |
| 多言語展開 | G-1 |
| 決済・Stripe | D フェーズ |
| モバイルアプリ | 後続 |
| 複数分身声のストック・切替 | 後続 |
| 特徴量ベクトルの永続保存 | 実装しない（方針不変） |
| `voice_features_vector` DB カラム | 設けない（決定事項 5） |
| モノレポ再編 | C-1 |
| Hono / Workers 移行 | C-1 / C-2 |
| Terraform インフラコード化 | A-6 |
| voice confrontation 対策（生声フィルタ等） | 原理的に不要 |
| Claude Haiku サジェストの高度なパーソナライズ | 後続（MVP は persona + 直近会話履歴のみ） |

---

## 9. 完了条件（本 MVP 全体の "done" の定義）

以下がすべて満たされた時点で MVP 完了とする：

1. **既存機能が回帰なく動作する**。LP・Supabase Auth・キャラ作成/選択/会話（personas / conversations / chat）・既存設定・既存 API Route（`chat` / `speak` / `transcribe`）がすべて壊れていない。
2. **`app/app/page.tsx` の 3.6 節不可侵項目に変更がない**（`processAudioRef` / `MIN_RECORDING_MS` / ブラウザ別 MIME 判定 / `messages` ステート / Whisper→Claude→ElevenLabs 呼び出し順序）。
3. 分身の声作成フローが完走できる（録音 → 特徴量抽出 → 上位 3 候補提示 → 1 つを選択 → `voice_sessions` or localStorage に保存）。
4. `POST/GET /api/voice-session` に RLS（`user_id = auth.uid()`）が効いている。
5. ゲスト → 認証ユーザーへの移行経路（3.7 節）が動作し、`selected_voice_id` と `saved_phrases` が引き継がれる。
6. 分身の声で英語フレーズを**独立画面**から再生できる。
7. 分身の声で英語フレーズを**会話画面内**から再生できる（サジェスト起点 + 「これ言えなかった」起点の両方）。
8. サジェストが会話前 / 中に出現し、ユーザー設定（タイミング・自動再生）が機能する。サジェストは `/api/suggest` で生成されており、`/api/chat` にロジック混入がない。
9. 会話中「これ言えなかった」を保存し、独立画面の「保存したフレーズ」タブで再生できる。`saved_phrases` に RLS が効いている。
10. 録音データ・特徴量ベクトルがサーバー・DB・永続ストレージに一切保存されていないことをコードレビューで確認。`voice_sessions` スキーマに特徴量カラムがない。
11. 計測イベントが PostHog に届き、4.1 節の主要 KPI（特に「再生→発話転化率」）が取得できる。`phrase_used_in_chat` が 4.5 節の 2 段階キーで発火している。
12. Chrome（`audio/webm;codecs=opus`）/ Safari（`audio/mp4`）/ Firefox（`audio/ogg`）/ モバイル Safari / モバイル Chrome で動作確認済み。
13. 段階番号語彙（「Step 0」「Step 1」等）がコード・UI・イベント名・KPI 名に残っていない（全文検索で確認）。
14. エバリュエーターの合格判定（ハーネスパターン）。
15. 差別化 5 点セット（**分身の声（録音分析に基づく）× とっさの場面 × 心理ハードル × 既存キャラ対話との接続 × 日本語ペルソナ**）を 1 つも欠いていない。

---

## 10. 本仕様書の使い方

- **B-6（MVP プロト実装）のジェネレーター**：Sprint 0 から順に着手。各スプリントの「完了条件」をチェックリストとして使う。既存機能を**絶対に壊さない**を最優先。3.6 節の不可侵境界を必ず守る。
- **エバリュエーター**：9 章の 15 項目でセルフレビュー不可・必ず実機操作で確認。特に項目 1・2（既存機能の回帰なし・`app/app/page.tsx` の不可侵）と項目 10（録音・特徴量の非保存）はコードパスを追って検証。項目 13（段階番号語彙残滓）は全文検索必須。
- **marketer / branding / legal-checker**：各 Open Question に回答する役割。Sprint 0 着手前に 7 章を必ず読む。
- **変更時の不可侵事項**：
  - 既存 `personas` / `conversations` / `chat` ルートの削除・非表示提案は禁止
  - DB の破壊的変更（DROP TABLE / カラム削除 / RENAME）は禁止
  - 録音データ・特徴量ベクトルの永続保存は禁止
  - `voice_sessions` に特徴量ベクトル用カラムを新設する提案は禁止
  - `app/app/page.tsx` の 3.6 節不可侵項目（`processAudioRef` / `MIN_RECORDING_MS` / MIME 判定 / `messages` 構造 / パイプライン順序）の改変は禁止
  - `/api/chat` へのサジェスト生成ロジック混入は禁止（サジェストは `/api/suggest` 専用）
  - 差別化 5 点セット（分身の声 × とっさ × 心理ハードル × 既存対話接続 × 日本語）を欠落させる変更は禁止
  - 単体スコープ（既存キャラ対話を外す構成）への回帰は禁止
  - **段階番号語彙（「Step 0」「Step 1」「フェーズ 0」等の番号付き段階名）をコード・UI・イベント名・KPI 名・ドキュメントに使用することは禁止**
- **書き換え発生時**：`docs/competitor-research.md` のピボット注記・memory `project_b2_pivot.md` および `project_current_implementation_vs_mvp.md` との整合を崩さないこと。
