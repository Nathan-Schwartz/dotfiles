#!/usr/bin/env bash
# Returns a status indicator for a Claude Code pane.
# Usage: claude-status.sh <pane_id>
#
# Indicators:
#   ● — Claude is working
#   ? — Claude is waiting for input
#   ○ — Claude is idle
#   (empty) — Not a Claude pane

set -e

pane_id="$1"
[[ -z "$pane_id" ]] && exit 0

content=$(tmux capture-pane -t "$pane_id" -p 2>/dev/null) || exit 0

# Strip empty lines and take last 15 lines for detection
filtered=$(echo "$content" | grep -v '^$' | tail -15)

# Not a Claude pane if no prompt character
if ! echo "$filtered" | grep -q '❯'; then
    exit 0
fi

# Waiting for user input ([y/n] or [Y/n])
if echo "$filtered" | grep -qE '\[(y/n|Y/n)\]'; then
    echo "?"
# Working (ctrl+c to interrupt visible)
elif echo "$filtered" | grep -q 'to interrupt'; then
    echo "●"
# Idle (prompt visible, not working)
else
    echo "○"
fi
