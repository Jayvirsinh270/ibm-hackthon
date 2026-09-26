# sample_repo/auth/service.py
import uuid
from datetime import datetime

from models.user import User
from auth.hashing import hash_password, verify_password


class AuthService:
    """Handles user registration, login, and session management."""

    def __init__(self, user_repository):
        self.user_repo = user_repository
        self._sessions: dict = {}

    def register(self, username: str, email: str, password: str) -> User:
        """Register a new user."""
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            password_hash=hash_password(password),
            created_at=datetime.utcnow(),
        )
        self.user_repo.save(user)
        return user

    def login(self, username: str, password: str) -> str | None:
        """Authenticate a user and return a session token."""
        user = self.user_repo.find_by_username(username)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        token = str(uuid.uuid4())
        self._sessions[token] = user.id
        return token

    def logout(self, token: str) -> bool:
        """Invalidate a session token."""
        if token in self._sessions:
            del self._sessions[token]
            return True
        return False

    def get_current_user(self, token: str) -> User | None:
        """Resolve a session token to a user."""
        user_id = self._sessions.get(token)
        if not user_id:
            return None
        return self.user_repo.find_by_id(user_id)
