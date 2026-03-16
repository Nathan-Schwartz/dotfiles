#!/usr/bin/env bash
# PKM integrity hook for compound-extension markdown files.
# Validates frontmatter schemas and triggers qmd index updates.
#
# Usage:
#   pkm-integrity-hook.sh file1.synth.md [file2.ref.md ...]
#   pkm-integrity-hook.sh --post-hook  (PostToolUse: validates, updates qmd, exit 2 on failure)
#
# Exit codes:
#   0 — all files valid (or no compound-extension files to check)
#   1 — validation errors found (CLI mode)
#   2 — validation errors found (hook mode — signals block to Claude)
#
# Environment:
#   SCHEMA_FILE — override path to pkm.json schema (default: co-located schemas/pkm.json)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-$SCRIPT_DIR/schemas/pkm.json}"

# --- helpers: detection ---

die() { echo "pkm-integrity-hook: $*" >&2; exit 1; }

get_doc_type() {
  local filepath="$1"
  case "$filepath" in
    *.ref.md)   echo "ref" ;;
    *.synth.md) echo "synth" ;;
    *.temp.md)  echo "temp" ;;
    *.index.md) echo "index" ;;
    *)          echo "" ;;
  esac
}

# --- helpers: validation ---

check_deps() {
  local missing=()
  for cmd in jq yq awk; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "missing dependencies: ${missing[*]}"
  fi
  [[ -f "$SCHEMA_FILE" ]] || die "schema file not found: $SCHEMA_FILE"
}

extract_frontmatter() {
  local file="$1"
  if [[ "$(head -1 "$file")" != "---" ]]; then
    return 1
  fi
  awk 'NR==1 && /^---$/{next} /^---$/{exit} {print}' "$file"
}

validate_file() {
  local file="$1"
  local doc_type
  doc_type=$(get_doc_type "$file")

  if [[ -z "$doc_type" ]]; then
    return 0
  fi

  if [[ ! -f "$file" ]]; then
    echo "$file: file not found"
    return 1
  fi

  local frontmatter
  if ! frontmatter=$(extract_frontmatter "$file") || [[ -z "$frontmatter" ]]; then
    echo "$file: missing YAML frontmatter (must start with ---)"
    return 1
  fi

  local fm_json
  if ! fm_json=$(echo "$frontmatter" | yq -o=json '.' 2>/dev/null) || [[ -z "$fm_json" ]]; then
    echo "$file: invalid YAML in frontmatter"
    return 1
  fi

  local required optional
  required=$(jq -r --arg t "$doc_type" '.types[$t].required // {}' "$SCHEMA_FILE")
  optional=$(jq -r --arg t "$doc_type" '.types[$t].optional // {}' "$SCHEMA_FILE")

  local errors
  errors=$(jq -r --argjson required "$required" --argjson optional "$optional" '
    def check_type($val; $spec):
      if $spec == "string" then
        ($val | type) == "string" and ($val | length) > 0
      elif $spec == "bool" then
        ($val | type) == "boolean"
      elif $spec == "string[]" then
        ($val | type) == "array" and ($val | all(type == "string"))
      elif $spec == "datetime" then
        ($val | type) == "string" and ($val | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}(:[0-9]{2})?(Z|[+-][0-9]{2}:?[0-9]{2})?)?$"))
      elif ($spec | startswith("enum:")) then
        ($val | type) == "string" and ($val | IN(($spec | ltrimstr("enum:") | split(","))[]))
      else true end;

    . as $fm |
    [
      ($required | to_entries[] |
        .key as $field | .value as $spec |
        if $fm | has($field) | not then
          "missing required field: \($field) (\($spec))"
        elif check_type($fm[$field]; $spec) | not then
          "invalid type for \($field): expected \($spec)"
        else empty end
      ),
      ($optional | to_entries[] |
        .key as $field | .value as $spec |
        if ($fm | has($field)) and ($fm[$field] != null) then
          if check_type($fm[$field]; $spec) | not then
            "invalid type for \($field): expected \($spec)"
          else empty end
        else empty end
      )
    ] | .[]
  ' <<< "$fm_json" 2>/dev/null)

  if [[ -n "$errors" ]]; then
    while IFS= read -r err; do
      echo "$file: $err"
    done <<< "$errors"
    return 1
  fi

  return 0
}

# --- helpers: indexing ---

qmd_update() {
  # Trigger qmd index update in the background. Failures are silent —
  # indexing issues should never block writes.
  command -v qmd &>/dev/null || return 0
  qmd update &>/dev/null &
}

# --- main ---

check_deps

mode="cli"
files=()

for arg in "$@"; do
  case "$arg" in
    --post-hook) mode="post" ;;
    *)           files+=("$arg") ;;
  esac
done

# PostToolUse hook: validate after write, then update qmd index
if [[ "$mode" == "post" ]]; then
  input=$(cat)
  file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

  if [[ -z "$file_path" ]]; then
    exit 0
  fi

  doc_type=$(get_doc_type "$file_path")
  if [[ -z "$doc_type" ]]; then
    exit 0
  fi

  errors=$(validate_file "$file_path")
  if [[ -n "$errors" ]]; then
    echo "$errors" >&2
    exit 2
  fi

  qmd_update
  exit 0
fi

# CLI mode
if [[ ${#files[@]} -eq 0 ]]; then
  echo "usage: pkm-integrity-hook.sh [--post-hook] [file ...]" >&2
  exit 1
fi

exit_code=0
for file in "${files[@]}"; do
  errors=$(validate_file "$file")
  if [[ -n "$errors" ]]; then
    echo "$errors"
    exit_code=1
  fi
done

exit "$exit_code"
