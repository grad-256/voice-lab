# 音声ストレージの扱い検討

**対象**：B-5（会話履歴の保存・再生）/ B-3（Step 0 体験）/ G-2（ボイスクローン）
**作成日**：2026-04-14
**前提**：DB は Supabase 継続（`docs/db-selection.md`）

---

## 1. 保存すべき音声の種類

| # | 種類 | 目的 | 発生タイミング | 想定サイズ／本 |
|---|------|------|---------------|---------------|
| ① | **ユーザーの元音声（録音）** | Voice Cloning 元素材、本人確認、履歴振り返り | 会話の録音時・Step 0 のサンプル録音時 | 5〜30秒 / 50〜300KB |
| ② | **ユーザーの英語クローン音声（AI 合成）** | Step 0「自分の声で英語を聞く」体験の核 | Step 0 / 会話再生時 | 3〜15秒 / 30〜150KB |
| ③ | **AI 返答音声（ElevenLabs 出力）** | 履歴を自分の声／相手の声で再生する | Claude 返答直後の `/speak` | 3〜15秒 / 30〜150KB |

### 現状の扱い（`docs/current-implementation.md` Section 12 より）
- ①：録音直後に Whisper に送ってテキスト化した後、**Blob は破棄**（保存していない）
- ②：未実装
- ③：`/api/speak` の出力バイナリをレスポンスとして即時返却、**保存していない**

### 保存が必要になる理由（再掲）
- B-5：会話履歴を**音声付きで**振り返れるようにする
- B-3：Step 0 で「自分の声の英語」を聞き返せる
- G-2：ボイスクローンの元素材を蓄積・再利用する

---

## 2. 候補の比較

| 項目 | **Supabase Storage** | **Cloudflare R2** |
|------|-------------------|-------------------|
| 無料枠 | 1GB 保存 / 2GB 転送 | 10GB 保存 / **egress 無料** |
| 認証統合 | **Supabase Auth＋RLS がそのまま効く** | 別途 BE で署名付き URL を発行（自前） |
| 権限制御 | bucket ポリシー（SQL で記述） | Workers でアクセス制御 |
| Workers 統合 | `@supabase/supabase-js` で呼び出し（REST） | **バインディング直接（env.BUCKET）** |
| 署名付き URL | `createSignedUrl`（一発） | `aws4fetch` 等で自前実装（数行だが手数あり） |
| 料金（有料移行後） | Pro $25/月 で 100GB 保存／250GB 転送 | $0.015/GB 保存、**egress 無料** |
| 転送量が爆発した時のリスク | Supabase は**転送量課金あり**（Pro 超過分は従量） | **egress 無料なので怖くない** |
| 実装の早さ | ◎（1 API で署名付き URL） | ○（バインディング＋署名ヘルパーが必要） |
| ロックイン | 中（Supabase エコシステム） | 中（Cloudflare エコシステム／fe-be-boundary で既に前提） |
| 削除・寿命管理 | lifecycle policy 要自前 | **S3 互換 lifecycle policy あり** |

---

## 3. 決定的な論点

### 論点 1：**音声は「大きい × 再生される」なので転送量が効いてくる**
1 ユーザーが 1 日に 20 分の会話をしたら 1〜2MB／日。それを毎日再生すると転送量が膨らむ。
**R2 は egress 無料** なので、再生が増えてもストレージ料金だけで済む。Supabase Storage は転送超過分が Pro プランでも従量課金。

→ **再生前提のサービスでは R2 が有利。**

### 論点 2：**初期実装の速度**
Supabase Storage は `createSignedUrl()` で 1 発で署名付き URL が作れる。RLS が bucket に効く。
R2 は **BE（Hono）側で署名 URL を自前実装** する必要がある（`aws4fetch` 等で十数行）。

→ **MVP 期の実装速度は Supabase Storage。**

### 論点 3：**FE/BE 境界との整合性**
`fe-be-boundary.md` で「**音声ファイルは BE 経由で署名付き URL を発行**」と決めた。
つまり BE（Workers）がゲートキーパーになるので、**どちらの Storage でも BE で認可判定をする**流れは同じ。
差は「呼び出す API が `supabase.storage.from(...).createSignedUrl()` か、R2 バインディング＋署名関数か」だけ。

### 論点 4：**データ所有の分離リスク**
DB は Supabase、Storage は R2 に分けると **バックアップ・削除の整合性を自前で守る必要がある**（アカウント削除時に DB と Storage 両方を消す）。
一方で、**分散ロックは回避できる**（R2 の削除失敗でも DB は消せる）ので、運用上の事故リスクとは別の話。

→ **アカウント削除時の cascade を明示的にコードで書けば OK。**

---

## 4. 推奨：**段階移行案（Supabase Storage → R2）**

### Phase 2 前半（MVP 期・ユーザー少数）：**Supabase Storage**
- 実装速度を優先。RLS＋`createSignedUrl` で最短ルート
- 無料枠 1GB は、1 ユーザー平均 10MB 想定なら **100 ユーザーまで** 耐える
- データは `voice_samples` テーブルに URL と メタだけ保存

