-- daily_usage（ログイン済ユーザー）
create table daily_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  turns      int not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create unique index daily_usage_user_date_key on daily_usage (user_id, date);
alter table daily_usage enable row level security;
create policy "自分の利用データのみ操作可能" on daily_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- guest_usage（ゲスト・Cookie UUID ベース）
create table guest_usage (
  id         uuid primary key default gen_random_uuid(),
  guest_id   text not null,
  date       date not null default current_date,
  turns      int not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create unique index guest_usage_guest_date_key on guest_usage (guest_id, date);
-- RLS: service role のみアクセス可（ゲスト UUID は PII でないが、サーバー側管理を徹底）
alter table guest_usage enable row level security;
