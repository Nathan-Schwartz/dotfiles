#!/usr/bin/env python3
"""Generate topic-based Maps of Content (MOCs) from PKM frontmatter.

Scans for *.{ref,synth,temp}.md files, groups by topic, computes backlinks
by inverting sources/related fields, and writes <topic>.index.md files.

MOCs are derived content — always regeneratable from source frontmatter.
Re-running cleans stale generated MOCs and regenerates from current state.

Standard MOC practices (Zettelkasten/LYT):
- One index per topic, serving as a navigational entry point
- Documents grouped by type (synth/ref/temp) within each topic
- Backlinks computed and displayed (never stored in source documents)
- Cross-topic navigation via related topics section
- Summaries displayed inline for token-efficient triage

Usage:
    generate-mocs.py <directory>
    generate-mocs.py <directory> --dry-run
    generate-mocs.py <directory> -o <output-dir>
"""

import argparse
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

SOURCE_EXTENSIONS = (".ref.md", ".synth.md", ".temp.md")


def get_doc_type(filename):
    """Get compound extension type from filename."""
    for ext, dtype in (
        (".ref.md", "ref"),
        (".synth.md", "synth"),
        (".temp.md", "temp"),
    ):
        if filename.endswith(ext):
            return dtype
    return None


def parse_frontmatter(text):
    """Parse YAML frontmatter from markdown text.

    Handles the subset of YAML used in PKM frontmatter:
    scalars (quoted/unquoted), booleans, and lists (inline or multi-line).
    No external dependencies — covers the compound-extension schema fields.
    """
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None

    result = {}
    current_key = None
    current_list = None

    for line in text[4:end].split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Multi-line list continuation: "  - value"
        if stripped.startswith("- ") and current_list is not None:
            current_list.append(stripped[2:].strip().strip('"').strip("'"))
            continue

        # Key: value pair
        m = re.match(r"^([\w][\w-]*)\s*:\s*(.*)", line)
        if not m:
            continue

        key, value = m.group(1), m.group(2).strip()
        current_key = key
        current_list = None

        if not value:
            # Start of a multi-line list
            current_list = []
            result[key] = current_list
        elif value.startswith("[") and value.endswith("]"):
            # Inline list: [a, b, c]
            result[key] = [
                v.strip().strip('"').strip("'")
                for v in value[1:-1].split(",")
                if v.strip()
            ]
        elif value.lower() == "true":
            result[key] = True
        elif value.lower() == "false":
            result[key] = False
        else:
            result[key] = value.strip('"').strip("'")

    return result


def scan_documents(base_dir):
    """Find and parse all PKM source files. Returns list of document dicts."""
    docs = []
    for path in sorted(base_dir.rglob("*.md")):
        doc_type = get_doc_type(path.name)
        if doc_type is None:
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            print(f"  warning: cannot read {path}", file=sys.stderr)
            continue

        fm = parse_frontmatter(text)
        if fm is None:
            print(f"  warning: no frontmatter in {path}", file=sys.stderr)
            continue

        docs.append(
            {
                "path": path,
                "rel": str(path.relative_to(base_dir)),
                "name": path.name,
                "type": doc_type,
                "summary": fm.get("summary", ""),
                "topics": fm.get("topics", [])
                if isinstance(fm.get("topics"), list)
                else [],
                "sources": fm.get("sources", [])
                if isinstance(fm.get("sources"), list)
                else [],
                "related": fm.get("related", [])  # legacy field, read for backlink compat
                if isinstance(fm.get("related"), list)
                else [],
                "status": fm.get("status", ""),
            }
        )

    return docs


def compute_backlinks(docs):
    """Invert sources and related fields across all documents.

    Returns dict mapping reference targets to sets of referencing filenames.
    """
    backlinks = defaultdict(set)
    for doc in docs:
        for ref in doc["sources"] + doc["related"]:
            backlinks[ref].add(doc["name"])
    return backlinks


def find_related_topics(topic, topic_map):
    """Find topics sharing documents with this one, ranked by overlap."""
    my_names = {d["name"] for d in topic_map[topic]}
    related = {}
    for other, other_docs in topic_map.items():
        if other == topic:
            continue
        overlap = sum(1 for d in other_docs if d["name"] in my_names)
        if overlap:
            related[other] = overlap
    return sorted(related.items(), key=lambda x: (-x[1], x[0]))


