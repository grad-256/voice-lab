#!/usr/bin/env bash
# Stop hook: when the PostToolUse flag indicates that VoiceLab code
# (app/ components/ lib/ *.ts[x]) was edited, instruct Claude to run
# the evaluator sub-agent for a strict review.
#
# Loop prevention: uses a second "running" flag so the evaluator is
# triggered at most once per user-turn cycle. Without this guard, the
# evaluator's own edits would re-raise the pending flag on the next Stop
# and loop forever.
#
# The "running" flag is cleared at the start of each new user turn by
# the UserPromptSubmit hook (see .claude/settings.json).
#
# Exit: 0 = let the turn end, 2 = block stop and force Claude to continue
#       with stderr as additional instruction.

set -u

FLAG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/flags"
PENDING="$FLAG_DIR/evaluator-pending"
RUNNING="$FLAG_DIR/evaluator-running"

# If we already triggered the evaluator once in this user-turn cycle,
# do NOT re-trigger. Clear any new pending flag so the turn can end.
# This is what breaks the infinite-loop where the evaluator's own edits
# would otherwise re-raise PENDING on the next Stop.
if [ -f "$RUNNING" ]; then
  rm -f "$PENDING" "$RUNNING"
  exit 0
fi

# No pending flag — nothing to evaluate.
[ -f "$PENDING" ] || exit 0

# Consume the pending flag and mark that we have triggered evaluator once
# for this user-turn cycle. The next Stop within this cycle will early-exit
# above; the next UserPromptSubmit will reset RUNNING for the new cycle.
rm -f "$PENDING"
mkdir -p "$FLAG_DIR"
touch "$RUNNING"

cat >&2 <<'EOF'
【自動ハーネス】VoiceLab のコード変更（app/components/lib 配下の .ts/.tsx）を検知しました。
必ず Agent ツールで subagent_type="evaluator" を起動し、直前の変更に対して
CLAUDE.md の品質基準で厳格レビューしてください。
合格なら完了レポート、不合格なら修正ループへ。このメッセージは無視しないこと。
（このサイクル内での evaluator 起動は 1 回までです。次のユーザーターンで再発火します。）
EOF

exit 2
