#!/usr/bin/env bash
# Generate pkm-schema-reference.md from pkm.json.
# Ensures the human-readable schema reference stays in sync with the
# authoritative JSON schema. Run whenever pkm.json changes.
#
# Usage:
#   generate-pkm-reference.sh [output-path ...]
#
# Default output: claude/.claude/references/pkm-schema-reference.md
# Reads from:     scripts/schemas/pkm.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-$SCRIPT_DIR/schemas/pkm.json}"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEFAULT_OUTPUTS=(
  "${REPO_DIR}/claude/.claude/references/pkm-schema-reference.md"
)

[[ -f "$SCHEMA_FILE" ]] || { echo "error: schema not found: $SCHEMA_FILE" >&2; exit 1; }
command -v jq &>/dev/null || { echo "error: jq required" >&2; exit 1; }

if [[ $# -gt 0 ]]; then
  outputs=("$@")
else
  outputs=("${DEFAULT_OUTPUTS[@]}")
fi

content=$(jq -r '
  def hint($field; $hints):
    if $hints[$field] then " — " + $hints[$field] else "" end;

  def format_fields($fields; $hints):
    [$fields | to_entries[] |
      "- `\(.key)` (\(.value))\(hint(.key; $hints))"] | join("\n");

  def ucfirst:
    if length > 0 then (.[:1] | ascii_upcase) + .[1:] else . end;

  def format_type($name; $type):
    "### \($name) (`\($type.extension)`) — \($type.description | split(" — ") | .[0] | ucfirst)\n\n" +
    "\($type.description | split(" — ") | .[1] // "" | ucfirst)\n\n" +
    "**Required frontmatter:**\n" +
    format_fields($type.required; $type.field_hints // {}) + "\n\n" +
    (if ($type.optional | length) > 0 then
      "**Optional:** " +
      ([$type.optional | keys[] | "`\(.)`"] | join(", ")) + "\n\n"
    else "" end) +
    "**Content rules:** \($type.content_rules.principle)\n\n" +
    "**Must NOT contain:**\n" +
    ([$type.content_rules.must_not_contain[] | "- \(.)"] | join("\n")) + "\n\n" +
    "**When in doubt:** \($type.content_rules.when_in_doubt)";

  "<!-- Generated from scripts/schemas/pkm.json — do not edit manually. -->\n" +
  "<!-- Regenerate: scripts/generate-pkm-reference.sh -->\n\n" +
  "# PKM Frontmatter Schema Reference\n\n" +
  "Source: `scripts/schemas/pkm.json`\n\n" +
  "## Compound Extensions\n\n" +
  "Files use compound extensions to declare their type: " +
  ([.compound_extensions[] | "`\(.)`"] | join(", ")) + ".\n\n" +
  "## Types\n\n" +
  format_type("ref"; .types.ref) + "\n\n" +
  format_type("synth"; .types.synth) + "\n\n" +
  format_type("temp"; .types.temp) + "\n\n" +
  format_type("index"; .types.index) + "\n\n" +
  "## Frontmatter `sources` Values\n\n" +
  "Expected to be relative paths from the note itself to referenced PKM notes, or URLs/descriptions for external sources.\n" +
  "`sources` serves as both provenance (where facts came from) and cross-reference (related PKM files)."
' "$SCHEMA_FILE")

for output in "${outputs[@]}"; do
  echo "$content" > "$output"
  echo "Generated: $output"
done
