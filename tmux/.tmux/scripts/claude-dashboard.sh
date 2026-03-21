#!/usr/bin/env bash
# Popup dashboard showing all tmux windows with Claude status.
# Select a window by number to switch to it.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

print_dashboard() {
    printf "\033[1m  # %-30s %s\033[0m\n" "Window" "Status"
    printf "  %s\n" "$(printf '─%.0s' {1..42})"

    while IFS=$'\t' read -r idx name pane_id; do
        status=$("$SCRIPT_DIR/claude-status.sh" "$pane_id")
        case "$status" in
            "●") label="\033[33m● working\033[0m" ;;
            "?") label="\033[31m? waiting\033[0m" ;;
            "○") label="\033[32m○ idle\033[0m" ;;
            *)   label="  shell" ;;
        esac
        printf "  %s %-30s %b\n" "$idx" "$name" "$label"
    done < <(tmux list-windows -F "#{window_index}	#{window_name}	#{pane_id}")

    printf "\n"
}

print_dashboard

printf "  Switch to window: "
read -r choice

if [[ -n "$choice" ]] && tmux select-window -t "$choice" 2>/dev/null; then
    exit 0
else
    exit 0
fi
