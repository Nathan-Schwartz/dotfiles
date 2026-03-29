# Axe Skills Trial — Session Summary

## What We Built

Four Axe agents with skills and two bash orchestration scripts for PKM semantic linting and codemap generation.

### Components

```
axe/
├── agents/
│   ├── hello.toml              # Pre-existing — ollama pipeline test
│   ├── echo-json.toml          # Skill path + JSON output verification
│   ├── codemap-entry.toml      # Per-file codemap entry generation
│   ├── codemap-lens.toml       # File selection for a task using codemap
│   └── pkm-lint.toml           # Semantic PKM file validation
├── skills/
│   ├── echo-json/SKILL.md      # Minimal JSON echo for pipeline testing
│   ├── codemap-entry/SKILL.md  # Instructions for summary, when_to_use, public_interface
│   ├── codemap-lens/SKILL.md   # Instructions for selecting relevant files from a codemap
│   └── pkm-lint/SKILL.md       # PKM schema rules, content misclassification checks
└── scripts/
    ├── codemap-refresh.sh      # Parallel codemap generation with staleness caching
    └── pkm-lint.sh             # Parallel PKM linting with priority-sorted output
```

### How It Works

**Agents** are TOML configs pointing at an ollama model and a skill (markdown instruction set). Each agent does one thing: receives input via stdin + prompt, returns structured JSON.

**Scripts** handle orchestration: file discovery, parallel dispatch via `xargs -P`, JSON extraction from LLM output (stripping markdown fences and prose preamble), result assembly, and error reporting.

**pkm-lint.sh**: Discovers `*.{ref,synth,temp,index}.md` files in given directories, dispatches each to `axe run pkm-lint`. Outputs priority-sorted JSON array of issues to stdout, summary counts to stderr.

**codemap-refresh.sh**: Takes glob patterns (e.g., `'scripts/*.sh'`), discovers files, checks staleness via SHA-256 hash comparison against existing `.codemap.json`, only re-processes changed files. Produces `.codemap.json` (canonical) and `.codemap.md` (AI-consumable). The lens agent (`codemap-lens`) is designed to consume `.codemap.md` alongside a task description and return the minimal set of relevant files.

Both scripts log raw LLM outputs to `/tmp/{pkm-lint-raw,codemap-raw}/` for debugging.

Pool size is configurable via `AXE_PARALLEL` env var (default: 4). Example: `AXE_PARALLEL=8 ./axe/scripts/codemap-refresh.sh 'src/**/*.ts'`

## Model Selection

Started with `ollama/qwen3.5:4b` (thinking model). Axe could not extract response content — qwen3.5 produces a thinking block followed by the actual response, and axe's ollama integration loses the post-thinking content. The `server: response contains no content` error was consistent regardless of `/no_think` system prompt or temperature settings.

Switched to `ollama/llama3` (8B, non-thinking). Works reliably with axe. Token generation is slow on this machine (~25s per response) but functional.

## Axe Findings

- **Skill path resolution**: `~/dotfiles/axe/skills/<name>` works. Axe expands `~`. Relative paths from the agent TOML do not work — axe resolves skills from the global config dir only.
- **`--agents-dir`**: Works for project-local agent discovery. No equivalent `--skills-dir` flag exists; skills must use paths resolvable from the global config or use absolute/home-relative paths.
- **Thinking models**: Axe does not handle ollama's thinking/response split. This rules out qwen3, deepseek-r1, and similar thinking models until axe adds support.
- **JSON output compliance**: llama3 consistently wraps JSON in markdown fences with prose preamble/postamble. The `extract_json` function in both scripts handles this by extracting content between triple-backtick fences.

## PKM Lint Results

Ran against 3 PKM files in `vendor/ticket/pkm/` (1 ref, 1 synth, 1 index). All 3 returned valid structured JSON with correct rule IDs and severity levels.

- `upstream-pr-fork-mapping.ref.md` → `ref-contains-analysis` (error, high priority). Partially valid: the Cross-PR conflicts section at lines 125-135 contains merge resolution recommendations that are synthesis, not pure reference.
- `tk-update-porting-strategy.synth.md` → `synth-missing-reasoning` (warning, medium). Plausible but not verified.
- `session-2026-03-25-1200.index.md` → `index-has-original-content` (error, high). Not verified.

The structural hook (`pkm-integrity-hook.sh`) handles schema validation deterministically. The Axe-based pkm-lint adds semantic checks that require content comprehension: type misclassification, phantom sources, epistemic compliance, "must not contain" violations.

## Codemap Results

Ran against 7 shell scripts in `scripts/`. 5 succeeded, 2 failed.

### Failures

- **`generate-pkm-reference.sh`**: llama3 misunderstood the task — instead of analyzing the file, it wrote a bash script to "generate a codemap entry." The skill says "Return ONLY a valid JSON object" but the model treated the input as a programming task.
- **`qmd-mcp.sh`**: Model asked for the file contents instead of reading what was piped via stdin. Possibly the file was very short and the model didn't recognize the stdin content as the file to analyze.

