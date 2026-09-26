# sample_repo/tests/test_order_service.py
import pytest
from services.order_service import OrderService
from auth.service import AuthService


class FakeUserRepo:
    def __init__(self):
        self._users = {}
    def save(self, u): self._users[u.id] = u
    def find_by_username(self, n): return next((u for u in self._users.values() if u.username == n), None)
    def find_by_id(self, uid): return self._users.get(uid)


class FakeOrderRepo:
    def __init__(self):
        self._orders = {}
    def save(self, o): self._orders[o.id] = o
    def update(self, o): self._orders[o.id] = o
    def find_by_id(self, oid): return self._orders.get(oid)


@pytest.fixture
def services():
    user_repo = FakeUserRepo()
    order_repo = FakeOrderRepo()
    auth = AuthService(user_repo)
    orders = OrderService(order_repo, auth)
    auth.register("alice", "alice@test.com", "pass")
    token = auth.login("alice", "pass")
    return auth, orders, token


def test_create_order(services):
    _, orders, token = services
    order = orders.create_order(token)
    assert order is not None
    assert order.status == "pending"


def test_add_item_to_order(services):
    _, orders, token = services
    order = orders.create_order(token)
    success = orders.add_item(order.id, "prod-1", 2, 9.99)
    assert success is True
    fetched = orders.get_order(order.id)
    assert len(fetched.items) == 1
    assert fetched.total == pytest.approx(19.98)


def test_cancel_order(services):
    _, orders, token = services
    order = orders.create_order(token)
    assert orders.cancel_order(order.id, token) is True
    assert orders.get_order(order.id).status == "cancelled"


def test_create_order_unauthenticated(services):
    _, orders, _ = services
    order = orders.create_order("bad-token")
    assert order is None
