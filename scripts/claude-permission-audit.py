#!/usr/bin/env python3
"""Extract tool permission approval/denial patterns from Claude Code conversation history.

Parses JSONL files in ~/.claude/projects/ and outputs aggregated insights about
tool usage and permission decisions. Use --raw for full JSON output.
"""

import json
import glob
import os
import sys
from collections import defaultdict

PROJECTS_DIR = os.path.expanduser("~/.claude/projects")

REJECTION_TEXT = "The user doesn't want to proceed"
INTERRUPT_TEXT = "Request interrupted by user"

MAX_SUMMARY_LEN = 200

# Recommendation thresholds (main-session data only)
MIN_OCCURRENCES_ROOT = 10
MIN_OCCURRENCES_REPO = 5
MIN_APPROVAL_RATE = 0.95
MIN_PROJECTS_ROOT = 3

# Tools excluded from the report (normal workflow actions, not permission decisions)
EXCLUDED_TOOLS = {"ExitPlanMode", "AskUserQuestion"}

# Bash/python commands with this many lines or more are ad-hoc scripts, not
# allowlist candidates. Filtered from the report (still in --raw).
MAX_COMMAND_LINES = 7

# Commands where the second token is a path/argument, not a subcommand.
# These get a flat aggregate only (no subcommand breakdown).
PATH_ARG_COMMANDS = {
    "cd", "ls", "cat", "head", "tail", "find", "wc", "file", "stat",
    "mkdir", "rm", "rmdir", "cp", "mv", "touch", "chmod", "chown",
    "source", ".", "less", "more", "tree",
}

# Tool name -> input key to use as summary
SUMMARY_KEYS = {
    "Bash": "command",
    "Edit": "file_path",
    "Write": "file_path",
    "Read": "file_path",
    "Glob": "pattern",
    "Grep": "pattern",
    "Agent": "description",
}


def extract_summary(tool_name, tool_input):
    """Extract a human-readable summary and line count from a tool's input dict."""
    if not isinstance(tool_input, dict):
        return "", 1
    key = SUMMARY_KEYS.get(tool_name)
    if key and key in tool_input:
        val = str(tool_input[key])
    else:
        val = ""
        for v in tool_input.values():
            if isinstance(v, str) and v:
                val = v
                break
    return val[:MAX_SUMMARY_LEN], val.count("\n") + 1


def parse_project_name(path):
    """Extract short project name from a JSONL file path."""
    rel = path.replace(PROJECTS_DIR + "/", "")
    project_dir = rel.split("/")[0]
    parts = project_dir.split("-")
    return parts[-1] if parts else project_dir


def parse_session_id(path):
    """Extract session ID from a JSONL file path."""
    basename = os.path.basename(path)
    return basename.replace(".jsonl", "")


def is_subagent(path):
    """Check if a JSONL file is from a subagent."""
    return "/subagents/" in path


def classify_outcome(block):
    """Classify a tool_result block's outcome."""
    if not block.get("is_error"):
        return "approved"
    content = str(block.get("content", ""))
    if REJECTION_TEXT in content:
        return "denied"
    if INTERRUPT_TEXT in content:
        return "interrupted"
    return "error"


def process_file(path):
    """Process a single JSONL file and return tool invocation records."""
    tool_uses = {}
    results = []
    project = parse_project_name(path)
    session_id = parse_session_id(path)
    subagent = is_subagent(path)

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            timestamp = record.get("timestamp", "")
            msg = record.get("message", {})
            if not isinstance(msg, dict):
                continue

            content = msg.get("content", [])
            if not isinstance(content, list):
                continue

            if record.get("type") == "assistant":
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        tool_uses[block["id"]] = {
                            "name": block.get("name", ""),
                            "input": block.get("input", {}),
                            "timestamp": timestamp,
                        }

            elif record.get("type") == "user":
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        tool_use_id = block.get("tool_use_id", "")
                        info = tool_uses.pop(tool_use_id, None)
                        if info is None:
                            continue
                        outcome = classify_outcome(block)
                        summary, cmd_lines = extract_summary(info["name"], info["input"])
                        results.append({
                            "project": project,
                            "session_id": session_id,
                            "is_subagent": subagent,
                            "timestamp": info["timestamp"],
                            "tool": info["name"],
                            "summary": summary,
                            "command_lines": cmd_lines,
                            "outcome": outcome,
                        })

    for tool_use_id, info in tool_uses.items():
        summary, cmd_lines = extract_summary(info["name"], info["input"])
        results.append({
            "project": project,
            "session_id": session_id,
            "is_subagent": subagent,
            "timestamp": info["timestamp"],
            "tool": info["name"],
            "summary": summary,
            "command_lines": cmd_lines,
            "outcome": "no_response",
        })

    return results


