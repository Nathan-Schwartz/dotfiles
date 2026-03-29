#!/usr/bin/env bash
set -euo pipefail

# Discover PKM compound-extension files and lint them in parallel via axe.
#
# Usage:
#   pkm-lint.sh [directory ...]          # scan directories for *.{ref,synth,temp,index}.md
#   pkm-lint.sh --json [directory ...]   # machine-readable JSON output
#   find notes -name '*.ref.md' | pkm-lint.sh   # stdin fallback
#
# Environment:
#   AXE_AGENTS_DIR  — path to agents directory (default: ./axe/agents)
#   AXE_PARALLEL    — max concurrent axe invocations (default: 4)

OUTPUT_JSON=false
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

  local raw_file="/tmp/pkm-lint-raw/$safe_name.out"
  mkdir -p /tmp/pkm-lint-raw

  local raw
  if raw=$(cat "$file" | axe run pkm-lint \
    --agents-dir "$AGENTS_DIR" \
    -p "File: $file" \
    --timeout 300 2>/dev/null); then
    echo "$raw" > "$raw_file"
    local cleaned
    if cleaned=$(echo "$raw" | extract_json); then
      echo "$cleaned" > "$outdir/$safe_name.json"
    else
      jq -n --arg f "$file" --arg r "$raw" \
        '{file: $f, error: "non-json response"}' > "$outdir/$safe_name.err"
    fi
  else
    echo "axe exited non-zero" > "$raw_file"
    jq -n --arg f "$file" '{file: $f, error: "axe failed"}' > "$outdir/$safe_name.err"
  fi
}

# Strip prose preamble and markdown fences from LLM output, extract JSON.
extract_json() {
  local input
  input=$(cat)
  local attempt
  # Try 1: raw JSON (no fences)
  if attempt=$(echo "$input" | sed -n '/^[{\[]/,/^[}\]]/p' | jq '.' 2>/dev/null) && [[ -n "$attempt" ]]; then
    echo "$attempt"
    return 0
  fi
  # Try 2: extract content between ``` fences
  if attempt=$(echo "$input" | sed -n '/^```/,/^```/{
/^```/d
p
}' | jq '.' 2>/dev/null) && [[ -n "$attempt" ]]; then
    echo "$attempt"
    return 0
  fi
  return 1
}

export -f lint_file extract_json
export AGENTS_DIR

# --- main ---

# Parse flags
dirs=()
for arg in "$@"; do
  case "$arg" in
    --json) OUTPUT_JSON=true ;;
    *)      dirs+=("$arg") ;;
  esac
done

file_list=$(discover_files "${dirs[@]}" | sort -u | grep -v '^$')
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
if ls "$TMPDIR_BASE"/*.json &>/dev/null; then
  results=$(cat "$TMPDIR_BASE"/*.json | jq -s '.')
else
  results="[]"
fi

if ls "$TMPDIR_BASE"/*.err &>/dev/null; then
  errors=$(cat "$TMPDIR_BASE"/*.err | jq -s '.')
else
  errors="[]"
fi

# Sort by priority
sorted=$(echo "$results" | jq '[
  .[] | select(.issues | length > 0)
] | sort_by(
  if .review_priority == "high" then 0
  elif .review_priority == "medium" then 1
  elif .review_priority == "low" then 2
  else 3 end
)')

# Counts
high=$(echo "$results" | jq -r '[.[] | select(.review_priority == "high")] | length')
medium=$(echo "$results" | jq -r '[.[] | select(.review_priority == "medium")] | length')
low=$(echo "$results" | jq -r '[.[] | select(.review_priority == "low")] | length')
clean=$(echo "$results" | jq -r '[.[] | select(.review_priority == "none")] | length')
err_count=$(echo "$errors" | jq -r 'length')

if [[ "$OUTPUT_JSON" == true ]]; then
  echo "$sorted"
else
  # Human-readable linter output with color
  RED=$'\033[31m'
  YELLOW=$'\033[33m'
  RESET=$'\033[0m'

  echo "$sorted" | jq -r '.[] |
    "\(.file)",
    (.issues[] |
      "  Lines: \(.line_numbers // [0] | map(tostring) | join(","))  \(.severity)  \(.rule)  \(.message)"
    ),
    ""' | sed \
      -e "s/  error  /  ${RED}error${RESET}  /" \
      -e "s/  warning  /  ${YELLOW}warning${RESET}  /"

  echo "high=${RED}${high}${RESET} medium=${YELLOW}${medium}${RESET} low=$low clean=$clean errors=$err_count"
fi

# Errors to stderr
if [[ "$err_count" -gt 0 ]]; then
  echo "$errors" | jq -r '.[] | "\(.file): \(.error)"' >&2
fi

echo "pkm-lint: raw outputs in /tmp/pkm-lint-raw/" >&2
