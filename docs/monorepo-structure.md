# モノレポ構成（決定事項）

**決定日**：2026-04-14
**決定者**：Masaru / Claude 合意
**ステータス**：**採用確定**。Phase 2（C-1 Hono 移行設計）着手時にディレクトリ再編を実施

> 本ドキュメントは **MyVoiceLab をモノレポで運用する決定** と、その構造・ツール・移行タイミングを記録する。
> `docs/fe-be-boundary.md` `docs/ci-cd-design.md` `docs/terraform-cloudflare.md` `docs/audio-storage.md` はすべて本ドキュメントの構成を前提にしている。

---

## 1. 決定事項（1 行）

> **MyVoiceLab は単一リポジトリ（grad-256/voice-lab）のモノレポで運用する。** FE（`apps/web`）／ BE（`apps/api`）／ 共有パッケージ（`packages/shared`）を pnpm workspaces で管理する。

---

## 2. なぜモノレポか

| 理由 | 説明 |
|------|------|
| **API 契約の共有** | `packages/shared/types` に `/chat` `/transcribe` 等の request/response 型を置き、FE と BE が同じ型を import。契約のズレがコンパイルエラーで即発見される |
| **1 PR で両サイドの変更が見える** | 機能追加時に「FE と BE の両方の変更」を 1 PR でレビューできる。ポリレポだと PR が分裂して追跡が難しい |
| **リリース同期が簡単** | FE と BE の整合性が崩れる瞬間を最小化できる |
| **個人開発の運用負担が軽い** | リポジトリが 1 つで済む。Issues / PR / Actions の設定も 1 箇所 |
| **Claude Code との相性** | 1 つの `CLAUDE.md` / `.claude/` / memory でプロジェクト全体を把握できる |
| **MCP / plugin の設定が単一** | `.claude/settings.json` が 1 つで両方に効く |

### 却下した選択肢
| 選択肢 | 却下理由 |
|-------|---------|
| **ポリレポ（FE / BE を別リポ）** | 個人開発では分業メリットが出ない。契約の共有が CI 連携や npm publish で重くなる |
| **サブモジュール** | 状態管理が複雑になる。モノレポのほぼ上位互換である pnpm workspaces で十分 |

---

## 3. ディレクトリ構造（確定版）

```
voice-lab/                          # リポジトリルート（grad-256/voice-lab）
├── apps/
│   ├── web/                        # FE：Next.js 15 / Cloudflare Pages
│   │   ├── app/
│   │   ├── lib/
│   │   ├── middleware.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── wrangler.toml           # Pages 用
│   │   ├── tsconfig.json           # ルート tsconfig を extends
│   │   ├── package.json
│   │   └── vitest.config.ts
│   └── api/                        # BE：Hono / Cloudflare Workers（新規）
│       ├── src/
│       │   ├── index.ts            # Hono エントリ
│       │   ├── routes/             # transcribe.ts / chat.ts / speak.ts 等
│       │   ├── middleware/         # auth / ratelimit / cors
│       │   └── lib/                # supabase / ai-clients / logger
│       ├── wrangler.toml           # Workers 用
│       ├── tsconfig.json           # ルート tsconfig を extends
│       ├── package.json
│       └── vitest.config.ts
├── packages/
│   └── shared/                     # 共有パッケージ
│       ├── src/
│       │   ├── types/              # API 契約、DB 型、共通 enum
│       │   ├── prompts/            # システムプロンプト（BE 主体だが FE でも参照する可能性）
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── infra/
│   └── terraform/                  # Phase 2 後半で追加（A-6 参照）
├── supabase/                       # 現状維持（Supabase CLI 管理）
│   ├── config.toml
│   └── migrations/
├── docs/                           # 設計ドキュメント
├── .github/
│   └── workflows/
├── .claude/                        # Claude Code 設定・エージェント・スキル
├── pnpm-workspace.yaml             # pnpm workspaces 設定
├── package.json                    # root（共通 devDeps のみ）
├── biome.json                      # ルート一括
├── tsconfig.json                   # base config
└── CLAUDE.md
```

---

## 4. 採用ツールと設定

### 4.1 `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 4.2 ルート `package.json`（最小）
```json
{
  "name": "voice-lab",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev:web":   "pnpm --filter @voice-lab/web dev",
    "dev:api":   "pnpm --filter @voice-lab/api dev",
    "build":     "pnpm -r --filter './apps/*' build",
    "test":      "pnpm -r test",
    "check":     "biome check --write .",
    "typecheck": "pnpm -r exec tsc --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.8.0"
  }
}
```