def extract_bash_tokens(command):
    """Extract first and second tokens from a bash command."""
    parts = command.split()
    if not parts:
        return "", ""
    first = parts[0]
    second = parts[1] if len(parts) > 1 else ""
    # Strip leading env vars (FOO=bar cmd ...)
    while "=" in first and len(parts) > 1:
        parts = parts[1:]
        first = parts[0]
        second = parts[1] if len(parts) > 1 else ""
    return first, second


def recommend(total, approved, projects):
    """Classify a tool/command group into a recommendation tier."""
    if total < MIN_OCCURRENCES_REPO:
        return "low data"
    rate = approved / total if total > 0 else 0
    if rate < MIN_APPROVAL_RATE:
        return "review"
    if total >= MIN_OCCURRENCES_ROOT and len(projects) >= MIN_PROJECTS_ROOT:
        return "root candidate"
    if total >= MIN_OCCURRENCES_REPO:
        return "repo candidate"
    return "low data"


def fmt_rate(approved, total):
    """Format approval rate as a percentage string."""
    if total == 0:
        return "  n/a"
    return f"{approved / total * 100:5.1f}%"


# Non-Bash tools where the summary is a path — show only the top-level aggregate,
# not per-path breakdown (same rationale as PATH_ARG_COMMANDS).
# Non-Bash tools where per-summary breakdown is suppressed.
FLAT_SUMMARY_TOOLS = set()


def _tool_summary_key(r):
    """Produce a grouping key for a non-Bash tool invocation."""
    summary = r.get("summary", "")
    if not summary:
        return "(no summary)"
    return summary[:120]


def _include_in_report(r):
    """Return False for records that should be excluded from the report."""
    if r["tool"] in EXCLUDED_TOOLS:
        return False
    if r["tool"] == "Bash" and r.get("command_lines", 1) >= MAX_COMMAND_LINES:
        return False
    return True


