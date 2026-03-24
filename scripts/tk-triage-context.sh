#!/usr/bin/env bash
set -e

# Dynamic context helpers for the tk-triage skill.
# Each subcommand produces one section of triage context.
# Single-command invocations avoid permission-check failures on piped/compound commands.

print_section() {
  local label="$1"
  local output="$2"
  echo "$label:"
  if [ -n "$output" ]; then
    echo "$output"
  else
    echo "(none)"
  fi
}

case "${1:-}" in
  ready)
    ready=$(tk ready 2>/dev/null || true)
    blocked=$(tk blocked 2>/dev/null || true)
    print_section "Ready" "$ready"
    echo
    print_section "Blocked" "$blocked"
    ;;
  stale)
    output=$(tk list --status=in_progress 2>/dev/null || true)
    if [ -n "$output" ]; then
      output=$(echo "$output" | grep -v abandoned || true)
    fi
    print_section "Stale in-progress" "$output"
    ;;
  abandoned)
    output=$(tk list -T abandoned 2>/dev/null || true)
    print_section "Abandoned" "$output"
    ;;
  logs)
    log_dir="${RALPH_LOG_DIR:-.ralph/runs}"
    output=""
    if [ -d "$log_dir" ]; then
      for f in "$log_dir"/*.json; do
        [ -e "$f" ] || continue
        output="${output:+$output
}$(basename "${f%.json}")"
      done
    fi
    print_section "Ralph logs" "$output"
    ;;
  *)
    echo "Usage: tk-triage-context.sh {ready|stale|abandoned|logs}" >&2
    exit 1
    ;;
esac
