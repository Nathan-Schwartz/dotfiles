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

# Strip empty lines, take last 15 for detection
filtered=$(echo "$content" | grep -v '^$' | tail -15)

# Not a Claude pane if no prompt character
if ! echo "$filtered" | grep -q '❯'; then
    exit 0
fi

# Check for fresh input field: ❯ with ─ border directly above it.
# Also capture the line above the border — that's where spinners appear when working.
has_input_field=false
above_border=""
prev_prev=""
prev_line=""
while IFS= read -r line; do
    if [[ "$line" == *'❯'* && "$prev_line" == *'─'* ]]; then
        has_input_field=true
        above_border="$prev_prev"
        break
    fi
    prev_prev="$prev_line"
    prev_line="$line"
done <<< "$filtered"

# Fresh input field takes priority — stale prompts in scrollback are irrelevant
if $has_input_field; then
    # Check only the line above the border for working indicators (not the full window,
    # which could contain prose mentioning spinner characters)
    if [[ "$above_border" == *'ctrl+c to interrupt'* ]]; then
        echo "●"
    elif [[ "$above_border" =~ [^[:space:]]\ [^[:space:]]+… ]]; then
        echo "●"
    else
        echo "○"
    fi
# No input field — check for active prompts
elif echo "$filtered" | grep -qF 'Enter to select'; then
    echo "?"
elif echo "$filtered" | grep -qE '\[(y/n|Y/n)\]'; then
    echo "?"
fi
