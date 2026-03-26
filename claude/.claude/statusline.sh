#!/usr/bin/env bash
# Claude Code statusline — session info, context, rate limits, cost
input=$(cat)

field() { echo "$input" | jq -r "$1"; }
field_or() { echo "$input" | jq -r "$1 // \"$2\""; }

# --- Extract fields ---
SESSION_ID=$(field '.session_id')
AGENT=$(field_or '.agent.name' '')
CWD=$(field '.workspace.current_dir')
COST=$(field_or '.cost.total_cost_usd' '0')
PCT=$(field_or '.context_window.used_percentage' '0' | cut -d. -f1)
CTX_SIZE=$(field_or '.context_window.context_window_size' '0')
FIVE_H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
FIVE_H_RESETS=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

# --- Colors ---
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

# --- Terminal width (dynamic, not hardcoded) ---
COLS=$(stty size </dev/tty 2>/dev/null | awk '{print $2}') 2>/dev/null
[ -z "$COLS" ] || [ "$COLS" -eq 0 ] 2>/dev/null && COLS=0

# --- Visible length: strip ANSI escapes, count chars ---
vislen() { printf '%b' "$1" | perl -pe 's/\e\[[0-9;]*m//g' | wc -m | tr -d ' '; }

# --- Print left + right aligned on one line, fallback to inline ---
lr() {
    local left="$1" right="$2"
    if [ "$COLS" -gt 0 ] && [ -n "$right" ]; then
        local llen rlen gap
        llen=$(vislen "$left")
        rlen=$(vislen "$right")
        gap=$((COLS - llen - rlen - 2))
        if [ "$gap" -gt 0 ]; then
            printf '%b%*s%b\n' "$left" "$gap" "" "$right"
            return
        fi
    fi
    [ -n "$right" ] && printf '%b %b\n' "$left" "$right" || printf '%b\n' "$left"
}

# --- Context bar ---
if [ "$PCT" -ge 80 ] 2>/dev/null; then BAR_COLOR="$RED"
elif [ "$PCT" -ge 50 ] 2>/dev/null; then BAR_COLOR="$YELLOW"
else BAR_COLOR="$GREEN"; fi

BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /█}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

# --- Rate limit bar ---
RATE=""
if [ -n "$FIVE_H" ]; then
    FIVE_H_INT=$(printf '%.0f' "$FIVE_H")
    if [ "$FIVE_H_INT" -ge 80 ] 2>/dev/null; then RATE_COLOR="$RED"
    elif [ "$FIVE_H_INT" -ge 50 ] 2>/dev/null; then RATE_COLOR="$YELLOW"
    else RATE_COLOR="$GREEN"; fi
    RATE_BAR_WIDTH=5
    RATE_FILLED=$((FIVE_H_INT * RATE_BAR_WIDTH / 100))
    RATE_EMPTY=$((RATE_BAR_WIDTH - RATE_FILLED))
    RATE_BAR=""
    [ "$RATE_FILLED" -gt 0 ] && printf -v RFILL "%${RATE_FILLED}s" && RATE_BAR="${RFILL// /█}"
    [ "$RATE_EMPTY" -gt 0 ] && printf -v RPAD "%${RATE_EMPTY}s" && RATE_BAR="${RATE_BAR}${RPAD// /░}"
    RESETS_IN=""
    if [ -n "$FIVE_H_RESETS" ]; then
        NOW=$(date +%s)
        DIFF=$((FIVE_H_RESETS - NOW))
        [ "$DIFF" -lt 0 ] && DIFF=0
        RESETS_HH=$((DIFF / 3600))
        RESETS_MM=$(( (DIFF % 3600) / 60 ))
        RESETS_IN=$(printf ' (resets in %dh:%02dm)' "$RESETS_HH" "$RESETS_MM")
    fi
    # RATE=" ${RATE_COLOR}${RATE_BAR}${RESET} ${FIVE_H_INT}% of 5h limit${RESETS_IN}"
    RATE=" | ${RATE_COLOR}${FIVE_H_INT}%${RESET} ${DIM}of${RESET} tokens${DIM}${RESETS_IN}${RESET}"
fi

# --- Cost ---
COST_FMT=$(printf '$%.2f' "$COST")

# --- Format token counts (e.g. 200000 -> 200k) ---
fmt_tokens() {
    local n="$1"
    if [ "$n" -ge 1000 ] 2>/dev/null; then
        echo "$((n / 1000))k"
    else
        echo "$n"
    fi
}
CTX_USED=$((PCT * CTX_SIZE / 100))
CTX_USED_FMT=$(fmt_tokens "$CTX_USED")
CTX_SIZE_FMT=$(fmt_tokens "$CTX_SIZE")

# --- Line 1: session+agent+cwd+cost ---
LEFT1="session ${DIM}${SESSION_ID}${RESET}"
[ -n "$AGENT" ] && LEFT1="${LEFT1} ${CYAN}@${AGENT}${RESET}"
LEFT1="${LEFT1} ${YELLOW}(${COST_FMT})${RESET} in ${GREEN}${CWD}${RESET}"
RIGHT1=""

# --- Line 2: context+rate ---
LEFT2="${BAR_COLOR}${PCT}%${RESET} ${DIM}of${RESET} context ${DIM}(${CTX_USED_FMT}/${CTX_SIZE_FMT})${RESET}${RATE}"

lr "$LEFT1" "$RIGHT1"
lr "$LEFT2" ""