def format_entry(doc, backlinks, out_dir):
    """Format one document entry for the MOC."""
    link = os.path.relpath(doc["path"], out_dir)
    parts = [f"- [{doc['name']}]({link})"]
    if doc["summary"]:
        parts[0] += f" — {doc['summary']}"
    if doc["status"]:
        parts[0] += f" [{doc['status']}]"

    if doc["sources"]:
        parts.append(f"  - sources: {', '.join(doc['sources'])}")

    # Backlinks: other PKM docs that reference this document
    refs = set()
    for key in (doc["name"], doc["rel"]):
        refs |= backlinks.get(key, set())
    refs.discard(doc["name"])
    if refs:
        parts.append(f"  - referenced by: {', '.join(sorted(refs))}")

    return "\n".join(parts)


def generate_moc(topic, docs, backlinks, topic_map, out_dir):
    """Build MOC markdown content for one topic."""
    now = datetime.now().astimezone().isoformat(timespec="seconds")

    groups = {
        "synth": sorted(
            [d for d in docs if d["type"] == "synth"], key=lambda d: d["name"]
        ),
        "ref": sorted(
            [d for d in docs if d["type"] == "ref"], key=lambda d: d["name"]
        ),
        "temp": sorted(
            [d for d in docs if d["type"] == "temp"], key=lambda d: d["name"]
        ),
    }

    source_list = sorted(set(
        os.path.relpath(d["path"], out_dir) for d in docs
    ))

    lines = [
        "---",
        f'summary: "Map of content for {topic}"',
        "generated: true",
        f'created: "{now}"',
        "topics:",
        f"  - {topic}",
        "sources:",
    ]
    for src in source_list:
        lines.append(f"  - {src}")
    lines += [
        "---",
        "",
        f"# {topic}",
    ]

    section_names = {"synth": "Synths", "ref": "Refs", "temp": "Temps"}
    for dtype in ("synth", "ref", "temp"):
        if not groups[dtype]:
            continue
        lines.append("")
        lines.append(f"## {section_names[dtype]}")
        lines.append("")
        for doc in groups[dtype]:
            lines.append(format_entry(doc, backlinks, out_dir))

    related = find_related_topics(topic, topic_map)
    if related:
        lines.append("")
        lines.append("## Related Topics")
        lines.append("")
        for other_topic, count in related:
            noun = "document" if count == 1 else "documents"
            lines.append(
                f"- [{other_topic}]({other_topic}.index.md) — {count} shared {noun}"
            )

    lines.append("")
    return "\n".join(lines)


def clean_generated_mocs(directory):
    """Remove topic MOCs that were previously generated (generated: true).

    Skips session-*.index.md files — those are created by /to-pkm and
    should not be cleaned by MOC regeneration.
    """
    removed = []
    for path in directory.glob("*.index.md"):
        if path.name.startswith("session-"):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        fm = parse_frontmatter(text)
        if fm and fm.get("generated") is True:
            path.unlink()
            removed.append(path.name)
    return removed


def main():
    parser = argparse.ArgumentParser(
        description="Generate topic MOCs from PKM frontmatter."
    )
    parser.add_argument(
        "directory", nargs="?", default=".", help="Directory to scan (default: .)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without writing files"
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        help="Write index files here (default: same as input directory)",
    )
    args = parser.parse_args()

    base_dir = Path(args.directory).resolve()
    out_dir = Path(args.output_dir).resolve() if args.output_dir else base_dir

    if not base_dir.is_dir():
        print(f"error: not a directory: {base_dir}", file=sys.stderr)
        sys.exit(1)

    # Scan source files
    docs = scan_documents(base_dir)
    if not docs:
        print("No PKM source files found.")
        return

    # Group by topic
    topic_map = defaultdict(list)
    for doc in docs:
        for t in doc["topics"]:
            topic_map[t].append(doc)

    if not topic_map:
        print("No topics found in frontmatter.")
        return

    backlinks = compute_backlinks(docs)

    # Clean stale generated MOCs before writing new ones
    if not args.dry_run:
        removed = clean_generated_mocs(out_dir)
        for name in removed:
            print(f"  cleaned {name}")

    # Generate one MOC per topic
    written = 0
    for topic in sorted(topic_map):
        content = generate_moc(topic, topic_map[topic], backlinks, topic_map, out_dir)
        outfile = out_dir / f"{topic}.index.md"

        if args.dry_run:
            print(f"=== {outfile.name} ===")
            print(content)
        else:
            out_dir.mkdir(parents=True, exist_ok=True)
            outfile.write_text(content, encoding="utf-8")
            print(f"  wrote {outfile.name}")
            written += 1

    summary = f"{len(topic_map)} topics from {len(docs)} documents"
    if args.dry_run:
        print(f"\nWould generate {summary}.")
    else:
        print(f"\nGenerated {summary}.")


if __name__ == "__main__":
    main()
