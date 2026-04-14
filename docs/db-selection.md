# DB 選定（D1 / Turso / Neon / Supabase）

**対象**：Phase 2 以降の Cloudflare Workers（Hono）バックエンド
**作成日**：2026-04-14
**前提ドキュメント**：`current-implementation.md` / `fe-be-boundary.md`

---

## 1. 要件の整理

### 必須要件（現状＋近い将来で確実に必要）
- `personas` / `conversations` / `messages` / `message_feedback`（現状スキーマ、シンプルな FK＋cascade）
- RLS またはそれ相当のアクセス制御（ユーザーは自分のデータのみ読み書き）
- Supabase Auth との連携（JWT 検証／ユーザー ID 紐付け）
- Cloudflare Workers（Hono）から低レイテンシでアクセス可能
- 音声メタデータの保存（B-5, A-5 で追加予定）
- 使用回数管理テーブル（D-1 で追加予定）
- Stripe サブスクリプション状態テーブル（D-4 で追加予定）

### あると良い要件
- マイグレーション管理（Supabase CLI のような仕組み）
- ダッシュボードでのクエリ／データ確認
- 全文検索（将来：会話履歴検索）
- ベクトル検索（将来：類似会話サジェスト）
- バックアップ・Point-in-time リカバリ

### 非要件（今は必要ない）
- ストアドプロシージャ
- 大規模分析クエリ
- 高同時書き込み性能

---

## 2. 候補の比較

| 項目 | **Supabase**（現状） | **D1** | **Turso** | **Neon** |
|------|---|---|---|---|
| 種類 | Postgres（マネージド） | SQLite（Cloudflare 純正） | libSQL（SQLite派生） | Postgres（サーバーレス） |
| Workers からの接続 | `@supabase/supabase-js`（REST） | `env.DB` バインディング（直接） | HTTP / libSQL client | Hyperdrive 経由 or HTTP API |
| レイテンシ | 中（REST 経由） | 低（同一プラットフォーム） | 低（エッジレプリカ） | 中〜低（Hyperdrive プーリング前提） |
| 無料枠 | 500MB DB / 1GB Storage / 2 プロジェクト | 5GB / 5 million reads・100k writes 日次 | 8GB / 10億 rows 読み / 2500万 rows 書き 月次 | 0.5GB / 190 時間 compute |
| Auth 統合 | **Supabase Auth（標準）** | 別途必要（Clerk / Better-Auth 等） | 別途必要 | 別途必要 |
| RLS | **ネイティブ対応（ポリシー SQL）** | なし（アプリ層で実装） | なし（アプリ層で実装） | ネイティブ対応 |
| マイグレーション | `supabase/migrations/*.sql` | `wrangler d1 migrations` | Turso CLI | Neon CLI / Drizzle |
| Storage（音声ファイル） | **Supabase Storage（統合）** | なし（R2 併用） | なし（R2 併用） | なし（R2 併用） |
| Stripe Webhook | テーブルで管理、問題なし | テーブルで管理、問題なし | テーブルで管理、問題なし | テーブルで管理、問題なし |
| ロックイン度 | 中（Postgres 標準 SQL＋Auth） | 高（Cloudflare 専用） | 低〜中（SQLite 互換） | 低（Postgres 標準） |
| ダッシュボード | 良（Studio） | 簡素 | 良 | 良 |
| バックアップ | 有料プラン | 手動 / 自動（制限あり） | Point-in-time あり | 有料プラン |
| 既存 Supabase 資産の継承 | ◎（そのまま） | 移行必要 | 移行必要（Postgres→SQLite 方言差） | 移行容易（Postgres→Postgres） |
| 移行コスト | ゼロ | 高（Auth も移行／RLS 書き換え） | 高（Auth 移行／RLS 書き換え） | 中（Auth 移行／RLS は移植可） |

---

## 3. 決定的な論点

