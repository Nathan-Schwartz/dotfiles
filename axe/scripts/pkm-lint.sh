#!/usr/bin/env bash
set -euo pipefail

# Discover PKM compound-extension files and lint them in parallel via axe.
#
# Usage:
#   pkm-lint.sh [directory ...]          # scan directories for *.{ref,synth,temp,index}.md
#   find notes -name '*.ref.md' | pkm-lint.sh   # stdin fallback
#
# Environment:
#   AXE_AGENTS_DIR  — path to agents directory (default: ./axe/agents)
#   AXE_PARALLEL    — max concurrent axe invocations (default: 4)

AGENTS_DIR="${AXE_AGENTS_DIR:-./axe/agents}"
PARALLEL="${AXE_PARALLEL:-4}"
TMPDIR_BASE="${TMPDIR:-/tmp}/pkm-lint.$$"

cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT
mkdir -p "$TMPDIR_BASE"

# --- file discovery ---

discover_files() {
  if [[ $# -gt 0 ]]; then
    for dir in "$@"; do
      find "$dir" -type f \( -name '*.ref.md' -o -name '*.synth.md' -o -name '*.temp.md' -o -name '*.index.md' \) 2>/dev/null
    done
  elif [[ ! -t 0 ]]; then
    cat
  else
    find . -type f \( -name '*.ref.md' -o -name '*.synth.md' -o -name '*.temp.md' -o -name '*.index.md' \) 2>/dev/null
  fi
}

# --- per-file worker ---

lint_file() {
  local file="$1" outdir="$2"
  local safe_name
  safe_name=$(echo "$file" | tr '/' '_')

  local raw
  if raw=$(cat "$file" | axe run pkm-lint \
    --agents-dir "$AGENTS_DIR" \
    -p "File: $file" \
    --timeout 300 2>/dev/null); then
    local cleaned
    if cleaned=$(echo "$raw" | extract_json); then
      echo "$cleaned" > "$outdir/$safe_name.json"
    else
      jq -n --arg f "$file" --arg r "$raw" \
        '{file: $f, error: "non-json response", raw: $r}' > "$outdir/$safe_name.err"
    fi
  else
    jq -n --arg f "$file" '{file: $f, error: "axe failed"}' > "$outdir/$safe_name.err"
  fi
}

# Strip prose preamble and markdown fences from LLM output, extract JSON.
extract_json() {
  local input
  input=$(cat)
  # Try 1: find raw JSON lines (no fences)
  local attempt
  if attempt=$(echo "$input" | sed -n '/^[{\[]/,/^[}\]]/p' | jq '.' 2>/dev/null) && [[ -n "$attempt" ]]; then
    echo "$attempt"
    return 0
  fi
  # Try 2: strip markdown fences, then find JSON
  if attempt=$(echo "$input" | sed '/^```[a-z]*$/d; /^```$/d' | sed -n '/^[{\[]/,/^[}\]]/p' | jq '.' 2>/dev/null) && [[ -n "$attempt" ]]; then
    echo "$attempt"
    return 0
  fi
  return 1
}

export -f lint_file extract_json
export AGENTS_DIR

# --- main ---

file_list=$(discover_files "$@" | sort -u | grep -v '^$')
file_count=$(echo "$file_list" | wc -l | tr -d ' ')

if [[ -z "$file_list" ]]; then
  echo "pkm-lint: no PKM files found" >&2
  exit 0
fi

echo "pkm-lint: found $file_count files, pool size $PARALLEL" >&2

# Dispatch parallel pool
echo "$file_list" | xargs -P "$PARALLEL" -I{} bash -c 'lint_file "$1" "$2"' _ {} "$TMPDIR_BASE"

# --- report ---

# Collect all results
results=$(cat "$TMPDIR_BASE"/*.json 2>/dev/null | jq -s '.' || echo "[]")
errors=$(cat "$TMPDIR_BASE"/*.err 2>/dev/null | jq -s '.' || echo "[]")

# Summary by priority
high=$(echo "$results" | jq '[.[] | select(.review_priority == "high")] | length')
medium=$(echo "$results" | jq '[.[] | select(.review_priority == "medium")] | length')
low=$(echo "$results" | jq '[.[] | select(.review_priority == "low")] | length')
clean=$(echo "$results" | jq '[.[] | select(.review_priority == "none")] | length')
err_count=$(echo "$errors" | jq 'length')

echo "pkm-lint: high=$high medium=$medium low=$low clean=$clean errors=$err_count" >&2

# Output: all results with issues, sorted by priority (high first)
echo "$results" | jq '[
  .[] | select(.issues | length > 0)
] | sort_by(
  if .review_priority == "high" then 0
  elif .review_priority == "medium" then 1
  elif .review_priority == "low" then 2
  else 3 end
)'

# Print errors to stderr
if [[ "$err_count" -gt 0 ]]; then
  echo "$errors" | jq -r '.[] | "\(.file): \(.error)"' >&2
fi
