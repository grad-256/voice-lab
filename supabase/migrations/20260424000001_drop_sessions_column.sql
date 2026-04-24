-- セッション制限を廃止し、ターン制限のみに統一する
alter table daily_usage drop column if exists sessions;
alter table guest_usage drop column if exists sessions;