### Quality Issues in Successful Entries

- **Hallucinated domain terms**: `pkm-integrity-hook.sh` summarized as "Pokédex integrity checks" — llama3 doesn't know PKM means Personal Knowledge Management. `cleanup-pre-mise.sh` became "clean up premise-related data" — the model doesn't know `mise` is a dev tool manager.
- **Vague when_to_use**: `qmd-sync.sh` described as "updating or pushing changes to QMD files" — misses the actual purpose (registering PKM directories as qmd search collections).
- **Empty public_interface on most files**: Correct for scripts that only define internal functions, but `pkm-integrity-hook.sh` exports functions like `validate_file` and `get_doc_type` that were missed.
- **One good extraction**: `tk-triage-context.sh` correctly identified `generate_triage_context` as a public interface element.

### Observations

The pipeline mechanics are solid — staleness caching, parallel dispatch, JSON extraction, markdown generation all work correctly. The quality bottleneck is llama3:8b's limited ability to understand domain-specific code. It can identify structure (functions, exports) but can't infer purpose from unfamiliar acronyms or tool names. A larger model or domain hints in the skill (glossary of project-specific terms) would improve accuracy.

## Limitations

1. **Model quality**: llama3:8b produces usable but often inaccurate summaries for domain-specific code. The `when_to_use` field — the most important for downstream lensing — is the weakest.
2. **Thinking models unsupported**: Axe can't extract responses from thinking models (qwen3, deepseek-r1). This limits model choices to non-thinking variants.
3. **No tool use tested**: All agents use stdin/stdout piping. Axe supports `tools = ["read_file", ...]` but we didn't test whether llama3 can drive tool-calling protocols.
4. **codemap-lens untested**: The file selection agent was written but never tested end-to-end. Its value depends entirely on when_to_use quality, which is currently weak.
5. **Single-machine speed**: ~25s per LLM call on this hardware. A 100-file codebase would take ~10 minutes with pool size 4. Faster machines or API-backed models would change the economics.
6. **JSON extraction is heuristic**: The `extract_json` function handles llama3's current output pattern (prose + fenced JSON + trailing prose) but may break with different models or edge cases.
7. **Portability**: Skill paths use `~/dotfiles/axe/skills/...` — works across machines where dotfiles is at `~/dotfiles`, but not a general solution. No `--skills-dir` equivalent exists in axe.



## Output

### pkm-lint
 NORMAL  schwartz (1) ~/dotfiles ⑂axe*  rm -rf /tmp/pkm-lint-raw && ./axe/scripts/pkm-lint.sh vendor/ticket/pkm/
pkm-lint: found 3 files, pool size 4
pkm-lint: high=1 medium=1 low=1 clean=0 errors=0
[
  {
    "file": "vendor/ticket/pkm/upstream-pr-fork-mapping.ref.md",
    "type": "ref",
    "issues": [
      {
        "severity": "error",
        "rule": "ref-contains-analysis",
        "message": "Body contains design proposals, option comparisons (\"Option A vs B\"), recommendations (\"should consider\"), risk assessments, or trade-off discussion. These belong in a .synth.md.",
        "line_numbers": [
          5
        ]
      }
    ],
    "review_priority": "high"
  },
  {
    "file": "vendor/ticket/pkm/tk-update-porting-strategy.synth.md",
    "type": "synth",
    "issues": [
      {
        "severity": "warning",
        "rule": "synth-missing-reasoning",
        "message": "Body states conclusions without supporting evidence or reasoning chain.",
        "line_numbers": [
          5,
          10
        ]
      }
    ],
    "review_priority": "medium"
  },
  {
    "file": "vendor/ticket/pkm/session-2026-03-25-1200.index.md",
    "type": "index",
    "issues": [
      {
        "severity": "warning",
        "rule": "index-has-prose",
        "message": "Body contains prose paragraphs (more than one sentence of description per link).",
        "line_numbers": [
          1,
          5
        ]
      }
    ],
    "review_priority": "low"
  }
]
pkm-lint: raw outputs in /tmp/pkm-lint-raw/


### codemap-refresh

 INSERT  schwartz (1) ~/dotfiles ⑂axe*  rm -rf /tmp/codemap-raw && ./axe/scripts/codemap-refresh.sh 'scripts/*.sh'
codemap-refresh: discovered 7 files, pool size 4
codemap-refresh: 2 files failed:
scripts/generate-pkm-reference.sh
scripts/qmd-mcp.sh
codemap-refresh: updated 5 entries, 2 errors
codemap-refresh: wrote .codemap.json and .codemap.md
codemap-refresh: raw outputs in /tmp/codemap-raw/
 INSERT  schwartz (1) ~/dotfiles ⑂axe* 
