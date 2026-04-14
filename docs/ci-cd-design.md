# CI/CD 設計（Harness Engineering）

**対象**：Phase 1.5 〜 Phase 2 の継続的検証・デプロイ基盤
**作成日**：2026-04-14
**前提ドキュメント**：`fe-be-boundary.md` / `db-selection.md` / `audio-storage.md` / `terraform-cloudflare.md`

---

## 1. 目的と Harness Engineering の位置付け

> Anthropic Labs の [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) の考え方を取り入れる。
> **生成（コード変更）と評価（テスト）を独立させ、評価側を自動化・強制化する。**

CI/CD はこの "評価側" の中核。以下の原則で設計する：

1. **品質ゲートを機械化**：lint / typecheck / test / plan が通らないと main に入らない
2. **失敗は早く、安く**：PR ごとに短時間で壊す（15 分以内目標）
3. **本番デプロイは宣言的**：Terraform + Supabase migrations で差分を再現可能に
4. **ロールバックは Git revert**：手動操作での "戻し" を避ける
5. **評価者は実装者と独立**：`evaluator` エージェント・セキュリティスキャン・型安全を並行で走らせる

---

## 2. パイプライン全体像

```
 Developer push
     │
     ▼
┌─ PR 作成／更新 ────────────────────┐
│  [並列ジョブ]                        │
│  - biome check (lint + format)      │
│  - tsc --noEmit (typecheck)         │
│  - vitest (unit + integration)      │
│  - supabase db lint (将来)          │
│  - terraform fmt + validate + plan  │← Phase 2 以降
│  [逐次]                              │
│  - preview deploy (Cloudflare Pages) │
│  - comment plan/preview URL on PR    │
└──────────────────────────────────────┘
     │（承認 + チェック全パス）
     ▼
┌─ main push ─────────────────────────┐
│  1. supabase db push                 │
│  2. Cloudflare Pages build & deploy  │
│  3. wrangler deploy (Workers)        │← Phase 2 以降
│  4. terraform apply                  │← Phase 2 以降
│  5. smoke test（/health 叩く）      │
└──────────────────────────────────────┘
     │
     ▼
┌─ 本番監視（運用） ───────────────────┐
│  - Cloudflare Observability MCP     │
│  - PostHog                           │
│  - Sentry / Logtail (将来)          │
└──────────────────────────────────────┘
```

---

## 3. フェーズ別の導入ステップ

| フェーズ | 含める内容 |
|---------|-----------|
| **Phase 1.5（今）** | PR チェック（biome / tsc / vitest） + Pages 自動デプロイ（現状） |
| **Phase 2 前半** | Supabase migrations 自動適用 + Workers デプロイ + smoke test |
| **Phase 2 後半** | Terraform plan/apply、Observability 監視自動化 |
| **Phase 3+** | セキュリティスキャン（CodeQL / trivy）、E2E（Playwright）、Lighthouse CI |

---

## 4. GitHub Actions ワークフロー構成

### ディレクトリ配置
```
.github/
└── workflows/
    ├── pr-check.yml        # PR ごとのチェック
    ├── main-deploy.yml     # main push 時のデプロイ
    └── preview-deploy.yml  # PR プレビュー（Phase 2 以降、必要なら）
```

---

### 4.1 `pr-check.yml`（Phase 1.5 で今すぐ使える版）

```yaml
name: PR Check
on:
  pull_request:
    branches: [main]

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check       # biome lint + format
      - run: pnpm exec tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test        # vitest
```

### 4.2 `main-deploy.yml`（Phase 2 想定、Workers + Supabase migrations を追加）

```yaml
name: Main Deploy
on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: |
          supabase link --project-ref $SUPABASE_PROJECT_REF
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

  deploy-workers:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api build      # Hono ビルド（モノレポ化想定）
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          workingDirectory: apps/api

  smoke-test:
    needs: deploy-workers
    runs-on: ubuntu-latest
    steps:
      - name: Health check
        run: |
          for i in 1 2 3; do
            if curl -sf https://api.myvoicelab.com/health; then exit 0; fi
            sleep 5
          done
          exit 1
```

Pages は **Dashboard の Git 連携で自動デプロイ**されるので、main-deploy.yml からは外す（重複を避ける）。

---

### 4.3 Terraform ステップ（Phase 2 後半）

別ファイル `terraform.yml` に分離：

