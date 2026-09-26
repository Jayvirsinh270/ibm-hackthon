# sample_repo/api/users.py
from auth.service import AuthService
from models.user import User


class UserRouter:
    """HTTP handlers for user-related endpoints."""

    def __init__(self, auth_service: AuthService):
        self.auth = auth_service

    def post_register(self, body: dict) -> dict:
        """POST /users/register"""
        user = self.auth.register(
            username=body["username"],
            email=body["email"],
            password=body["password"],
        )
        return {"user_id": user.id, "username": user.username}

    def post_login(self, body: dict) -> dict:
        """POST /users/login"""
        token = self.auth.login(body["username"], body["password"])
        if not token:
            return {"error": "Invalid credentials"}
        return {"token": token}

    def post_logout(self, token: str) -> dict:
        """POST /users/logout"""
        success = self.auth.logout(token)
        return {"success": success}

    def get_me(self, token: str) -> dict:
        """GET /users/me"""
        user = self.auth.get_current_user(token)
        if not user:
            return {"error": "Not authenticated"}
        return user.to_dict()
