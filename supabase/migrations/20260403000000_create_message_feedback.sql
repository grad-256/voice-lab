-- ────────────────────────────────────────────────
-- message_feedback（メッセージへのフィードバック）
-- ────────────────────────────────────────────────
create table message_feedback (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     text not null check (rating in ('positive', 'negative')),
  created_at timestamp with time zone default now()
);

-- ユーザーは1メッセージに1フィードバックのみ
create unique index on message_feedback (message_id, user_id);

alter table message_feedback enable row level security;

create policy "自分のフィードバックのみ操作可能" on message_feedback
  for all using (auth.uid() = user_id);