```yaml
name: Terraform
on:
  pull_request:
    paths: ['infra/terraform/**']
  push:
    branches: [main]
    paths: ['infra/terraform/**']

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check
        working-directory: infra/terraform
      - run: terraform init
        working-directory: infra/terraform
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}       # R2 backend 用
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
      - run: terraform validate
      - run: terraform plan -out=tfplan -no-color | tee plan.txt
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - uses: actions/github-script@v7   # plan を PR コメントに貼る
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infra/terraform/plan.txt', 'utf8');
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: "```\n" + plan + "\n```"
            });

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production          # GitHub Environment で承認必須
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
        working-directory: infra/terraform
      - run: terraform apply -auto-approve
        working-directory: infra/terraform
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**GitHub Environment**（`production`）を使い、**`apply` だけ承認必須**にする。

---

## 5. Secrets 一覧（GitHub Actions 側）

| Secret 名 | 用途 | 設定タイミング |
|-----------|------|---------------|
| `CLOUDFLARE_API_TOKEN` | Workers デプロイ・Terraform | Phase 2 |
| `CLOUDFLARE_ACCOUNT_ID` | 同上 | Phase 2 |
| `SUPABASE_ACCESS_TOKEN` | `supabase db push` | Phase 1.5 末 |
| `SUPABASE_PROJECT_REF` | 同上 | Phase 1.5 末 |
| `SUPABASE_DB_PASSWORD` | 同上 | Phase 1.5 末 |
| `R2_ACCESS_KEY_ID` | Terraform state backend | Phase 2 後半 |
| `R2_SECRET_ACCESS_KEY` | 同上 | Phase 2 後半 |

**原則**：AI API Key（OpenAI / Anthropic / ElevenLabs）や Stripe Secret は GitHub Actions には入れない。**Workers secrets / Cloudflare 環境変数に直接設定**（Terraform で管理）。

---

## 6. テスト戦略

### 既存（維持）
- `pnpm test:unit`：`lib/` の純粋関数
- `pnpm test:integration`：`app/api/` の Route Handler（Edge Runtime mock 前提）

### 追加したい（Phase 2）

| テスト種 | 目的 | タイミング |
|---------|------|-----------|
| **契約テスト**（FE↔BE） | fe-be-boundary の API 契約を壊さない | 常時（PR） |
| **E2E**（Playwright） | ログイン〜会話〜録音の golden path | 夜間 or 週次 |
| **音声パイプラインテスト** | Whisper→Claude→ElevenLabs の統合 | 手動・リリース前 |
| **DB マイグレーション逆順テスト** | down が書かれているか | PR（migrations 変更時） |
| **Lighthouse CI** | LP のパフォーマンス退行検知 | PR（`app/page.tsx` 変更時） |

### テストの置き場所
- 単体：`lib/*.test.ts` / `app/**/*.test.ts`
- 統合：`app/api/**/*.integration.test.ts`
- E2E：`e2e/*.spec.ts`（Playwright 導入時）

---

## 7. evaluator エージェントとの接続

現状、`.claude/settings.json` のフックで PostToolUse + Stop により **evaluator が自動起動**する仕組みがある（`launch-team/SKILL.md` 参照）。

CI 側でも同じ「評価側の独立性」を保つために以下を徹底：

- PR に **`evaluator: pass` ラベル** を付けないとマージ不可（GitHub branch protection）
- ローカルの evaluator 合否は **Claude Code 内で完結**、CI 側は機械判定のみ
- 両者は独立。ローカル評価で合格しても CI で fail すれば当然マージ不可

---

## 8. ブランチ保護ルール（main）

```
- Require status checks to pass before merging
  ✓ lint / test / typecheck / terraform plan（Phase 2 以降）
- Require pull request reviews before merging: 1
- Require branches to be up to date before merging
- Include administrators
- Restrict force push to main
```

---

## 9. ロールバック戦略

| 変更種 | ロールバック方法 |
|-------|----------------|
| FE のコード変更 | `git revert` → 再デプロイ（Pages は自動） |
| BE のコード変更（Workers） | `git revert` → `wrangler rollback` でも可 |
| Supabase migrations | **新しい up migration を書く**（down は信用しない） |
| Terraform による変更 | コードを戻して `terraform apply`（state の巻き戻しは避ける） |

**原則**：**forward-fix**（前に進めて直す）を優先。state や DB スキーマを無理に戻さない。

---

## 10. 監視・アラート（CI/CD の出口）

| レイヤ | ツール | 責任 |
|-------|-------|------|
| ビルド・デプロイ | GitHub Actions Notifications | 失敗したら即 Slack/メール |
| Runtime（Workers） | Cloudflare Observability MCP | ログ・エラー率・p95 レイテンシ |
| Runtime（FE） | PostHog + Sentry（将来） | ユーザーエラー・セッション |
| 課金 | Cloudflare Dashboard / Stripe | 毎日確認 |
| DB | Supabase Dashboard | 容量・スロークエリ |

---

## 11. セキュリティ上の原則

1. **Secrets は GitHub Encrypted Secrets + Cloudflare Secrets に二重で分離**
2. **OIDC（`id-token: write`）でクラウド認証**を将来導入（長期 Token の廃止）
3. **依存の自動更新**：Dependabot / Renovate を PR ベースで導入
4. **SAST**：CodeQL を週次で走らせる（Phase 3）
5. **シークレットスキャン**：GitHub 標準機能を有効化

---

## 12. 今やること・後でやることの整理

### ✅ 今（Phase 1.5）即座に入れる
- `.github/workflows/pr-check.yml`：biome + tsc + vitest
- branch protection（main）：上記 3 チェック必須
- Supabase migrations の CI 適用（`main-deploy.yml` の `migrate` ジョブだけ）

### ⏳ Phase 2 着手時
- `main-deploy.yml` に `deploy-workers` + `smoke-test` 追加
- Workers secrets を Cloudflare 側に投入
- `.github/workflows/terraform.yml`（plan / apply）
- GitHub Environment `production`（承認フロー）

### 🌱 Phase 2 後半 〜 Phase 3
- Playwright E2E
- Lighthouse CI
- CodeQL / Dependabot
- Observability MCP による自動アラート生成

---

## 13. 結論（1行）

> **Harness Engineering の原則（生成と評価の分離）を CI/CD でも貫く。**今すぐ Phase 1.5 で `pr-check.yml` を入れて壊れない状態を作り、Phase 2 で Workers デプロイと Terraform apply を段階的に組み込む。**forward-fix 優先**で、ロールバック地獄を避ける。
