import unittest
from datetime import date, datetime
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.database import Base, get_db
from app.finance.calendar import gregorian_to_solar_hijri
from app.finance.routes import router as finance_router
from app.models.finance_entry import FinanceEntry
from app.models.user import User


class SolarHijriCalendarTests(unittest.TestCase):
    def test_afghan_solar_month_names_and_month_boundaries(self):
        self.assertEqual(gregorian_to_solar_hijri(date(2026, 9, 29)), (1405, 7, 7))
        self.assertEqual(gregorian_to_solar_hijri(date(2026, 10, 22)), (1405, 7, 30))
        self.assertEqual(gregorian_to_solar_hijri(date(2026, 10, 23)), (1405, 8, 1))

    def test_leap_year_and_year_boundaries(self):
        self.assertEqual(gregorian_to_solar_hijri(date(2025, 3, 20)), (1403, 12, 30))
        self.assertEqual(gregorian_to_solar_hijri(date(2025, 3, 21)), (1404, 1, 1))
        self.assertEqual(gregorian_to_solar_hijri(date(2026, 3, 20)), (1404, 12, 29))
        self.assertEqual(gregorian_to_solar_hijri(date(2026, 3, 21)), (1405, 1, 1))


class FinanceMonthlyReportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.sessions()
        self.user = User(
            email="reports@example.com",
            password_hash="not-used-by-this-test",
            full_name="Reports User",
        )
        self.other_user = User(
            email="other-reports@example.com",
            password_hash="not-used-by-this-test",
            full_name="Other User",
        )
        self.db.add_all([self.user, self.other_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.other_user)

        app = FastAPI()
        app.include_router(finance_router)

        def test_database():
            session = self.sessions()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = test_database
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_entry(self, *, user, kind, title, amount, entry_date):
        self.db.add(
            FinanceEntry(
                user_id=user.id,
                kind=kind,
                title=title,
                category="Salary" if kind == "income" else "Housing",
                amount=Decimal(amount),
                currency="AFN",
                entry_date=date.fromisoformat(entry_date),
                created_at=datetime(2026, 9, 29),
            )
        )
        self.db.commit()

    def test_reports_group_real_records_by_solar_month_and_preserve_user_scope(self):
        self.add_entry(user=self.user, kind="income", title="September salary", amount="640", entry_date="2026-09-29")
        self.add_entry(user=self.user, kind="expense", title="Rent", amount="350", entry_date="2026-10-01")
        self.add_entry(user=self.user, kind="income", title="Next month work", amount="80", entry_date="2026-10-23")
        self.add_entry(user=self.other_user, kind="income", title="Private salary", amount="999", entry_date="2026-09-29")

        listing = self.client.get("/api/finance/monthly-reports")
        self.assertEqual(listing.status_code, 200, listing.text)
        summaries = listing.json()
        self.assertEqual([(item["solar_year"], item["solar_month"]) for item in summaries], [(1405, 8), (1405, 7)])
        mizan = summaries[1]
        self.assertEqual(mizan["month_name"], "میزان")
        self.assertEqual(Decimal(mizan["total_income"]), Decimal("640.00"))
        self.assertEqual(Decimal(mizan["total_expenses"]), Decimal("350.00"))
        self.assertEqual(Decimal(mizan["balance"]), Decimal("290.00"))
        self.assertEqual(mizan["income_count"], 1)
        self.assertEqual(mizan["expense_count"], 1)

        detail = self.client.get("/api/finance/monthly-reports/1405/7")
        self.assertEqual(detail.status_code, 200, detail.text)
        report = detail.json()
        self.assertEqual([row["title"] for row in report["income_transactions"]], ["September salary"])
        self.assertEqual([row["title"] for row in report["expense_transactions"]], ["Rent"])
        self.assertEqual([row["entry_date"] for row in report["transactions"]], ["2026-10-01", "2026-09-29"])
        self.assertNotIn("Private salary", [row["title"] for row in report["transactions"]])

    def test_empty_month_returns_a_clean_empty_report(self):
        response = self.client.get("/api/finance/monthly-reports/1405/12")
        self.assertEqual(response.status_code, 200, response.text)
        report = response.json()
        self.assertEqual(report["month_name"], "حوت")
        self.assertEqual(Decimal(report["total_income"]), Decimal("0"))
        self.assertEqual(Decimal(report["total_expenses"]), Decimal("0"))
        self.assertEqual(Decimal(report["balance"]), Decimal("0"))
        self.assertEqual(report["transactions"], [])

    def test_invalid_month_is_rejected(self):
        self.assertEqual(self.client.get("/api/finance/monthly-reports/1405/13").status_code, 422)

    def test_new_income_and_expense_are_included_in_the_monthly_report(self):
        income = self.client.post(
            "/api/finance/",
            json={
                "kind": "income",
                "title": "New salary",
                "category": "Salary",
                "amount": "640.00",
                "currency": "AFN",
                "entry_date": "2026-09-29",
            },
        )
        expense = self.client.post(
            "/api/finance/",
            json={
                "kind": "expense",
                "title": "Electricity",
                "category": "Utilities",
                "amount": "175.00",
                "currency": "AFN",
                "entry_date": "2026-10-01",
            },
        )
        self.assertEqual(income.status_code, 201, income.text)
        self.assertEqual(expense.status_code, 201, expense.text)

        report = self.client.get("/api/finance/monthly-reports/1405/7")
        self.assertEqual(report.status_code, 200, report.text)
        payload = report.json()
        self.assertEqual(Decimal(payload["total_income"]), Decimal("640.00"))
        self.assertEqual(Decimal(payload["total_expenses"]), Decimal("175.00"))
        self.assertEqual(Decimal(payload["balance"]), Decimal("465.00"))
        self.assertEqual(len(payload["transactions"]), 2)


if __name__ == "__main__":
    unittest.main()
