#!/usr/bin/env bash
set -euo pipefail

# Discover source files, generate codemap entries in parallel via axe,
# assemble into .codemap/ at the git root.
#
# Usage:
#   codemap-refresh.sh 'src/**/*.ts' 'lib/**/*.py'
#   find src -name '*.ts' | codemap-refresh.sh
#
# Environment:
#   AXE_AGENTS_DIR  — path to agents directory (default: ./axe/agents)
#   AXE_PARALLEL    — max concurrent axe invocations (default: 4)

AGENTS_DIR="${AXE_AGENTS_DIR:-./axe/agents}"
PARALLEL="${AXE_PARALLEL:-4}"
TMPDIR_BASE="${TMPDIR:-/tmp}/codemap-refresh.$$"

cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT
mkdir -p "$TMPDIR_BASE"

# --- git root + codemap paths ---

GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "codemap-refresh: not in a git repository" >&2
  exit 1
}

CODEMAP_DIR="$GIT_ROOT/.codemap"
CODEMAP_JSON="$CODEMAP_DIR/codemap.json"
CODEMAP_MD="$CODEMAP_DIR/codemap.md"
CODEMAP_META="$CODEMAP_DIR/codemap.meta.json"
mkdir -p "$CODEMAP_DIR"

# --- helpers ---

hash_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
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

# --- file discovery ---

discover_files() {
  if [[ $# -gt 0 ]]; then
    for pattern in "$@"; do
      bash -O globstar -c "printf '%s\n' $pattern" 2>/dev/null || true
    done
  else
    cat
  fi
}

# --- staleness filter ---
# Reads the existing codemap once, hashes each discovered file, emits only stale/new ones.
# Outputs: file<TAB>hash per line

filter_stale() {
  local existing="{}"
  if [[ -f "$CODEMAP_JSON" ]]; then
    existing=$(cat "$CODEMAP_JSON")
  fi

  while IFS= read -r file; do
    [[ -f "$file" ]] || continue
    local hash
    hash=$(hash_file "$file")
    local existing_hash
    existing_hash=$(echo "$existing" | jq -r --arg f "$file" '.[$f].hash // ""')
    if [[ "$hash" != "$existing_hash" ]]; then
      printf '%s\t%s\n' "$file" "$hash"
    fi
  done
}

# --- per-file worker ---

process_file() {
  local file="$1" hash="$2" outdir="$3"
  local safe_name
  safe_name=$(echo "$file" | tr '/' '_')

  local raw_file="/tmp/codemap-raw/$safe_name.out"
  mkdir -p /tmp/codemap-raw

  local raw
  if raw=$(cat "$file" | axe run codemap-entry \
    --agents-dir "$AGENTS_DIR" \
    -p "File: $file" \
    --timeout 300 2>/dev/null); then
    echo "$raw" > "$raw_file"
    local cleaned
    if cleaned=$(echo "$raw" | extract_json); then
      jq -n --arg f "$file" --arg h "$hash" --argjson r "$cleaned" \
        '{($f): ($r + {hash: $h})}' > "$outdir/$safe_name.json"
    else
      echo "{\"error\": \"non-json response\", \"file\": \"$file\"}" > "$outdir/$safe_name.err"
    fi
  else
    echo "axe exited non-zero" > "$raw_file"
    echo "{\"error\": \"axe failed\", \"file\": \"$file\"}" > "$outdir/$safe_name.err"
  fi
}

export -f process_file hash_file extract_json
export AGENTS_DIR

# --- main ---

all_files=$(discover_files "$@" | sort -u | grep -v '^$')

if [[ -z "$all_files" ]]; then
  echo "codemap-refresh: no files to process" >&2
  exit 0
fi

total_count=$(echo "$all_files" | wc -l | tr -d ' ')

# Filter to stale/new files only (reads codemap once)
stale_list=$(echo "$all_files" | filter_stale)
stale_count=$(echo "$stale_list" | grep -c $'\t' || true)

echo "codemap-refresh: $total_count files discovered, $stale_count stale, pool size $PARALLEL" >&2

if [[ "$stale_count" -gt 0 ]]; then
  # Dispatch parallel pool
  active=0
  while IFS=$'\t' read -r file hash; do
    process_file "$file" "$hash" "$TMPDIR_BASE" &
    active=$((active + 1))
    if [[ "$active" -ge "$PARALLEL" ]]; then
      wait -n 2>/dev/null || true
      active=$((active - 1))
    fi
  done <<< "$stale_list"
  wait
fi

# --- assembly ---

# Load existing codemap
existing="{}"
if [[ -f "$CODEMAP_JSON" ]]; then
  existing=$(cat "$CODEMAP_JSON")
fi

# Merge new entries
if ls "$TMPDIR_BASE"/*.json &>/dev/null; then
  new_entries=$(cat "$TMPDIR_BASE"/*.json | jq -s 'add // {}')
else
  new_entries="{}"
fi
merged=$(echo "$existing" "$new_entries" | jq -s '.[0] * .[1]')

# Prune deleted files — only keep entries whose file still exists in the discovered set
merged=$(echo "$merged" | jq --argjson files "$(echo "$all_files" | jq -R -s 'split("\n") | map(select(. != ""))')" '
  with_entries(select(.key as $k | $files | index($k)))
')

echo "$merged" | jq '.' > "$CODEMAP_JSON"

# Generate markdown
echo "$merged" | jq -r '
  to_entries | sort_by(.key)[] |
  "- \(.key)\n  - summary: \(.value.summary // "unknown")\n  - when to use: \(.value.when_to_use // "unknown")\n  - public interface: \(.value.public_interface // [] | join(", "))"
' > "$CODEMAP_MD"

# Write metadata
jq -n \
  --arg globs "$*" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson total "$total_count" \
  --argjson stale "$stale_count" \
  --argjson entries "$(echo "$merged" | jq 'length')" \
  '{globs: $globs, last_run: $timestamp, files_discovered: $total, files_updated: $stale, entries: $entries}' \
  > "$CODEMAP_META"

# Report
if ls "$TMPDIR_BASE"/*.err &>/dev/null; then
  err_count=$(ls "$TMPDIR_BASE"/*.err | wc -l | tr -d ' ')
  echo "codemap-refresh: $err_count files failed:" >&2
  cat "$TMPDIR_BASE"/*.err | jq -r '.file // "unknown"' >&2
else
  err_count=0
fi

update_count=0
if ls "$TMPDIR_BASE"/*.json &>/dev/null; then
  update_count=$(ls "$TMPDIR_BASE"/*.json | wc -l | tr -d ' ')
fi
echo "codemap-refresh: updated $update_count entries, $err_count errors" >&2
echo "codemap-refresh: wrote $CODEMAP_DIR/{codemap.json,codemap.md,codemap.meta.json}" >&2
echo "codemap-refresh: raw outputs in /tmp/codemap-raw/" >&2