def print_report(results):
    """Print aggregated permission report."""
    results = [r for r in results if _include_in_report(r)]

    # Split into main vs subagent
    main = [r for r in results if not r["is_subagent"]]
    sub = [r for r in results if r["is_subagent"]]

    print(f"Scanned {len(results)} tool invocations "
          f"({len(main)} main, {len(sub)} subagent)\n")

    # --- Non-Bash tools ---
    print("=" * 78)
    print("NON-BASH TOOLS")
    print("=" * 78)

    tool_groups = defaultdict(lambda: defaultdict(lambda: {
        "main_total": 0, "main_approved": 0,
        "sub_total": 0, "projects": set(),
    }))

    for r in main:
        if r["tool"] == "Bash":
            continue
        key = _tool_summary_key(r)
        s = tool_groups[r["tool"]][key]
        s["main_total"] += 1
        if r["outcome"] == "approved":
            s["main_approved"] += 1
        s["projects"].add(r["project"])

    for r in sub:
        if r["tool"] == "Bash":
            continue
        key = _tool_summary_key(r)
        tool_groups[r["tool"]][key]["sub_total"] += 1

    sorted_tools = sorted(
        tool_groups.items(),
        key=lambda kv: sum(s["main_total"] for s in kv[1].values()),
        reverse=True,
    )

    for tool, summaries in sorted_tools:
        total_main = sum(s["main_total"] for s in summaries.values())
        total_approved = sum(s["main_approved"] for s in summaries.values())
        total_sub = sum(s["sub_total"] for s in summaries.values())
        all_projects = set()
        for s in summaries.values():
            all_projects.update(s["projects"])

        rec = recommend(total_main, total_approved, all_projects)
        projs = ",".join(sorted(all_projects)) if len(all_projects) <= 4 else f"{len(all_projects)} projects"

        print(f"\n{tool}  ({total_main} main, {total_sub} sub, "
              f"{fmt_rate(total_approved, total_main)} approved, "
              f"{projs})  [{rec}]")

        # Skip per-summary breakdown for path-based tools
        if tool in FLAT_SUMMARY_TOOLS:
            continue

        sorted_subs = sorted(
            summaries.items(),
            key=lambda kv: kv[1]["main_total"],
            reverse=True,
        )

        for key, s in sorted_subs:
            if s["main_total"] == 0:
                continue
            sub_projs = ",".join(sorted(s["projects"])) if s["projects"] and len(s["projects"]) <= 3 else ""
            sub_rec = recommend(s["main_total"], s["main_approved"], s["projects"])
            print(f"  {key:<70} {s['main_total']:>5} main  {s['sub_total']:>5} sub  "
                  f"{fmt_rate(s['main_approved'], s['main_total']):>7}  {sub_rec:<16} {sub_projs}")

    # --- Bash commands (hierarchical) ---
    print()
    print("=" * 78)
    print("BASH COMMANDS")
    print("=" * 78)

    # Group by first token -> second token
    bash_groups = defaultdict(lambda: defaultdict(lambda: {
        "main_total": 0, "main_approved": 0,
        "sub_total": 0, "projects": set(),
    }))

    for r in main:
        if r["tool"] != "Bash":
            continue
        first, second = extract_bash_tokens(r["summary"])
        if not first:
            first = "(empty)"
        s = bash_groups[first][second]
        s["main_total"] += 1
        if r["outcome"] == "approved":
            s["main_approved"] += 1
        s["projects"].add(r["project"])

    for r in sub:
        if r["tool"] != "Bash":
            continue
        first, second = extract_bash_tokens(r["summary"])
        if not first:
            first = "(empty)"
        bash_groups[first][second]["sub_total"] += 1

    # Sort top-level by total main invocations
    sorted_groups = sorted(
        bash_groups.items(),
        key=lambda kv: sum(s["main_total"] for s in kv[1].values()),
        reverse=True,
    )

    for cmd, subcmds in sorted_groups:
        # Aggregate top-level stats
        total_main = sum(s["main_total"] for s in subcmds.values())
        total_approved = sum(s["main_approved"] for s in subcmds.values())
        total_sub = sum(s["sub_total"] for s in subcmds.values())
        all_projects = set()
        for s in subcmds.values():
            all_projects.update(s["projects"])

        rec = recommend(total_main, total_approved, all_projects)
        projs = ",".join(sorted(all_projects)) if len(all_projects) <= 4 else f"{len(all_projects)} projects"

        print(f"\n{cmd}  ({total_main} main, {total_sub} sub, "
              f"{fmt_rate(total_approved, total_main)} approved, "
              f"{projs})  [{rec}]")

        # Skip subcommand breakdown for path-argument commands
        if cmd in PATH_ARG_COMMANDS:
            continue

        # Sort subcommands by main count
        sorted_subs = sorted(
            subcmds.items(),
            key=lambda kv: kv[1]["main_total"],
            reverse=True,
        )

        for subcmd, s in sorted_subs:
            # Hide rows with 0 main invocations
            if s["main_total"] == 0:
                continue
            if not subcmd:
                label = "(no subcommand)"
            else:
                label = subcmd
            sub_projs = ",".join(sorted(s["projects"])) if s["projects"] and len(s["projects"]) <= 3 else ""
            sub_rec = recommend(s["main_total"], s["main_approved"], s["projects"])
            print(f"  {label:<30} {s['main_total']:>5} main  {s['sub_total']:>5} sub  "
                  f"{fmt_rate(s['main_approved'], s['main_total']):>7}  {sub_rec:<16} {sub_projs}")

    # --- Denied details ---
    denied = [r for r in main if r["outcome"] == "denied"]
    if denied:
        print()
        print("=" * 78)
        print("DENIED INVOCATIONS (main sessions)")
        print("=" * 78)
        for r in denied:
            summary = r["summary"][:70] if r["summary"] else "(no summary)"
            print(f"  {r['tool']:<20} {r['project']:<15} {summary}")


def main():
    raw = "--raw" in sys.argv

    paths = glob.glob(
        os.path.join(PROJECTS_DIR, "**", "*.jsonl"), recursive=True
    )
    paths = sorted(set(paths))

    all_results = []
    for path in paths:
        all_results.extend(process_file(path))

    if raw:
        json.dump(all_results, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print_report(all_results)


if __name__ == "__main__":
    main()