### Phase 2 後半 / 収益化移行時（ユーザー急増前）：**R2 へ移行**
- egress コストが跳ねる前に R2 に移す
- 移行作業：既存 Storage → R2 にコピー → DB の `storage_path` を更新 → Storage 削除
- 閾値の目安：
  - 保存量が 500MB を超える
  - 月間転送量が 2GB を超える
  - 有料プラン ($25/月) を払うより R2 の従量の方が安いと見込める

### 理由
- 初期は **検証と実装速度** が最重要
- 移行は "スキーマ変更不要" なので後からでも実害が小さい
- R2 は **egress 無料** の構造的優位があり、長期的には必ず有利

---

## 5. スキーマ案（Supabase）

DB 上の音声メタ管理テーブル。音声バイナリは Storage、DB には **メタ情報だけ**。

```sql
create type voice_sample_kind as enum ('user_original', 'user_cloned', 'ai_response');

create table voice_samples (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  message_id    uuid references messages(id) on delete cascade,  -- 会話履歴との紐付け（NULL OK：Step 0 用）
  persona_id    uuid references personas(id) on delete set null,
  kind          voice_sample_kind not null,
  storage_path  text not null,                -- Storage 上のパス（bucket 内）
  duration_ms   integer,
  mime_type     text not null default 'audio/mpeg',
  byte_size     integer,
  created_at    timestamp with time zone default now()
);

alter table voice_samples enable row level security;

create policy "自分の音声サンプルのみ操作可能" on voice_samples
  for all using (auth.uid() = user_id);

create index voice_samples_user_created_idx on voice_samples (user_id, created_at desc);
create index voice_samples_message_idx on voice_samples (message_id);
```

### 決め事
- 1 メッセージ ≤ 1 サンプル（`ai_response` 用）
- `user_original` はメッセージに紐付かないこともある（Step 0 / Voice Cloning 元素材）
- `user_cloned` はクローン音声（ElevenLabs 経由で生成した「自分の声で喋らせた」音声）
- Storage の path 規約：`{user_id}/{kind}/{uuid}.{ext}`

---

## 6. Supabase Storage バケット設計

| bucket 名 | 公開範囲 | 用途 |
|-----------|--------|------|
| `voice-samples` | **private** | すべての音声（①②③） |

- 公開 bucket にはしない（ユーザーの声は個人情報）
- ダウンロードは **BE 経由の署名付き URL のみ**
- 署名付き URL の有効期限は **5 分程度**（履歴再生時に都度生成）

### RLS ポリシー（bucket）
```sql
-- ユーザーは自分の prefix 配下のみ読み書き可能
create policy "自分の音声のみアクセス可能" on storage.objects
  for all using (
    bucket_id = 'voice-samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 7. プライバシー規定への反映（E-2 連携）

以下は `legal-checker` エージェントに渡す論点：

- **ElevenLabs への送信**：ユーザーの元音声を Voice Cloning に送る際の明示的同意 UI が必要か
- **保存期間**：元音声は永久保存か、N 日で自動削除か
- **削除権**：アカウント削除時に Storage からも確実に削除する実装（現状の `/api/account/delete` 相当を Storage にも拡張）
- **未成年・他人の声**：規約で禁止する文言
- **国外移転**：Supabase の Storage は US 拠点。個人情報保護法上の表示が必要

---

## 8. FE / BE 境界における音声の流れ

### Step 0（自分の声で英語を聞く）
```
FE: MediaRecorder で録音
FE: 録音 Blob を POST /voice-samples（BE）
BE: Supabase Storage にアップロード & voice_samples に INSERT（kind=user_original）
BE: 元音声を ElevenLabs Voice Cloning API に送る（G-2 で詳細）
BE: クローン音声を生成 → Storage に保存（kind=user_cloned）
BE: 署名付き URL を返す
FE: audio タグで再生
```

### 会話履歴の再生（B-5）
```
FE: GET /conversations/:id/messages
BE: messages と voice_samples を JOIN、署名付き URL を都度発行してレスポンス
FE: audio タグで再生
```

---

## 9. 移行シナリオ（Supabase Storage → R2）

1. R2 バケット作成、BE に R2 バインディング追加
2. 既存 Storage のファイルを batch job で R2 にコピー（`voice_samples` を走査）
3. `voice_samples` に `storage_backend enum('supabase','r2')` カラム追加（過渡期のみ）
4. 新規アップロードは R2 に書く
5. FE からのアクセスはバックエンド判定（どちらの署名 URL を返すか）
6. 旧 Storage のファイル参照がゼロになったら Supabase Storage 削除
7. `storage_backend` カラムを削除、コードを R2 固定に単純化

---

## 10. 結論（1行）

> **初期は Supabase Storage（実装速度優先）、500MB もしくは月 2GB 転送を超える前に R2 に移行する。** スキーマは最初から R2 への移行を前提にメタと URL を分離しておく。
