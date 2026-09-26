# sample_repo/models/order.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import List


@dataclass
class OrderItem:
    product_id: str
    quantity: int
    unit_price: float

    @property
    def subtotal(self) -> float:
        return self.quantity * self.unit_price


@dataclass
class Order:
    id: str
    user_id: str
    items: List[OrderItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "pending"

    @property
    def total(self) -> float:
        return sum(item.subtotal for item in self.items)

    def add_item(self, item: OrderItem) -> None:
        self.items.append(item)
