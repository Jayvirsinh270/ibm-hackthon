# sample_repo/api/orders.py
from services.order_service import OrderService


class OrderRouter:
    """HTTP handlers for order-related endpoints."""

    def __init__(self, order_service: OrderService):
        self.orders = order_service

    def post_create(self, token: str) -> dict:
        """POST /orders"""
        order = self.orders.create_order(token)
        if not order:
            return {"error": "Not authenticated"}
        return {"order_id": order.id, "status": order.status}

    def post_add_item(self, order_id: str, body: dict) -> dict:
        """POST /orders/{id}/items"""
        success = self.orders.add_item(
            order_id,
            product_id=body["product_id"],
            quantity=body["quantity"],
            price=body["unit_price"],
        )
        return {"success": success}

    def get_order(self, order_id: str) -> dict:
        """GET /orders/{id}"""
        order = self.orders.get_order(order_id)
        if not order:
            return {"error": "Order not found"}
        return {
            "order_id": order.id,
            "user_id": order.user_id,
            "status": order.status,
            "total": order.total,
            "items": len(order.items),
        }

    def post_cancel(self, order_id: str, token: str) -> dict:
        """POST /orders/{id}/cancel"""
        success = self.orders.cancel_order(order_id, token)
        return {"success": success}
