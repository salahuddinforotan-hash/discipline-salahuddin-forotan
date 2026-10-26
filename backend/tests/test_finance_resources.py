import unittest
from datetime import date
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.database import Base, get_db
from app.finance.routes import router as finance_router
from app.models.finance_entry import FinanceEntry
from app.models.user import User


class FinanceResourceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.sessions()
        self.user = User(email="finance-resources@example.com", password_hash="unused", full_name="Finance User")
        self.other_user = User(email="finance-other@example.com", password_hash="unused", full_name="Other User")
        self.db.add_all([self.user, self.other_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.other_user)
        self.app = FastAPI()
        self.app.include_router(finance_router)

        def test_database():
            session = self.sessions()
            try:
                yield session
            finally:
                session.close()

        self.app.dependency_overrides[get_db] = test_database
        self.app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_expense(self, category="Food", amount="65.00", entry_date="2026-10-06", currency="AFN"):
        entry = FinanceEntry(
            user_id=self.user.id,
            kind="expense",
            title="Lunch",
            category=category,
            amount=Decimal(amount),
            currency=currency,
            entry_date=date.fromisoformat(entry_date),
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def test_create_edit_details_and_filter_transactions(self):
        created = self.client.post("/api/finance/", json={
            "kind": "income", "title": "Salary", "category": "Salary", "amount": "25000.00",
            "currency": "AFN", "entry_date": "2026-10-05", "source": "Employer",
        })
        self.assertEqual(created.status_code, 201, created.text)
        transaction_id = created.json()["id"]
        self.assertEqual(created.json()["source"], "Employer")
        self.assertIn("updated_at", created.json())

        edited = self.client.patch(f"/api/finance/{transaction_id}", json={"amount": "27500.00", "notes": "October pay"})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertEqual(Decimal(edited.json()["amount"]), Decimal("27500.00"))
        detail = self.client.get(f"/api/finance/{transaction_id}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["notes"], "October pay")
        page = self.client.get("/api/finance/transactions?kind=income&search=salary&limit=10")
        self.assertEqual(page.status_code, 200, page.text)
        self.assertEqual(page.json()["total"], 1)
        self.assertEqual(page.json()["items"][0]["id"], transaction_id)

    def test_budget_spending_uses_matching_real_transactions_and_user_scope(self):
        self.add_expense(amount="6500.00")
        self.add_expense(category="Transport", amount="500.00")
        budget = self.client.post("/api/finance/budgets", json={
            "category": "Food", "amount": "10000.00", "currency": "AFN", "period": "monthly",
            "start_date": "2026-10-01", "end_date": "2026-10-31",
        })
        self.assertEqual(budget.status_code, 201, budget.text)
        self.assertEqual(Decimal(budget.json()["spent"]), Decimal("6500.00"))
        self.assertEqual(Decimal(budget.json()["remaining"]), Decimal("3500.00"))
        self.assertEqual(budget.json()["percent_used"], 65.0)
        self.assertEqual(budget.json()["status"], "on_track")
        self.app.dependency_overrides[get_current_user] = lambda: self.other_user
        denied = self.client.patch(f"/api/finance/budgets/{budget.json()['id']}", json={"amount": "20000"})
        self.assertEqual(denied.status_code, 404)

    def test_custom_categories_archive_without_rewriting_transaction_history(self):
        entry = self.add_expense(category="Travel")
        category = self.client.post("/api/finance/categories", json={"kind": "expense", "name": "Travel"})
        self.assertEqual(category.status_code, 201, category.text)
        category_id = category.json()["id"]
        self.assertTrue(any(item["name"] == "Travel" for item in self.client.get("/api/finance/categories").json()))
        expense_only = self.client.get("/api/finance/categories", params={"kind": "expense"}).json()
        self.assertTrue(all(item["kind"] == "expense" for item in expense_only))
        self.assertTrue(any(item["name"] == "Travel" for item in expense_only))
        self.assertFalse(any(item["name"] == "Salary" for item in expense_only))
        archived = self.client.delete(f"/api/finance/categories/{category_id}")
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(self.db.get(FinanceEntry, entry.id).category, "Travel")

    def test_savings_and_financial_goal_progress_are_persisted_as_history(self):
        savings = self.client.post("/api/finance/savings", json={
            "name": "Emergency fund", "target_amount": "10000", "initial_amount": "2500", "currency": "AFN",
        })
        self.assertEqual(savings.status_code, 201, savings.text)
        savings_id = savings.json()["id"]
        self.assertEqual(Decimal(savings.json()["current_amount"]), Decimal("2500.00"))
        activity = self.client.post(f"/api/finance/savings/{savings_id}/contributions", json={
            "amount": "500", "activity_date": "2026-10-06", "notes": "Saved this week",
        })
        self.assertEqual(activity.status_code, 201, activity.text)
        self.assertEqual(len(self.client.get("/api/finance/savings").json()[0]["activities"]), 2)

        goal = self.client.post("/api/finance/financial-goals", json={
            "name": "Laptop", "target_amount": "80000", "initial_amount": "35000", "currency": "AFN",
        })
        self.assertEqual(goal.status_code, 201, goal.text)
        goal_id = goal.json()["id"]
        self.assertEqual(goal.json()["progress"], 43.75)
        progress = self.client.post(f"/api/finance/financial-goals/{goal_id}/progress", json={
            "amount": "5000", "activity_date": "2026-10-06",
        })
        self.assertEqual(progress.status_code, 201, progress.text)
        updated = self.client.get("/api/finance/financial-goals").json()[0]
        self.assertEqual(Decimal(updated["current_amount"]), Decimal("40000.00"))
        self.assertEqual(len(updated["progress_history"]), 2)

    def test_recurring_schedule_is_saved_without_creating_a_transaction(self):
        recurring = self.client.post("/api/finance/recurring-transactions", json={
            "name": "Rent", "kind": "expense", "amount": "12000", "currency": "AFN",
            "category": "Housing", "frequency": "monthly", "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01", "is_active": True,
        })
        self.assertEqual(recurring.status_code, 201, recurring.text)
        self.assertEqual(self.client.get("/api/finance/").json(), [])
        self.assertEqual(len(self.client.get("/api/finance/recurring-transactions").json()), 1)

    def test_overview_groups_different_currencies_without_conversion(self):
        self.add_expense(amount="20.00", currency="AFN")
        other = FinanceEntry(
            user_id=self.user.id, kind="income", title="Contract", category="Freelance",
            amount=Decimal("80.00"), currency="USD", entry_date=date(2026, 10, 6),
        )
        self.db.add(other)
        self.db.commit()
        overview = self.client.get("/api/finance/overview")
        self.assertEqual(overview.status_code, 200, overview.text)
        self.assertEqual({item["currency"] for item in overview.json()["current_balances"]}, {"AFN", "USD"})
        self.assertEqual(next(item["amount"] for item in overview.json()["current_balances"] if item["currency"] == "USD"), "80.00")


if __name__ == "__main__":
    unittest.main()
