# sample_repo/tests/test_auth_service.py
import pytest
from auth.service import AuthService
from auth.hashing import hash_password, verify_password


class FakeUserRepo:
    def __init__(self):
        self._users = {}

    def save(self, user):
        self._users[user.id] = user

    def find_by_username(self, username):
        return next((u for u in self._users.values() if u.username == username), None)

    def find_by_id(self, user_id):
        return self._users.get(user_id)


@pytest.fixture
def auth_service():
    return AuthService(FakeUserRepo())


def test_register_creates_user(auth_service):
    user = auth_service.register("alice", "alice@example.com", "secret123")
    assert user.username == "alice"
    assert user.email == "alice@example.com"
    assert user.id is not None


def test_login_returns_token(auth_service):
    auth_service.register("bob", "bob@example.com", "mypassword")
    token = auth_service.login("bob", "mypassword")
    assert token is not None
    assert len(token) > 0


def test_login_wrong_password(auth_service):
    auth_service.register("charlie", "charlie@example.com", "correct")
    token = auth_service.login("charlie", "wrong")
    assert token is None


def test_login_unknown_user(auth_service):
    token = auth_service.login("nobody", "pass")
    assert token is None


def test_logout_invalidates_token(auth_service):
    auth_service.register("dave", "dave@example.com", "pass123")
    token = auth_service.login("dave", "pass123")
    assert auth_service.logout(token) is True
    assert auth_service.get_current_user(token) is None


def test_get_current_user(auth_service):
    auth_service.register("eve", "eve@example.com", "pass456")
    token = auth_service.login("eve", "pass456")
    user = auth_service.get_current_user(token)
    assert user.username == "eve"
