-- ────────────────────────────────────────────────
-- saved_phrases（「これ言えなかった」から保存された英訳フレーズ）
--
-- mvp-scope.md 3.7 節 / Sprint 3：
--   - 「ユーザー発話 → 英訳候補 → 保存」から生まれる永続レコード
--   - source は "preset" | "user" | "suggest" の 3 値。Sprint 3 では "user" が主。
--   - en_text_normalized は必須（4.5 節の突合用）。Sprint 4 で phrase_used_in_chat で利用。
--   - phrase_id_ref はサジェスト由来の場合に元フレーズ ID を残すための任意カラム。
--   - 録音データ・特徴量ベクトルは保存しない（3.9 節の禁止事項と矛盾しないように、
--     本テーブルはテキストのみを扱う）。
-- ────────────────────────────────────────────────
create table saved_phrases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  ja_text              text,
  en_text              text not null,
  en_text_normalized   text not null,
  source               text not null check (source in ('preset', 'user', 'suggest')),
  phrase_id_ref        text,
  created_at           timestamp with time zone default now() not null
);

-- ユーザー毎の一覧取得を速くするため
create index saved_phrases_user_id_created_at_idx
  on saved_phrases (user_id, created_at desc);

-- 同一ユーザー内で同じ正規化英文を重複保存しない（幾何級数的な dup を防ぐ）。
-- 突合検索（Sprint 4 の phrase_used_in_chat）にも使える。
create unique index saved_phrases_user_normalized_key
  on saved_phrases (user_id, en_text_normalized);

alter table saved_phrases enable row level security;

create policy "saved_phrases_owner_access" on saved_phrases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
