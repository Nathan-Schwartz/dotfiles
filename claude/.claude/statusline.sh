#!/usr/bin/env bash
# Claude Code statusline — session info, context, rate limits, cost
input=$(cat)

field() { echo "$input" | jq -r "$1"; }
field_or() { echo "$input" | jq -r "$1 // \"$2\""; }

# --- Extract fields ---
SESSION_ID=$(field '.session_id')
AGENT=$(field_or '.agent.name' '')
MODEL=$(field_or '.model.display_name' '')
CWD=$(field '.workspace.current_dir')
COST=$(field_or '.cost.total_cost_usd' '0')
PCT=$(field_or '.context_window.used_percentage' '0' | cut -d. -f1)
CTX_SIZE=$(field_or '.context_window.context_window_size' '0')
FIVE_H=$(field_or '.rate_limits.five_hour.used_percentage' '')
FIVE_H_RESETS=$(field_or '.rate_limits.five_hour.resets_at' '')

# --- Colors ---
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

# --- Context color ---
if [ "$PCT" -ge 80 ] 2>/dev/null; then CTX_COLOR="$RED"
elif [ "$PCT" -ge 50 ] 2>/dev/null; then CTX_COLOR="$YELLOW"
else CTX_COLOR="$GREEN"; fi

# --- Rate limit ---
RATE=""
if [ -n "$FIVE_H" ]; then
    FIVE_H_INT=$(printf '%.0f' "$FIVE_H")
    if [ "$FIVE_H_INT" -ge 80 ] 2>/dev/null; then RATE_COLOR="$RED"
    elif [ "$FIVE_H_INT" -ge 50 ] 2>/dev/null; then RATE_COLOR="$YELLOW"
    else RATE_COLOR="$GREEN"; fi
    RESETS_IN=""
    if [ -n "$FIVE_H_RESETS" ]; then
        NOW=$(date +%s)
        DIFF=$((FIVE_H_RESETS - NOW))
        [ "$DIFF" -lt 0 ] && DIFF=0
        RESETS_HH=$((DIFF / 3600))
        RESETS_MM=$(( (DIFF % 3600) / 60 ))
        RESETS_IN=$(printf ' (resets in %dh:%02dm)' "$RESETS_HH" "$RESETS_MM")
    fi
    RATE=" | ${RATE_COLOR}${FIVE_H_INT}%${RESET} ${DIM}of${RESET} tokens${DIM}${RESETS_IN}${RESET}"
fi

# --- Format token counts (e.g. 200000 -> 200k) ---
fmt_tokens() {
    local n="$1"
    if [ "$n" -ge 1000 ] 2>/dev/null; then
        echo "$((n / 1000))k"
    else
        echo "$n"
    fi
}

COST_FMT=$(printf '$%.2f' "$COST")
CTX_USED=$((PCT * CTX_SIZE / 100))
CTX_USED_FMT=$(fmt_tokens "$CTX_USED")
CTX_SIZE_FMT=$(fmt_tokens "$CTX_SIZE")

# --- Output ---
LINE1="session ${DIM}${SESSION_ID}${RESET}"
[ -n "$AGENT" ] && LINE1="${LINE1} ${CYAN}@${AGENT}${RESET}"
LINE1="${LINE1} ${YELLOW}(${COST_FMT})${RESET} in ${GREEN}${CWD}${RESET}"

LINE2="${CTX_COLOR}${PCT}%${RESET} ${DIM}of${RESET} context ${DIM}(${CTX_USED_FMT}/${CTX_SIZE_FMT})${RESET}${RATE}"
[ -n "$MODEL" ] && LINE2="${LINE2} ${DIM}[${MODEL}]${RESET}"

printf '%b\n' "$LINE1"
printf '%b\n' "$LINE2"
