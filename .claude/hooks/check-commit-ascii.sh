#!/usr/bin/env bash
# PreToolUse / Bash hook: block `git commit` only when the commit message
# contains non-ASCII bytes. Scans only the `-m` / `--message` argument,
# not the entire command string, so unrelated Japanese (e.g. trailing
# `echo "日本語"`) does not cause false positives.
#
# Background: Cloudflare Pages rejects non-ASCII commit messages
# (Invalid commit message, code: 8000111). See CLAUDE.md.
#
# Input: JSON payload on stdin with `.tool_input.command`.
# Exit:  0 = allow, 2 = block (stderr shown to Claude).

set -u

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

[ -z "$cmd" ] && exit 0

# Flatten newlines so regex can span heredoc-style messages that embed \n.
flat=$(printf '%s' "$cmd" | tr '\n' ' ')

# Only proceed if `git commit` appears as an actual subcommand invocation
# (at the start of the string, or immediately after a shell separator).
# This rules out false matches like `git committed ...` or `git log git commit`.
if ! printf '%s' "$flat" | grep -qE '(^|[[:space:];&|])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

# Extract every `-m "..."` / `-m '...'` / `--message="..."` / `--message='...'`
# occurrence. We scan ONLY the extracted message text — not the whole command.
# The leading `[-]` keeps grep from treating the pattern itself as an option.
msgs=$(
  {
    printf '%s' "$flat" | grep -oE '[-]m[[:space:]]+"[^"]*"'       | sed -E 's/^-m[[:space:]]+"//;       s/"$//'
    printf '%s' "$flat" | grep -oE "[-]m[[:space:]]+'[^']*'"       | sed -E "s/^-m[[:space:]]+'//;       s/'$//"
    printf '%s' "$flat" | grep -oE '[-][-]message="[^"]*"'          | sed -E 's/^--message="//;          s/"$//'
    printf '%s' "$flat" | grep -oE "[-][-]message='[^']*'"          | sed -E "s/^--message='//;          s/'$//"
  } 2>/dev/null
)

# If no -m / --message could be extracted (e.g. `-F file`, editor commit,
# or unusual quoting), fall back to NOT blocking. Cloudflare will still
# reject bad messages later; we prefer no false positives here.
[ -z "$msgs" ] && exit 0

# Scan extracted messages for non-ASCII bytes.
if printf '%s' "$msgs" | LC_ALL=C tr -d '\000-\177' | LC_ALL=C grep -q .; then
  cat >&2 <<'EOF'
【安全網】git commit メッセージに非ASCII文字（日本語など）が含まれています。
Cloudflare Pages のデプロイ API は UTF-8 非ASCIIコミットメッセージを拒否します
（Invalid commit message, code: 8000111）。
メッセージを英語で書き直してください。CLAUDE.md 参照。
EOF
  exit 2
fi

exit 0
