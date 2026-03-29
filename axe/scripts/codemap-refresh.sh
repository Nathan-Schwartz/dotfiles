#!/usr/bin/env bash
set -euo pipefail

# Discover source files, generate codemap entries in parallel via axe,
# assemble into codemap.json and codemap.md.
#
# Usage:
#   codemap-refresh.sh 'src/**/*.ts' 'lib/**/*.py'
#   find src -name '*.ts' | codemap-refresh.sh
#
# Environment:
#   AXE_AGENTS_DIR  — path to agents directory (default: ./axe/agents)
#   AXE_PARALLEL    — max concurrent axe invocations (default: 4)
#   CODEMAP_JSON    — output path for JSON codemap (default: .codemap.json)
#   CODEMAP_MD      — output path for markdown codemap (default: .codemap.md)

AGENTS_DIR="${AXE_AGENTS_DIR:-./axe/agents}"
PARALLEL="${AXE_PARALLEL:-4}"
CODEMAP_JSON="${CODEMAP_JSON:-.codemap.json}"
CODEMAP_MD="${CODEMAP_MD:-.codemap.md}"
TMPDIR_BASE="${TMPDIR:-/tmp}/codemap-refresh.$$"

cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT
mkdir -p "$TMPDIR_BASE"

# --- file discovery ---

discover_files() {
  if [[ $# -gt 0 ]]; then
    # Glob args: expand each pattern
    for pattern in "$@"; do
      # Use bash globbing (requires globstar for **)
      local files
      files=$(bash -O globstar -c "printf '%s\n' $pattern" 2>/dev/null) || true
      echo "$files"
    done
  else
    # Stdin fallback
    cat
  fi
}

# --- staleness check ---

hash_file() { shasum -a 256 "$1" | cut -d' ' -f1; }

is_stale() {
  local file="$1" hash="$2"
  if [[ ! -f "$CODEMAP_JSON" ]]; then
    return 0
  fi
  local existing
  existing=$(jq -r --arg f "$file" '.[$f].hash // ""' "$CODEMAP_JSON" 2>/dev/null)
  [[ "$hash" != "$existing" ]]
}

# --- per-file worker ---

process_file() {
  local file="$1" outdir="$2"
  local hash
  hash=$(hash_file "$file")

  if ! is_stale "$file" "$hash"; then
    return 0
  fi

  local safe_name
  safe_name=$(echo "$file" | tr '/' '_')
  local raw
  if raw=$(cat "$file" | axe run codemap-entry \
    --agents-dir "$AGENTS_DIR" \
    -p "File: $file" \
    --timeout 300 2>/dev/null); then
    local cleaned
    if cleaned=$(echo "$raw" | extract_json); then
      jq -n --arg f "$file" --arg h "$hash" --argjson r "$cleaned" \
        '{($f): ($r + {hash: $h})}' > "$outdir/$safe_name.json"
    else
      echo "{\"error\": \"non-json response\", \"file\": \"$file\"}" > "$outdir/$safe_name.err"
    fi
  else
    echo "{\"error\": \"axe failed\", \"file\": \"$file\"}" > "$outdir/$safe_name.err"
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

export -f process_file hash_file is_stale extract_json
export AGENTS_DIR CODEMAP_JSON

# --- main ---

file_list=$(discover_files "$@" | sort -u | grep -v '^$')
file_count=$(echo "$file_list" | wc -l | tr -d ' ')

if [[ -z "$file_list" ]]; then
  echo "codemap-refresh: no files to process" >&2
  exit 0
fi

echo "codemap-refresh: discovered $file_count files, pool size $PARALLEL" >&2

# Dispatch parallel pool
echo "$file_list" | xargs -P "$PARALLEL" -I{} bash -c 'process_file "$1" "$2"' _ {} "$TMPDIR_BASE"

# --- assembly ---

# Merge new results with existing codemap
existing="{}"
if [[ -f "$CODEMAP_JSON" ]]; then
  existing=$(cat "$CODEMAP_JSON")
fi

new_entries=$(cat "$TMPDIR_BASE"/*.json 2>/dev/null | jq -s 'add // {}')
merged=$(echo "$existing" "$new_entries" | jq -s '.[0] * .[1]')

echo "$merged" | jq '.' > "$CODEMAP_JSON"

# Generate markdown
echo "$merged" | jq -r '
  to_entries | sort_by(.key)[] |
  "- \(.key)\n  - summary: \(.value.summary // "unknown")\n  - when to use: \(.value.when_to_use // "unknown")\n  - public interface: \(.value.public_interface // [] | join(", "))"
' > "$CODEMAP_MD"

# Report errors
error_count=$(ls "$TMPDIR_BASE"/*.err 2>/dev/null | wc -l | tr -d ' ')
if [[ "$error_count" -gt 0 ]]; then
  echo "codemap-refresh: $error_count files failed:" >&2
  cat "$TMPDIR_BASE"/*.err | jq -r '.file // "unknown"' >&2
fi

stale_count=$(ls "$TMPDIR_BASE"/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "codemap-refresh: updated $stale_count entries, $error_count errors" >&2
echo "codemap-refresh: wrote $CODEMAP_JSON and $CODEMAP_MD" >&2
