#!/usr/bin/env bash
# Claude session dashboard for tmux.
# Shows all windows with Claude status, working directory, and git branch.
# Navigate with j/k or arrow keys, Enter to switch, q/Esc to cancel.

# Note: no set -e — bash arithmetic returns exit 1 when result is 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
YELLOW="\033[33m"
RED="\033[31m"
GREEN="\033[32m"
CYAN="\033[36m"
REVERSE="\033[7m"

# Collect window data
declare -a WIN_IDX WIN_NAME WIN_LABEL WIN_DIR WIN_BRANCH

i=0
while IFS=$'\t' read -r idx name pane_id pane_dir; do
    WIN_IDX[$i]="$idx"
    WIN_NAME[$i]="$name"
    WIN_DIR[$i]="${pane_dir/#$HOME/\~}"

    status=$("$SCRIPT_DIR/claude-status.sh" "$pane_id")
    case "$status" in
        "●") WIN_LABEL[$i]="${YELLOW}● working${RESET}" ;;
        "!") WIN_LABEL[$i]="${RED}! approve${RESET}" ;;
        "?") WIN_LABEL[$i]="${RED}? waiting${RESET}" ;;
        "○") WIN_LABEL[$i]="${GREEN}○ idle${RESET}" ;;
        *)   WIN_LABEL[$i]="${DIM}  shell${RESET}" ;;
    esac

    branch=$(git -C "$pane_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ -n "$branch" ]]; then
        WIN_BRANCH[$i]=" ${CYAN}(${branch})${RESET}"
    else
        WIN_BRANCH[$i]=""
    fi

    i=$((i + 1))
done < <(tmux list-windows -F "#{window_index}	#{window_name}	#{pane_id}	#{pane_current_path}")

count=$i
if [[ $count -eq 0 ]]; then exit 0; fi
selected=0

# Find which entry matches the current window
current_idx=$(tmux display-message -p '#{window_index}')
for i in "${!WIN_IDX[@]}"; do
    if [[ "${WIN_IDX[$i]}" == "$current_idx" ]]; then
        selected=$i
        break
    fi
done

render() {
    # Move cursor to top and clear
    printf "\033[H\033[J"
    printf "\n"
    printf "  ${BOLD}Claude Session Dashboard${RESET}\n"
    printf "  ${DIM}%s${RESET}\n" "$(printf '─%.0s' {1..60})"
    printf "\n"

    for i in "${!WIN_IDX[@]}"; do
        local marker="  "
        local highlight=""
        local highlight_end=""

        if [[ $i -eq $selected ]]; then
            highlight="${REVERSE}"
            highlight_end="${RESET}"
        fi

        printf "  ${highlight}${BOLD}%s${RESET}${highlight}  %-18s %b    ${DIM}%s${RESET}%b${highlight_end}\n" \
            "${WIN_IDX[$i]}" "${WIN_NAME[$i]}" "${WIN_LABEL[$i]}" "${WIN_DIR[$i]}" "${WIN_BRANCH[$i]}"
    done

    printf "\n"
    printf "  ${DIM}j/k or ↑/↓ to navigate, Enter to switch, q to cancel${RESET}\n"
}

# Hide cursor, restore on exit
tput civis 2>/dev/null
trap 'tput cnorm 2>/dev/null' EXIT

render

while true; do
    IFS= read -rsn1 key

    case "$key" in
        j)
            if (( selected < count - 1 )); then (( selected++ )); fi
            ;;
        k)
            if (( selected > 0 )); then (( selected-- )); fi
            ;;
        $'\x1b')
            # Read escape sequence
            read -rsn2 -t 0.1 seq || true
            case "$seq" in
                '[A') if (( selected > 0 )); then (( selected-- )); fi ;;
                '[B') if (( selected < count - 1 )); then (( selected++ )); fi ;;
                '') exit 0 ;;  # Bare Esc (no following sequence)
                *) ;;  # Ignore all other sequences (arrows, function keys, etc.)
            esac
            ;;
        '')
            # Enter key (empty with IFS unset)
            tmux select-window -t "${WIN_IDX[$selected]}" 2>/dev/null || true
            exit 0
            ;;
        q)
            exit 0
            ;;
        [0-9])
            # Jump selection to window by number
            for i in "${!WIN_IDX[@]}"; do
                if [[ "${WIN_IDX[$i]}" == "$key" ]]; then
                    selected=$i
                    break
                fi
            done
            ;;
        *)
            ;;  # Ignore everything else
    esac

    render
done
