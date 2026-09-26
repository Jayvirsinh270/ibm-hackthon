"""
backend/analysis/git_analyzer.py
Extracts Git commit history metadata using GitPython.

Produces per-file churn counts and co-change relationships.
Gracefully returns GitData(available=False) when no .git directory exists
or any error occurs — Git analysis is always optional.
"""
from __future__ import annotations
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ── Data models ───────────────────────────────────────────────────────────

@dataclass
class FileGitData:
    file_path: str                     # relative path within the repo
    commit_count: int = 0              # total commits touching this file
    last_changed: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    co_changed_with: list[str] = field(default_factory=list)


@dataclass
class GitData:
    available: bool = False
    files: dict[str, FileGitData] = field(default_factory=dict)


# ── Public API ────────────────────────────────────────────────────────────

def analyze_git(repo_path: str, max_commits: int = 200) -> GitData:
    """
    Walk the Git log for repo_path and return a GitData object.

    max_commits caps how many commits we inspect (keeps it fast for large repos).
    Returns GitData(available=False) on any error.
    """
    try:
        import git  # imported lazily so the rest of the app works without gitpython
        repo = git.Repo(repo_path, search_parent_directories=True)
    except Exception as exc:
        logger.info(f"Git not available at {repo_path}: {type(exc).__name__}")
        return GitData(available=False)

    try:
        return _extract_git_data(repo, max_commits)
    except Exception as exc:
        logger.warning(f"Git analysis failed: {type(exc).__name__}: {exc}")
        return GitData(available=False)


# ── Internal ──────────────────────────────────────────────────────────────

def _extract_git_data(repo, max_commits: int) -> GitData:
    """Walk commits and accumulate per-file stats."""
    commit_counts: dict[str, int] = defaultdict(int)
    last_changed:  dict[str, datetime] = {}
    # co_changes[file] = {other_file: count}
    co_changes: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    commits_seen = 0
    for commit in repo.iter_commits():
        if commits_seen >= max_commits:
            break
        commits_seen += 1

        try:
            changed_files = list(commit.stats.files.keys())
        except Exception:
            continue

        commit_dt = datetime.fromtimestamp(commit.committed_date, tz=timezone.utc)

        for fpath in changed_files:
            commit_counts[fpath] += 1
            # Keep the most-recent change date
            if fpath not in last_changed or commit_dt > last_changed[fpath]:
                last_changed[fpath] = commit_dt

        # Co-change: every pair in the same commit
        for i, fp_a in enumerate(changed_files):
            for fp_b in changed_files[i + 1:]:
                co_changes[fp_a][fp_b] += 1
                co_changes[fp_b][fp_a] += 1

    # Build result
    files: dict[str, FileGitData] = {}
    for fpath, count in commit_counts.items():
        # Top co-changed partners (by frequency, capped at 10)
        partners = sorted(co_changes[fpath].items(), key=lambda x: -x[1])[:10]
        files[fpath] = FileGitData(
            file_path=fpath,
            commit_count=count,
            last_changed=last_changed.get(fpath, datetime.now(timezone.utc)),
            co_changed_with=[p for p, _ in partners],
        )

    logger.info(
        f"Git analysis complete: {commits_seen} commits, {len(files)} files tracked"
    )
    return GitData(available=True, files=files)
