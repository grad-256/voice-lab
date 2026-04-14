# Terraform × Cloudflare 検証

**対象**：Phase 2 以降の IaC 化
**作成日**：2026-04-14
**結論先出し**：**採用する。ただし Phase 2 移行のタイミングで導入**（今は過剰）

---

## 1. 目的

- Cloudflare 上の FE（Pages）/ BE（Workers）/ R2 / DNS / Secrets を **コードで宣言し、再現・履歴・レビュー可能にする**
- 本番 / プレビュー環境の差分を明示し、手作業ミスを減らす
- 将来的に複数サービス（UCLab 系）を同じ構成で横展開しやすくする

---

## 2. 管理対象の分類

### ✅ Terraform で管理する（Cloudflare）

| リソース | Terraform resource | 備考 |
|---------|-------------------|------|
| Pages プロジェクト | `cloudflare_pages_project` | FE 本体 |
| Workers スクリプト | `cloudflare_workers_script` | BE（Hono）本体 |
| Workers Routes | `cloudflare_workers_route` | カスタムドメイン紐付け |
| R2 バケット | `cloudflare_r2_bucket` | 音声ストレージ（移行後） |
| DNS レコード | `cloudflare_record` | ルート・API サブドメイン |
| カスタムドメイン | `cloudflare_pages_domain` | `myvoicelab.com` |
| Secrets（Workers） | `cloudflare_workers_secret` | API Key 群 |
| Zone 設定 | `cloudflare_zone_settings_override` | SSL/TLS・キャッシュ |
| Rate Limiting | `cloudflare_ruleset` | BE の保護（D-1 と連動） |

### ⚠️ Terraform で管理**しない**（Dashboard 運用継続）

| 項目 | 理由 |
|------|------|
| Pages の GitHub 連携（ビルド設定） | Dashboard UI 経由の OAuth が絡む。TF で触ると壊れやすい |
| Analytics ダッシュボード | 表示設定は Terraform の価値が低い |
| Access / Email Routing の高度な機能 | 導入後に検討 |

### 🚫 Terraform で管理**できない**

| 項目 | 代替 |
|------|------|
| Supabase プロジェクト | 公式 Terraform provider なし。`supabase/config.toml` + `supabase/migrations` の CLI 管理を継続 |
| Supabase RLS / Storage ポリシー | SQL マイグレーションで管理 |
| Stripe 商品・価格 | `stripe-cli` / Stripe Dashboard（D-4 で検討） |

---

## 3. Cloudflare Terraform Provider の対応状況（2026-04 時点、Cloudflare 公式 MCP で確認済み）

- **公式 provider**：`cloudflare/cloudflare`
  - **v5 が GA**（2025-02-03）、**OpenAPI スキーマから自動生成される新世代 provider**
  - **最新：v5.16.0**（2026-01-20）、2〜3 週サイクルで継続リリース
  - 2026 年 3 月末までに **主要リソースの大半が stable 化予定**（dns_record / list / load_balancer 等は既に stable）
  - v4 → v5 は breaking changes あり。[upgrade guide](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/guides/version-5-upgrade) に従う。**新規導入なら v5 を直接採用**
