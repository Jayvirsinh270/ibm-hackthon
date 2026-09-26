"""
backend/tests/unit/test_git_analyzer.py
Unit tests for the Git analyzer.
"""
from __future__ import annotations
from datetime import datetime

import pytest

from backend.analysis.git_analyzer import analyze_git, GitData, FileGitData


# ── No git directory ──────────────────────────────────────────────────────

class TestNoGit:
    def test_missing_git_returns_unavailable(self, tmp_path):
        plain = tmp_path / "no_git"
        plain.mkdir()
        result = analyze_git(str(plain))
        assert isinstance(result, GitData)
        assert result.available is False
        assert result.files == {}

    def test_nonexistent_path_returns_unavailable(self, tmp_path):
        result = analyze_git(str(tmp_path / "does_not_exist"))
        assert result.available is False


# ── With git repository (uses session-scoped fixture from conftest.py) ────

class TestWithGit:
    def test_available_true(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        assert result.available is True

    def test_files_tracked(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        assert "auth.py" in result.files
        assert "utils.py" in result.files

    def test_commit_count_auth(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        # auth.py was touched in all 3 commits
        assert result.files["auth.py"].commit_count == 3

    def test_commit_count_utils(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        # utils.py was touched in commits 1 and 3
        assert result.files["utils.py"].commit_count == 2

    def test_co_change_detected(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        auth = result.files["auth.py"]
        assert "utils.py" in auth.co_changed_with

    def test_last_changed_is_datetime(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        assert isinstance(result.files["auth.py"].last_changed, datetime)

    def test_max_commits_cap(self, git_repo):
        _, path = git_repo
        result = analyze_git(path, max_commits=1)
        assert result.available is True
        assert len(result.files) >= 1

    def test_empty_repo_does_not_crash(self, tmp_path):
        import git
        git.Repo.init(str(tmp_path / "empty"))
        result = analyze_git(str(tmp_path / "empty"))
        assert isinstance(result, GitData)


# ── FileGitData structure ─────────────────────────────────────────────────

class TestFileGitData:
    def test_structure(self, git_repo):
        _, path = git_repo
        result = analyze_git(path)
        fgd = result.files["auth.py"]
        assert isinstance(fgd, FileGitData)
        assert fgd.file_path == "auth.py"
        assert fgd.commit_count > 0
        assert isinstance(fgd.co_changed_with, list)
