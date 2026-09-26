"""
backend/analysis/diff_parser.py
Parses unified Git diffs into structured file changes and changed line numbers.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field

# Matches hunk header: @@ -old_start[,old_count] +new_start[,new_count] @@
_HUNK_RE = re.compile(r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@")

# Matches file header lines: diff --git a/path b/path
_GIT_DIFF_RE = re.compile(r"^diff\s+--git\s+(?:a/)?(.*?)\s+(?:b/)?(.*)$")
_OLD_FILE_RE = re.compile(r"^---\s+(?:a/)?(.*)$")
_NEW_FILE_RE = re.compile(r"^\+\+\+\s+(?:b/)?(.*)$")


@dataclass
class FileDiff:
    file_path: str
    change_type: str = "modified"  # "modified", "added", "deleted"
    changed_lines: set[int] = field(default_factory=set)
    raw_hunks: list[str] = field(default_factory=list)


def parse_unified_diff(diff_text: str) -> list[FileDiff]:
    """
    Parse a unified diff string (e.g. from `git diff` or PR patch)
    into a list of FileDiff objects with exact changed line numbers.
    """
    if not diff_text or not diff_text.strip():
        return []

    lines = diff_text.splitlines()
    files: list[FileDiff] = []

    current_file_path: str | None = None
    current_change_type = "modified"
    current_changed_lines: set[int] = set()
    current_hunks: list[str] = []

    current_new_line = 0
    in_hunk = False
    current_hunk_lines: list[str] = []

    def flush_current_file():
        nonlocal current_file_path, current_change_type, current_changed_lines, current_hunks
        if current_file_path:
            # Normalize path (forward slashes, strip quotes)
            clean_path = current_file_path.strip().strip('"\'').replace("\\", "/")
            if clean_path != "/dev/null":
                files.append(
                    FileDiff(
                        file_path=clean_path,
                        change_type=current_change_type,
                        changed_lines=set(current_changed_lines),
                        raw_hunks=list(current_hunks),
                    )
                )
        current_file_path = None
        current_change_type = "modified"
        current_changed_lines = set()
        current_hunks = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check for diff --git header
        git_match = _GIT_DIFF_RE.match(line)
        if git_match:
            flush_current_file()
            # prefer new path unless /dev/null
            old_p, new_p = git_match.group(1), git_match.group(2)
            current_file_path = new_p if new_p != "/dev/null" else old_p
            in_hunk = False
            i += 1
            continue

        # Check for file deleted or new file mode lines
        if "deleted file mode" in line:
            current_change_type = "deleted"
        elif "new file mode" in line:
            current_change_type = "added"

        # Check for --- and +++ lines
        old_match = _OLD_FILE_RE.match(line)
        if old_match and not in_hunk:
            if old_match.group(1) == "/dev/null":
                current_change_type = "added"
            i += 1
            continue

        new_match = _NEW_FILE_RE.match(line)
        if new_match and not in_hunk:
            target_p = new_match.group(1)
            if target_p == "/dev/null":
                current_change_type = "deleted"
            else:
                current_file_path = target_p
            i += 1
            continue

        # Check for hunk header @@ ... @@
        hunk_match = _HUNK_RE.match(line)
        if hunk_match:
            in_hunk = True
            new_start = int(hunk_match.group(3))
            new_count = int(hunk_match.group(4)) if hunk_match.group(4) is not None else 1
            current_new_line = new_start
            current_hunk_lines = [line]

            if new_count == 0:
                # Deletion at new_start
                current_changed_lines.add(max(1, new_start))

            i += 1
            # Process hunk content
            while i < len(lines):
                hunk_line = lines[i]
                if hunk_line.startswith("diff --git") or hunk_line.startswith("@@"):
                    # End of current hunk
                    current_hunks.append("\n".join(current_hunk_lines))
                    break

                current_hunk_lines.append(hunk_line)
                if hunk_line.startswith("+") and not hunk_line.startswith("+++"):
                    current_changed_lines.add(current_new_line)
                    current_new_line += 1
                elif hunk_line.startswith("-") and not hunk_line.startswith("---"):
                    # Deletion line in old file corresponds to current position in new file
                    current_changed_lines.add(max(1, current_new_line))
                else:
                    # Context line
                    current_new_line += 1
                i += 1

            if i >= len(lines) and current_hunk_lines:
                current_hunks.append("\n".join(current_hunk_lines))
            continue

        i += 1

    flush_current_file()
    return files
