-- ────────────────────────────────────────────────
-- diary_entries（声の日記：1 会話 = 1 レコード）
--
-- project_pivot_voice_os.md：
--   - /diary で話した内容を AI が自動要約し、ログイン済ユーザーのみ保存する
--   - transcript は jsonb で元会話全文 [{role, text}] を保持
--   - 過去の直近 N 件の summary を次回 /diary の system prompt に渡して文脈継承する
--   - ゲストは DB 保存なし（本テーブルに insert されない）
-- ────────────────────────────────────────────────
create table diary_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  summary        text not null,
  transcript     jsonb not null,
  language       text not null default 'ja',
  message_count  integer not null default 0,
  created_at     timestamp with time zone default now() not null
);

-- ユーザー毎の新着順一覧のため
create index diary_entries_user_created_idx
  on diary_entries (user_id, created_at desc);

alter table diary_entries enable row level security;

-- 自分の日記だけ読み書きできる（編集機能は MVP にないので update ポリシーは不要）
create policy "diary_entries_owner_select" on diary_entries
  for select using (auth.uid() = user_id);

create policy "diary_entries_owner_insert" on diary_entries
  for insert with check (auth.uid() = user_id);

create policy "diary_entries_owner_delete" on diary_entries
  for delete using (auth.uid() = user_id);
