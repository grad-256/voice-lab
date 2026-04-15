-- ────────────────────────────────────────────────
-- saved_phrases の source に 'scene-ai' を追加（/echo 動的生成フレーズの保存用）
--
-- Sprint 5 後の /echo Sonnet 動的化：
--   PRESET_SCENES の静的フレーズを廃止し、Claude Sonnet 4.5 で動的生成するようにした。
--   動的生成フレーズを保存する際の source タグとして 'scene-ai' を新設する。
-- ────────────────────────────────────────────────

alter table saved_phrases drop constraint saved_phrases_source_check;

alter table saved_phrases add constraint saved_phrases_source_check
  check (source in ('preset', 'user', 'suggest', 'scene-ai'));