- **カバー範囲**：Pages / Workers / R2 / D1 / KV / Queues / Zero Trust / DNS / WAF / Rate Limit がほぼ全部管理可能。v5 は v4 より **リソース数 +25%、API プロパティ 100% カバー**
- **制約**：
  - Pages の GitHub 連携ビルド設定は `cloudflare_pages_project` で対応するが、**初回は Dashboard で OAuth 認可**が必要
  - Workers の secrets は `cloudflare_workers_secret` で管理できるが、**state に平文で出ない**よう注意（sensitive マーク＋ state 暗号化）
  - v5 系は急速に改善中のため、**導入時点での stable リソース一覧**は [公式 stabilization issue](https://github.com/cloudflare/terraform-provider-cloudflare/issues/6237) を必ず確認する

---

## 4. 構成案（Phase 2 導入時の想定）

```
infra/
├── terraform/
│   ├── main.tf              # provider・backend 設定
│   ├── variables.tf         # 変数定義
│   ├── pages.tf             # FE Pages プロジェクト
│   ├── workers.tf           # BE Workers スクリプト・ルート
│   ├── r2.tf                # 音声ストレージバケット
│   ├── dns.tf               # DNS レコード
│   ├── secrets.tf           # Workers Secrets（TF_VAR_ 経由）
│   ├── rate-limit.tf        # BE 保護ルール
│   └── environments/
│       ├── production.tfvars
│       └── preview.tfvars
└── scripts/
    └── deploy-workers.sh    # ビルド成果物を workers_script に流し込む
```

### サンプル：Pages 定義（抜粋）
```hcl
resource "cloudflare_pages_project" "fe" {
  account_id        = var.cloudflare_account_id
  name              = "myvoicelab-fe"
  production_branch = "main"

  source {
    type = "github"
    config {
      owner                         = "grad-256"
      repo_name                     = "voice-lab"
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled           = true
      preview_deployment_setting    = "all"
    }
  }

  build_config {
    build_command       = "pnpm pages:build"
    destination_dir     = ".vercel/output/static"
    root_dir            = ""
  }
}
```

### サンプル：Workers Secret
```hcl
resource "cloudflare_workers_secret" "anthropic_key" {
  account_id    = var.cloudflare_account_id
  script_name   = cloudflare_workers_script.api.name
  name          = "ANTHROPIC_API_KEY"
  secret_text   = var.anthropic_api_key   # sensitive 変数
}
```

### サンプル：R2 バケット
```hcl
resource "cloudflare_r2_bucket" "voice_samples" {
  account_id = var.cloudflare_account_id
  name       = "voice-samples"
  location   = "APAC"  # 日本寄りに
}
```

---

## 5. State 管理

### 選択肢
| 選択肢 | 長所 | 短所 |
|-------|------|------|
| **R2 backend（S3 API 互換）** | 自前の Cloudflare 内で完結・安い | セットアップがやや手間（S3 互換エンドポイント設定） |
| **Terraform Cloud（HCP）** | UI・plan 履歴・変数管理が楽 | 小規模なら無料だが外部依存が増える |
| **GitHub Actions + GitHub Secrets** | 手軽 | state をどこに置くかは別途必要 |

**推奨**：**R2 backend**（Cloudflare 内で完結、$0.015/GB でほぼ無料）

```hcl
terraform {
  backend "s3" {
    bucket                      = "myvoicelab-tfstate"
    key                         = "prod/terraform.tfstate"
    region                      = "auto"
    endpoint                    = "https://<account-id>.r2.cloudflarestorage.com"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    force_path_style            = true
  }
}
```

---

## 6. 導入判断

### 今（Phase 1.5）は Terraform を入れない
- Pages プロジェクトが 1 個、Workers はまだない、R2 も未使用
- **IaC の価値（再現性・履歴）は、構成要素が 3〜5 個以上になってから効く**
- 今入れても運用工数に対してメリットが薄い

### Phase 2 への切り替えタイミングで導入
条件がすべて揃う時：
- Workers（Hono BE）を本番デプロイする
- R2 を使い始める（音声ストレージ移行）
- カスタムドメインを正式運用（`myvoicelab.com` + `api.myvoicelab.com`）

この時点で **5〜7 個のリソース** が同時に必要になり、IaC の価値が出る。

### 導入時のロードマップ（後続タスク）
1. Cloudflare API Token 発行（TF 用、最小権限）
2. R2 backend 用バケット作成
3. `infra/terraform/` ディレクトリ追加
4. 既存 Pages プロジェクトを `terraform import`
5. Workers / R2 / DNS / Secrets を宣言的に追加
6. GitHub Actions で `plan` を PR コメント、`apply` は main マージ時

---

## 7. Supabase の扱い

- **Terraform 管理は非対応**（公式 provider なし、サードパーティも成熟度低い）
- 現状のまま：
  - `supabase/config.toml`：プロジェクト設定
  - `supabase/migrations/*.sql`：スキーマ・RLS・ポリシー
  - Supabase CLI（`supabase db push` 等）で管理
- CI/CD で `supabase db push` を自動化する程度で十分

---

## 8. CI/CD との統合（A-7 と接続）

Terraform 導入後の CI/CD 想定（A-7 で詳細化）：

| イベント | 処理 |
|---------|------|
| PR 作成／更新 | `terraform plan` を実行し結果を PR にコメント |
| main への merge | `terraform apply -auto-approve`（要承認フラグ検討） |
| Supabase migrations 変更 | `supabase db push`（別ジョブ） |
| FE ビルド | `pnpm pages:build` → Pages 自動デプロイ |
| BE ビルド | Workers のコードを `wrangler deploy` または TF の `content` 参照 |

---

## 9. Cloudflare MCP との補完関係

Terraform と Cloudflare MCP Server は **競合ではなく補完**。役割を明確に分ける。

### 9.1 役割分担

| 観点 | Terraform | Cloudflare MCP |
|------|-----------|---------------|
| 目的 | **宣言的にインフラを定義・再現する** | **対話的に現状を調査・運用・デバッグする** |
| 実行タイミング | PR / CI でまとめて | 必要な時に即時 |
| 履歴 | Git + state | 都度実行（ログは残らない） |
| レビュー | `terraform plan` を PR に貼る | 人のやり取りに埋もれる |
| 破壊操作 | `apply` 承認後のみ | ツール権限次第（要制限） |
| 得意 | 作成・更新・環境複製・バージョン管理 | 検索・読み取り・障害対応・仕様確認 |

### 9.2 具体的な使い分け

#### ✅ Terraform が責任を持つ
- Pages プロジェクト・Workers スクリプト・R2 バケット・DNS レコード・Secrets の **定義**
- 本番／プレビュー環境の構成差分
- チーム合意が必要な変更（レビュー可能性）

#### ✅ Cloudflare MCP が担う（この Claude Code 環境で既に接続済み）
- **現状確認**：「今どの Worker がデプロイされている？」「R2 バケットは？」
- **ログ調査**（Observability MCP 追加時）：「昨夜の 500 エラーの原因は？」
- **ドキュメント検索**（`search_cloudflare_documentation`）：Terraform リソースの最新仕様、v5 stabilization 状況
- **障害対応中の即応**：`wrangler tail` 相当を自然言語で
- **Terraform のプレ調査**：新しく書く前に既存リソースを確認
- **scaffolding の補助**：既存リソースの構造を MCP で読んで Terraform HCL に起こす

### 9.3 運用ルール（提案）

1. **定義は必ず Terraform 経由**（MCP で直接 create/delete しない）
2. **破壊系 MCP ツールは `settings.json` で制限** — `r2_bucket_delete` / `d1_database_delete` / `kv_namespace_delete` / `workers_delete` など
3. **MCP は "読む" / "調べる" / "参照する" に徹する**
4. **本番 Account と検証 Account を分ける** → `set_active_account` で明示切替
5. **Terraform plan の前に MCP で下調べ** → Drift を減らす

### 9.4 典型ワークフロー例

```
[新機能の BE エンドポイント追加]
  1. MCP: search_cloudflare_documentation で wrangler.toml のバインディング仕様確認
  2. Terraform: workers_script の追加 PR → plan を貼ってレビュー
  3. main merge で apply
  4. MCP: workers_get_worker でデプロイ後のバインディング確認
  5. （Observability MCP）デプロイ後の 500 エラー監視
```

---

## 10. 結論（1行）

> **Terraform + Cloudflare provider は採用する。**ただし導入は **Phase 2 への切り替えタイミング**（Workers / R2 / カスタムドメインが揃う時）で、State は R2 backend、Supabase は CLI で別管理。**日常の調査・運用は Cloudflare MCP と補完関係で運用する**（定義は TF・運用は MCP）。