### 論点 1：**Supabase Auth をどうするか**
現在 `middleware.ts` と 5 本の API で Supabase Auth（`getUser()`）に依存している。
D1 / Turso / Neon に DB だけ移しても、**Auth を別サービスに切り替えないなら Supabase の契約は継続**することになる。それなら DB も Supabase に残すのが自然。

→ **Auth ごと剥がさない限り、Supabase を離れる経済的メリットは薄い。**

### 論点 2：**Workers からの接続レイテンシ**
Cloudflare Workers から Supabase（US 拠点）への REST 呼び出しは **50〜200ms** 程度（リージョン次第）。
D1 は同一プラットフォームなので **5〜30ms**。
ただし本サービスのボトルネックは **Whisper（2〜5秒）／ Claude（1〜3秒）／ ElevenLabs（0.5〜2秒）** 側であり、**DB の 100ms 差はユーザー体験にほぼ影響しない**。

→ **レイテンシは選定の決め手にならない。**

### 論点 3：**RLS を自前で書くコスト**
D1 / Turso には RLS がない。現状の 4 つのポリシー（auth.uid() 比較）を全部 Hono ミドルウェアや Drizzle で書き直す必要がある。
テーブルが増えるごとに抜け漏れリスクが増える。

→ **RLS が使える Supabase / Neon が有利。**

### 論点 4：**音声ストレージ（A-5 連携）**
音声ファイル保存は確実に必要。**Supabase Storage** は RLS が Storage にも効き、FE から署名付き URL を取りやすい。
D1 / Turso / Neon では **R2 を別途使う**ことになり、権限管理を自前で書く。

→ **Storage 統合の Supabase が楽。**

---

## 4. 推奨：**Supabase 継続**

### 理由
1. 現状のスキーマ・RLS・Auth がそのまま使える（移行コストゼロ）
2. Auth を剥がすコスト／リスクが大きい
3. DB レイテンシは体感ボトルネックにならない
4. 音声ストレージ（A-5）で Storage 統合のメリットが効く
5. マイグレーションが SQL ベースで、Cloudflare 環境非依存

### ただし注意すべき点
- **無料枠 500MB** は音声メタ＋履歴が増えると早期に超える可能性
  - 音声バイナリは Storage（1GB 無料）または R2 に置き、DB には URL／メタだけ保存する方針で回避
- **Workers から supabase-js を使う**：`@supabase/supabase-js` は fetch ベースで Workers 互換
- **Postgres の pooler / Hyperdrive は現時点で不要**（REST 経由なので）
- **バックアップは Pro プラン以降**：収益化後に有料プランへの移行を計画

---

## 5. 将来の見直し条件

以下のいずれかが起きたら再評価する：

| トリガー | 候補 |
|---------|------|
| Supabase 料金が月額 $100 を超える | Neon（Postgres 互換で移行容易） |
| 読み取りレイテンシがユーザー体験を損なう（計測値で判断） | Turso（エッジレプリカ） |
| 使用回数カウンタ等の**高頻度・軽量な書き込み**だけ切り出したい | D1 を**部分採用**（メイン DB は Supabase のまま） |
| ベクトル検索が必要になる | Supabase pgvector を有効化 |

---

## 6. 次のアクション（後続タスクへの引き渡し）

| やること | 委ねる先 |
|---------|---------|
| Workers から `@supabase/supabase-js` で接続する実装パターン | C-1 / C-2 |
| 音声ストレージを Supabase Storage にするか R2 にするか | A-5 |
| 使用回数管理テーブルのスキーマ設計 | D-1 |
| Stripe サブスクリプション状態テーブルのスキーマ設計 | D-4 |
| 有料プラン移行タイミング（500MB 超える前） | D-3 |

---

## 7. 結論（1行）

> **Supabase を継続する。**DB・Auth・Storage の統合価値が移行コストを上回る。将来の個別課題（使用回数の高頻度書き込み等）は D1 を部分併用する形で柔軟に対応する。
