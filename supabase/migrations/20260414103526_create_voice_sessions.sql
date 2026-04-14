-- ────────────────────────────────────────────────
-- voice_sessions（分身の声の選択結果）
--
-- mvp-scope.md 7.Q11 / 決定事項 5・6 に基づく：
--   - 1 ユーザー = 1 レコード（user_id に UNIQUE）
--   - 録音データ・特徴量ベクトルは保存しない（voice_features_vector カラム不設置）
--   - 保存するのは「ElevenLabs Voice Library から選んだ voice_id」のみ
-- ────────────────────────────────────────────────
create table voice_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  selected_voice_id  text not null,
  created_at         timestamp with time zone default now() not null,
  updated_at         timestamp with time zone default now() not null
);

-- 1 ユーザー 1 分身声（再マッチング時は upsert で上書き）
create unique index voice_sessions_user_id_key on voice_sessions (user_id);

-- updated_at を自動更新するトリガ関数。voice_sessions 専用のため public に同名関数があれば衝突しないよう個別命名
create or replace function set_voice_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger voice_sessions_set_updated_at
  before update on voice_sessions
  for each row
  execute function set_voice_sessions_updated_at();

alter table voice_sessions enable row level security;

create policy "自分の分身声のみ操作可能" on voice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
