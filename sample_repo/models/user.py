# sample_repo/models/user.py
from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    id: str
    username: str
    email: str
    password_hash: str
    created_at: datetime
    is_active: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
        }
