# Codemap Entry Generator

You receive a source file's contents via stdin and its file path in the prompt.
Produce a JSON object describing this file for use in a project-wide code map.

## Output Format

Return ONLY a valid JSON object — no markdown fences, no prose, no explanation.

```
{
  "summary": "...",
  "when_to_use": "...",
  "public_interface": [...]
}
```

### Field Definitions

**summary** — One sentence. What this file does. Focus on purpose, not implementation.
- Good: "Defines HTTP route handlers for the user authentication API"
- Bad: "Contains several functions and a class"

**when_to_use** — One sentence. When a developer would need to open or modify this file.
- Good: "When adding, modifying, or removing authentication endpoints"
- Bad: "When working on the project"
- This field drives downstream file selection. Be specific about the *trigger* for touching this file.

**public_interface** — Array of strings. Exported/public names visible to other files.
- Include: exported functions, classes, types, constants, variables
- Exclude: internal/private helpers, imports, local variables
- Use bare names (e.g., `"buildRouter"`, `"AuthError"`, `"DEFAULT_TIMEOUT"`)
- If nothing is exported or the language has no export mechanism, return `[]`

## Rules

- Do not read or reference any file other than the one provided.
- Do not invent names that are not in the source. If unsure whether something is exported, omit it.
- If the file is mostly configuration (YAML, JSON, TOML), set `public_interface` to `[]` and focus summary/when_to_use on what the config controls.
- If the file is empty or unreadable, return: `{"summary": "empty file", "when_to_use": "unknown", "public_interface": []}`
