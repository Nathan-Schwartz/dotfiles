#!/usr/bin/env bash
# PKM integrity hook for compound-extension markdown files.
# Validates frontmatter schemas and body structure, and triggers qmd index updates.
#
# Body checks (structural only — they confirm a slot exists, not that it is filled well):
#   - no phantom sources: every frontmatter `sources` entry is cited in the body
#   - synths carry a section stating what is unverified
#
# Lint checks (--lint only, never block a write):
#   - weak citation: source cited in prose but not as a markdown link target
#   - unresolvable source path: a path-shaped source that does not exist on disk
#   - untagged claims: prose in a ref/synth carrying no epistemic classification
#
# The three lint checks are deliberately out of the blocking tier. Weak citation is
# high-volume across the existing corpus; path resolution depends on which sibling
# repos happen to be checked out, which is machine state rather than file
# correctness; untagged-claim detection is a heuristic. Blocking on any of them
# would trade a precise signal for a noisy one.
#
# Usage:
#   pkm-integrity-hook.sh file1.synth.md [file2.ref.md ...]
#   pkm-integrity-hook.sh --lint [file-or-directory ...]
#   pkm-integrity-hook.sh --post-hook  (PostToolUse: validates, updates qmd, exit 2 on failure)
#
# Directory arguments are walked for compound-extension files.
#
# Exit codes:
#   0 — all files valid (or no compound-extension files to check)
#   1 — validation errors found (CLI mode; in --lint mode, any finding)
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

extract_body() {
  local file="$1"
  awk 'NR==1 && /^---$/{next} f{print} /^---$/{if(!f){f=1}}' "$file"
}

# Body-level checks. Structural only — these confirm a slot exists, never that
# its contents are correct.
validate_body() {
  local file="$1" doc_type="$2" fm_json="$3"
  local body src
  local errors=()

  body=$(extract_body "$file")

  # No phantom sources: every frontmatter `sources` entry must be cited in the
  # body. Schema rule for all four types; previously unenforced.
  while IFS= read -r src; do
    [[ -z "$src" ]] && continue
    grep -qF -- "$src" <<<"$body" ||
      errors+=("phantom source: \"$src\" is listed in frontmatter but never cited in the body")
  done < <(jq -r '.sources[]? // empty' <<<"$fm_json" 2>/dev/null)

  # Synths must state what is unverified. A synth carries Inferred claims by
  # design, so the gap statement is what makes it checkable by a reader.
  if [[ "$doc_type" == "synth" ]]; then
    grep -qiE '^#{2,} .*(unverified|limitation|not checked)' <<<"$body" ||
      errors+=("missing a section stating what is unverified (heading matching: unverified / limitations / not checked)")
  fi

  [[ ${#errors[@]} -eq 0 ]] && return 0
  printf '%s\n' "${errors[@]}"
}

# Strip a citation target down to a comparable path: drop URL fragments and
# trailing :NN or :NN-NN line anchors.
normalize_target() {
  awk '{ sub(/#.*$/, ""); sub(/:[0-9]+(-[0-9]+)?$/, ""); print }'
}

# Markdown link targets appearing in the body, normalized.
link_targets() {
  grep -oE '\]\([^) ]+' <<<"$1" | awk '{ sub(/^\]\(/, ""); print }' | normalize_target
}

# Paragraphs in a ref/synth body carrying no epistemic classification. A heading
# that names a classification tags every paragraph beneath it, which is how
# epistemic-explore structures its output — so section-level tagging counts.
untagged_paragraphs() {
  local body="$1" offset="$2"
  awk -v offset="$offset" '
    # A marker counts only when delimited by whitespace, punctuation, or markup —
    # never when it is part of a longer identifier. Without this, a paragraph
    # documenting a field named `is_email_verified` or `verified_at` reads as
    # classified on the strength of the identifier alone, which silences the check
    # precisely on the files that discuss verification state most.
    #
    # Padding the string lets one expression cover markers at either end. Letters,
    # digits and underscore block a match; hyphen does not, so `Inferred-from-absence`
    # still counts while `is_email_verified` does not. Residual gap: a hyphenated
    # compound such as `non-verified` still reads as tagged.
    function is_marker(s) {
      s = " " tolower(s) " "
      return s ~ /[^a-z0-9_](verified|unverified|inferred|guess|guesses|not checked|limitation|limitations|disproof|disproofs|refuted|narrowed|intact|outside my scope|composed)[^a-z0-9_]/
    }
    function flush() {
      if (buf != "" && !heading_tagged && !is_marker(buf)) {
        untagged++
        if (shown < 3) { lines[shown++] = bufstart + offset }
      }
      buf = ""
    }
    /^[[:space:]]*```/          { flush(); fence = 1 - fence; next }
    fence                       { next }
    /^[[:space:]]*$/            { flush(); next }
    /^#{1,6}[[:space:]]/        { flush(); heading_tagged = is_marker($0); next }
    /^[[:space:]]*\|/           { flush(); next }
    /^[[:space:]]*>/            { flush(); next }
    /^[[:space:]]*(-{3,}|={3,}|\*{3,})[[:space:]]*$/ { flush(); next }
    /^[[:space:]]*<!--/         { flush(); next }
    {
      if (buf == "") bufstart = NR
      buf = buf " " $0
    }
    END {
      flush()
      if (untagged > 0) {
        s = ""
        for (i = 0; i < shown; i++) s = s (i ? ", " : "") lines[i]
        print untagged "\t" s
      }
    }
  ' <<<"$body"
}

# Non-blocking checks. Output is prefixed `lint:` by the caller.
lint_body() {
  local file="$1" doc_type="$2" fm_json="$3"
  local body targets dir src target candidate fm_lines
  local findings=()

  body=$(extract_body "$file")
  targets=$(link_targets "$body")
  dir=$(dirname "$file")

  while IFS= read -r src; do
    [[ -z "$src" ]] && continue

    target=$(normalize_target <<<"$src")

    # Weak citation: present in the body (so not a phantom) but never a link target.
    if grep -qF -- "$src" <<<"$body" && ! grep -qF -- "$target" <<<"$targets"; then
      findings+=("weak citation: \"$src\" is mentioned in the body but never as a markdown link target")
    fi

    # Unresolvable path. Restricted to sources that explicitly assert where they
    # resolve from — `./`, `../`, or absolute. A bare `app/models/user.rb` is
    # conventionally repo-root-relative, not note-relative, and flagging those
    # would bury this check under a naming convention rather than a defect.
    case "$src" in
      ./*|../*|/*) ;;
      *) continue ;;
    esac
    [[ "$target" == /* ]] && candidate="$target" || candidate="$dir/$target"
    [[ -e "$candidate" ]] ||
      findings+=("source path does not resolve: \"$src\" (looked for $candidate)")
  done < <(jq -r '.sources[]? // empty' <<<"$fm_json" 2>/dev/null)

  # Untagged claims. Refs and synths only — temps carry no epistemic burden and
  # indexes carry no claims.
  if [[ "$doc_type" == "ref" || "$doc_type" == "synth" ]]; then
    fm_lines=$(extract_frontmatter "$file" | wc -l | tr -d ' ')
    local untagged count where
    untagged=$(untagged_paragraphs "$body" "$((fm_lines + 2))")
    if [[ -n "$untagged" ]]; then
      count=${untagged%%$'\t'*}
      where=${untagged#*$'\t'}
      findings+=("$count untagged paragraph(s) — no Verified/Inferred/Guess marker on the text or its heading (first at line $where)")
    fi
  fi

  [[ ${#findings[@]} -eq 0 ]] && return 0
  printf '%s\n' "${findings[@]}"
}

lint_file() {
  local file="$1"
  local doc_type
  doc_type=$(get_doc_type "$file")
  [[ -z "$doc_type" ]] && return 0
  [[ -f "$file" ]] || return 0

  local frontmatter fm_json
  frontmatter=$(extract_frontmatter "$file") || return 0
  fm_json=$(echo "$frontmatter" | yq -o=json '.' 2>/dev/null) || return 0
  [[ -z "$fm_json" ]] && return 0

  local findings
  findings=$(lint_body "$file" "$doc_type" "$fm_json")
  [[ -z "$findings" ]] && return 0
  while IFS= read -r f; do
    echo "$file: lint: $f"
  done <<< "$findings"
  return 1
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

  local body_errors
  body_errors=$(validate_body "$file" "$doc_type" "$fm_json")
  if [[ -n "$body_errors" ]]; then
    while IFS= read -r err; do
      echo "$file: $err"
    done <<< "$body_errors"
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
lint=0
args=()

for arg in "$@"; do
  case "$arg" in
    --post-hook) mode="post" ;;
    --lint)      lint=1 ;;
    *)           args+=("$arg") ;;
  esac
done

# Expand directory arguments into the compound-extension files beneath them.
files=()
for arg in "${args[@]+"${args[@]}"}"; do
  if [[ -d "$arg" ]]; then
    while IFS= read -r found; do
      files+=("$found")
    done < <(find "$arg" -type f \
      \( -name '*.ref.md' -o -name '*.synth.md' -o -name '*.temp.md' -o -name '*.index.md' \) \
      | sort)
  else
    files+=("$arg")
  fi
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
  echo "usage: pkm-integrity-hook.sh [--post-hook] [--lint] [file-or-directory ...]" >&2
  exit 1
fi

exit_code=0
for file in "${files[@]}"; do
  errors=$(validate_file "$file")
  if [[ -n "$errors" ]]; then
    echo "$errors"
    exit_code=1
  fi
  if [[ "$lint" -eq 1 ]]; then
    lint_file "$file" || exit_code=1
  fi
done

exit "$exit_code"
