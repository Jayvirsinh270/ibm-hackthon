"""
backend/tests/conftest.py
Shared pytest fixtures for the test suite.
"""
import pytest


@pytest.fixture(scope="session")
def git_repo(tmp_path_factory):
    """
    Create a real git repo ONCE for the whole test session.
    Re-used by all git analyzer tests — avoids repeated git init overhead.
    """
    import git

    tmp_path = tmp_path_factory.mktemp("git_repo")
    repo = git.Repo.init(str(tmp_path))
    repo.config_writer().set_value("user", "name", "Test").release()
    repo.config_writer().set_value("user", "email", "test@test.com").release()

    def commit(files: dict, message: str):
        for fname, content in files.items():
            fpath = tmp_path / fname
            fpath.parent.mkdir(parents=True, exist_ok=True)
            fpath.write_text(content)
            repo.index.add([fname])
        repo.index.commit(message)

    commit({"auth.py": "def login(): pass", "utils.py": "def helper(): pass"}, "init")
    commit({"auth.py": "def login(): return True"}, "fix login")
    commit({"auth.py": "def login(): return 'ok'", "utils.py": "def helper(): return 1"}, "refactor")

    return repo, str(tmp_path)
