#!/usr/bin/env bash
# Discovers directories containing PKM compound-extension files and
# reconciles them with qmd collections.
#
# Usage:
#   qmd-sync.sh [<dir> ...]          — scan specific directories
#   qmd-sync.sh                      — scan all registered collections
#   qmd-sync.sh --embed              — also run qmd embed after sync
#   qmd-sync.sh --discover <root>    — find PKM dirs under <root> and register them
#
# Each directory becomes a qmd collection named after its basename.
# Only compound-extension files are indexed (*.{ref,synth,temp,index}.md).
#
# Context is auto-generated from session index files in each directory.

set -euo pipefail

PKM_MASK="**/*.{ref,synth,temp,index}.md"
DO_EMBED=false
DISCOVER_ROOT=""
DIRS=()

# --- helpers ---

die() { echo "qmd-sync: error: $*" >&2; exit 1; }
info() { echo "qmd-sync: $*"; }

command_exists() { command -v "$1" &>/dev/null; }

usage() {
  echo "Usage: qmd-sync.sh [--embed] [--discover <root>] [<dir> ...]"
  echo ""
  echo "  <dir> ...          Sync specific directories as qmd collections"
  echo "  (no args)          Re-sync all existing qmd collections"
  echo "  --discover <root>  Find dirs containing PKM files under <root> and register"
  echo "  --embed            Run 'qmd embed' after syncing"
  exit 0
}

# --- parse args ---

while [[ $# -gt 0 ]]; do
  case "$1" in
    --embed) DO_EMBED=true; shift ;;
    --discover)
      [[ -n "${2:-}" ]] || die "--discover requires a directory argument"
      DISCOVER_ROOT="$2"; shift 2 ;;
    --help|-h) usage ;;
    -*) die "unknown option: $1" ;;
    *) DIRS+=("$1"); shift ;;
  esac
done

# --- preflight ---

command_exists qmd || die "qmd not found — install via: mise install npm:@tobilu/qmd"

# --- functions ---

get_existing_collections() {
  # Returns "name\tpath" pairs for each registered collection.
  # Parses 'qmd collection list' output which looks like:
  #   name    /path/to/dir (pattern)
  qmd collection list 2>/dev/null | awk 'NF >= 2 && $1 != "No" { print $1 "\t" $2 }'
}

collection_exists() {
  local name="$1"
  qmd collection list 2>/dev/null | awk '{ print $1 }' | grep -qx "$name"
}

derive_collection_name() {
  # Use basename of directory, lowercased, with spaces/dots replaced by hyphens
  local dir="$1"
  basename "$dir" | tr '[:upper:]' '[:lower:]' | tr ' .' '-'
}

has_pkm_files() {
  local dir="$1"
  # Check for any compound-extension files
  local count
  count=$(find "$dir" -maxdepth 5 \( -name "*.ref.md" -o -name "*.synth.md" -o -name "*.temp.md" -o -name "*.index.md" \) -print -quit 2>/dev/null | wc -l)
  [[ "$count" -gt 0 ]]
}

build_context() {
  # Extract a context description from session index files or README in the directory.
  local dir="$1"
  local context=""

  # Try to use summary from the newest session index
  local newest_index
  newest_index=$(find "$dir" -maxdepth 1 -name "session-*.index.md" -print 2>/dev/null | sort -r | head -1)
  if [[ -n "$newest_index" ]]; then
    context=$(awk '/^summary:/{gsub(/^summary: *"?|"$/,""); print; exit}' "$newest_index")
  fi

  # Fall back to counting file types
  if [[ -z "$context" ]]; then
    local refs synths temps
    refs=$(find "$dir" -name "*.ref.md" 2>/dev/null | wc -l | tr -d ' ')
    synths=$(find "$dir" -name "*.synth.md" 2>/dev/null | wc -l | tr -d ' ')
    temps=$(find "$dir" -name "*.temp.md" 2>/dev/null | wc -l | tr -d ' ')
    context="PKM collection: ${refs} refs, ${synths} synths, ${temps} temps"
  fi

  echo "$context"
}

sync_directory() {
  local dir="$1"
  dir="$(cd "$dir" && pwd)" # resolve to absolute path

  local name
  name=$(derive_collection_name "$dir")

  if collection_exists "$name"; then
    info "updating collection '$name' ($dir)"
    qmd update 2>&1 | sed 's/^/  /'
  else
    info "adding collection '$name' ($dir)"
    qmd collection add "$dir" --name "$name" --mask "$PKM_MASK" 2>&1 | sed 's/^/  /'

    # Add context
    local context
    context=$(build_context "$dir")
    if [[ -n "$context" ]]; then
      info "adding context for '$name': $context"
      qmd context add "qmd://$name" "$context" 2>&1 | sed 's/^/  /'
    fi
  fi
}

discover_directories() {
  local root="$1"
  [[ -d "$root" ]] || die "discover root not found: $root"

  info "discovering PKM directories under $root"

  # Find all directories containing compound-extension files
  local dirs_found=()
  while IFS= read -r file; do
    local dir
    dir=$(dirname "$file")
    # Deduplicate: only add if not already in the list
    local already=false
    for d in "${dirs_found[@]+"${dirs_found[@]}"}"; do
      [[ "$d" == "$dir" ]] && { already=true; break; }
    done
    $already || dirs_found+=("$dir")
  done < <(find "$root" -maxdepth 5 \( -name "*.ref.md" -o -name "*.synth.md" -o -name "*.temp.md" \) -print 2>/dev/null)

  if [[ ${#dirs_found[@]} -eq 0 ]]; then
    info "no PKM directories found under $root"
    return
  fi

  info "found ${#dirs_found[@]} PKM director(ies)"
  for dir in "${dirs_found[@]}"; do
    sync_directory "$dir"
  done
}

# --- main ---

if [[ -n "$DISCOVER_ROOT" ]]; then
  discover_directories "$DISCOVER_ROOT"
elif [[ ${#DIRS[@]} -gt 0 ]]; then
  for dir in "${DIRS[@]}"; do
    [[ -d "$dir" ]] || die "directory not found: $dir"
    sync_directory "$dir"
  done
else
  # No args: re-sync all existing collections
  info "updating all existing collections"
  qmd update 2>&1 | sed 's/^/  /'
fi

if $DO_EMBED; then
  info "generating embeddings"
  qmd embed 2>&1 | sed 's/^/  /'
fi

info "done"
