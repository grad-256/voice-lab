-- ────────────────────────────────────────────────
-- personas（キャラクター）
-- ────────────────────────────────────────────────
create table personas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  name         text not null,
  style_prompt text not null,
  voice_id     text not null default 'EXAVITQu4vr4xnSDxMaL',
  created_at   timestamp with time zone default now()
);

alter table personas enable row level security;

create policy "自分のキャラのみ操作可能" on personas
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- conversations（会話セッション）
-- ────────────────────────────────────────────────
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  persona_id uuid references personas on delete cascade not null,
  created_at timestamp with time zone default now()
);

alter table conversations enable row level security;

create policy "自分の会話のみ操作可能" on conversations
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- messages（メッセージ）
-- ────────────────────────────────────────────────
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations on delete cascade not null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  translation     text,
  created_at      timestamp with time zone default now()
);

alter table messages enable row level security;

create policy "自分の会話のメッセージのみ操作可能" on messages
  for all using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );
