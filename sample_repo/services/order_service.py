# sample_repo/services/order_service.py
import uuid
from datetime import datetime

from models.order import Order, OrderItem
from models.user import User


class OrderService:
    """Handles order creation, updates, and retrieval."""

    def __init__(self, order_repository, auth_service):
        self.order_repo = order_repository
        self.auth_service = auth_service

    def create_order(self, token: str) -> Order | None:
        """Create a new empty order for an authenticated user."""
        user = self.auth_service.get_current_user(token)
        if not user:
            return None
        order = Order(id=str(uuid.uuid4()), user_id=user.id)
        self.order_repo.save(order)
        return order

    def add_item(self, order_id: str, product_id: str, quantity: int, price: float) -> bool:
        """Add an item to an existing order."""
        order = self.order_repo.find_by_id(order_id)
        if not order:
            return False
        order.add_item(OrderItem(product_id=product_id, quantity=quantity, unit_price=price))
        self.order_repo.update(order)
        return True

    def get_order(self, order_id: str) -> Order | None:
        return self.order_repo.find_by_id(order_id)

    def cancel_order(self, order_id: str, token: str) -> bool:
        """Cancel an order — only the owning user can cancel."""
        user = self.auth_service.get_current_user(token)
        order = self.order_repo.find_by_id(order_id)
        if not user or not order or order.user_id != user.id:
            return False
        order.status = "cancelled"
        self.order_repo.update(order)
        return True