### 4.3 パッケージ名規約
- `@voice-lab/web`
- `@voice-lab/api`
- `@voice-lab/shared`

### 4.4 `packages/shared` の参照方法
各 app の `package.json` に：
```json
"dependencies": {
  "@voice-lab/shared": "workspace:*"
}
```

### 4.5 TypeScript project references
- ルート `tsconfig.json` は base（paths / strict / lib 等）
- 各 app / package は `extends: "../../tsconfig.json"` + 自身の `references` を持つ
- `@voice-lab/shared` → `apps/*` の順で型が流れる

### 4.6 導入しないツール
| ツール | 却下理由 |
|-------|---------|
| Turborepo | 現状の規模（app 2 + package 1）では恩恵が薄い。pnpm の `-r --filter` で足りる |
| Nx | 同上。学習コストが高い |
| Lerna | 非推奨化、pnpm workspaces に移行する流れ |
| changesets | 公開 npm パッケージでないため不要 |

---

## 5. 移行タイミングと手順

### 5.1 タイミング
**Phase 2 の C-1（Hono 移行設計）着手時**に一気に構造変更する。

理由：
- BE（`apps/api`）を新設するタイミングと重なる
- 構造変更は 1 PR で完了させるのがコンフリクト管理上最も楽
- B フェーズ（MVP プロト）は FE しか触らないので、その間に移行する価値は薄い

### 5.2 移行手順（C-1 PR 内で）
1. `apps/web/` を作成し、現在の `app/` `lib/` `middleware.ts` `next.config.ts` `tailwind.config.ts` `postcss.config.mjs` `wrangler.toml` `vitest.config.ts` `vitest.setup.ts` `package.json`（一部）を移動
2. `apps/api/` を空の Hono プロジェクトで新設
3. `packages/shared/` を作成、最初は API 契約の型だけを置く
4. ルート `package.json` を最小化、`pnpm-workspace.yaml` を追加
5. `biome.json` はルートに一本化
6. `.github/workflows/` を workspaces 対応に更新
7. Cloudflare Pages の build 設定を `apps/web` 配下に変更（Dashboard で Root directory を設定 or `pages_build_output_dir` を調整）
8. Supabase migrations は既存の `supabase/` に残す（各 app から参照）

### 5.3 移行後の import 経路
```ts
// apps/web / apps/api の中で
import type { ChatRequest, ChatResponse } from "@voice-lab/shared/types";
import { SYSTEM_PROMPT } from "@voice-lab/shared/prompts";
```

---

## 6. 他のドキュメントとの関係

| ドキュメント | 関係 |
|-------------|------|
| `docs/fe-be-boundary.md` | 責務分担を定義。本ドキュメントは**その物理構造**を定義 |
| `docs/ci-cd-design.md` | ワークフローはモノレポ前提（`apps/api` を指す）。本ドキュメントが土台 |
| `docs/db-selection.md` | Supabase 継続。`supabase/` はルート直下で共有 |
| `docs/audio-storage.md` | 音声ストレージへのアクセスは BE（`apps/api`）経由 |
| `docs/terraform-cloudflare.md` | `infra/terraform/` はルート直下、両 app を管理 |

---

## 7. 今後このドキュメントが変わる条件

以下のいずれかが起きたら再評価する：

| トリガー | 可能性のある変更 |
|---------|----------------|
| BE を別チーム／別リリースサイクルで運用する必要が出た | ポリレポ分割を検討 |
| Turborepo を使う価値が出る規模（app 5+ 等）になった | Turbo 導入 |
| 公開 npm パッケージを出すことになった | changesets を追加 |

---

## 8. 引き継ぎのための重要ポイント

> **本ドキュメントは MyVoiceLab の物理構造の "憲法" である。**
> Claude Code の新しいセッションが本プロジェクトを扱うときは、必ず本ドキュメントを読んでから実装判断をすること。
> 「モノレポだっけ、ポリレポだっけ」で悩まないように、本ドキュメントに書いた決定に従うこと。
> 変更する場合は必ず本ドキュメントを先に更新し、`fe-be-boundary.md` `ci-cd-design.md` `terraform-cloudflare.md` などの依存ドキュメントも同期する。
