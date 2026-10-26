import unittest
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.account.routes import router as account_router
from app.auth.routes import router as auth_router
from app.database import Base, get_db
from app.goals.routes import router as goals_router
from app.habits.routes import router as habits_router
from app.finance.calendar import solar_hijri_month_name
from app.finance.routes import router as finance_router
from app.journal.routes import router as journal_router
from app.models.account_settings import AccountSettings
from app.models.finance_entry import FinanceEntry
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.journal_entry import JournalEntry
from app.models.learning_plan import LearningPlan
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User
from app.notifications.routes import router as notifications_router
from app.notifications.scheduler import check_notifications
from app.tasks.routes import router as tasks_router
from app.timezone import application_timezone


class NotificationAndOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)

        app = FastAPI()
        for router in (auth_router, account_router, tasks_router, goals_router, habits_router, finance_router, journal_router, notifications_router):
            app.include_router(router)

        def test_database():
            db = self.sessions()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = test_database
        self.client = TestClient(app)
        self.first_token, self.first_user = self.register_and_login("first@example.com")
        self.second_token, self.second_user = self.register_and_login("second@example.com")

    def tearDown(self):
        self.client.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def register_and_login(self, email):
        response = self.client.post(
            "/api/auth/register",
            json={"email": email, "full_name": email.split("@")[0], "password": "safe-test-password"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        login = self.client.post(
            "/api/auth/login",
            json={"email": email, "password": "safe-test-password"},
        )
        self.assertEqual(login.status_code, 200, login.text)
        payload = login.json()
        return payload["access_token"], payload["user"]

    @staticmethod
    def headers(token):
        return {"Authorization": f"Bearer {token}"}

    def test_authentication_and_task_goal_habit_crud_keep_existing_fields(self):
        unauthorized = self.client.get("/api/tasks/")
        self.assertEqual(unauthorized.status_code, 401)

        task = self.client.post(
            "/api/tasks/",
            headers=self.headers(self.first_token),
            json={"title": "Review API", "description": "Check deadlines", "due_date": "2026-10-10", "due_time": "19:30:00"},
        )
        self.assertEqual(task.status_code, 200, task.text)
        task_data = task.json()
        self.assertEqual(task_data["due_time"], "19:30:00")
        task_id = task_data["id"]
        self.assertEqual(self.client.get(f"/api/tasks/{task_id}", headers=self.headers(self.second_token)).status_code, 404)
        self.assertEqual(self.client.patch(f"/api/tasks/{task_id}", headers=self.headers(self.second_token), json={"is_completed": True}).status_code, 404)

        goal = self.client.post(
            "/api/goals/",
            headers=self.headers(self.first_token),
            json={"title": "Finish project", "start_date": "2026-09-26", "target_date": "2026-10-30", "target_time": "23:59:00"},
        )
        self.assertEqual(goal.status_code, 200, goal.text)
        self.assertEqual(goal.json()["target_time"], "23:59:00")
        completed = self.client.patch(
            f"/api/goals/{goal.json()['id']}",
            headers=self.headers(self.first_token),
            json={"progress": 100},
        )
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertTrue(completed.json()["is_completed"])
        self.assertIsNotNone(completed.json()["completed_at"])
        self.assertEqual(self.client.get(f"/api/goals/{goal.json()['id']}", headers=self.headers(self.second_token)).status_code, 404)

        habit = self.client.post(
            "/api/habits/",
            headers=self.headers(self.first_token),
            json={"name": "Pay bills", "frequency": "monthly", "day_of_month": 15, "reminder_time": "20:00:00"},
        )
        self.assertEqual(habit.status_code, 200, habit.text)
        self.assertEqual(habit.json()["day_of_month"], 15)
        completion = self.client.post(f"/api/habits/{habit.json()['id']}/complete", headers=self.headers(self.first_token))
        self.assertEqual(completion.status_code, 200, completion.text)

    def test_notification_list_read_and_user_isolation(self):
        with self.sessions() as db:
            first_user = db.query(User).filter(User.id == self.first_user["id"]).one()
            second_user = db.query(User).filter(User.id == self.second_user["id"]).one()
            first = Notification(user_id=first_user.id, type="task_overdue", title="Task overdue", message="Review API was due.", dedupe_key="first-only", created_at=datetime.now(timezone.utc))
            second = Notification(user_id=second_user.id, type="goal_due", title="Goal due", message="Finish project is due.", dedupe_key="second-only", created_at=datetime.now(timezone.utc))
            db.add_all([first, second])
            db.commit()
            first_id = first.id
            second_id = second.id

        listing = self.client.get("/api/notifications/", headers=self.headers(self.first_token))
        self.assertEqual(listing.status_code, 200, listing.text)
        self.assertEqual(listing.json()["unread_count"], 1)
        self.assertEqual([row["title"] for row in listing.json()["items"]], ["Task overdue"])
        self.assertEqual(self.client.patch(f"/api/notifications/{second_id}/read", headers=self.headers(self.first_token)).status_code, 404)
        marked = self.client.patch(f"/api/notifications/{first_id}/read", headers=self.headers(self.first_token))
        self.assertEqual(marked.status_code, 200, marked.text)
        self.assertTrue(marked.json()["is_read"])
        self.assertEqual(self.client.get("/api/notifications/", headers=self.headers(self.first_token)).json()["unread_count"], 0)

        bulk = self.client.patch("/api/notifications/read-all", headers=self.headers(self.second_token))
        self.assertEqual(bulk.status_code, 200, bulk.text)
        self.assertEqual(bulk.json()["updated"], 1)

    def test_finance_and_journal_records_are_scoped_to_the_signed_in_user(self):
        finance = self.client.post(
            "/api/finance/",
            headers=self.headers(self.first_token),
            json={"kind": "expense", "title": "Private expense", "category": "Home", "amount": "25.00", "currency": "AFN", "entry_date": "2026-09-26"},
        )
        self.assertEqual(finance.status_code, 201, finance.text)
        finance_id = finance.json()["id"]
        self.assertEqual(self.client.get("/api/finance/", headers=self.headers(self.second_token)).json(), [])
        self.assertEqual(self.client.patch(f"/api/finance/{finance_id}", headers=self.headers(self.second_token), json={"title": "Changed"}).status_code, 404)

        entry_date = "2026-09-26"
        journal = self.client.put(
            f"/api/journal/{entry_date}",
            headers=self.headers(self.first_token),
            json={"mood": "calm", "answers": {"reflection": "Private entry"}},
        )
        self.assertEqual(journal.status_code, 200, journal.text)
        self.assertEqual(self.client.get(f"/api/journal/{entry_date}", headers=self.headers(self.second_token)).status_code, 404)
        self.assertEqual(self.client.get(f"/api/journal/?start_date={entry_date}&end_date={entry_date}", headers=self.headers(self.second_token)).json(), [])

    def test_overdue_detection_is_persistent_and_idempotent(self):
        tz = application_timezone()
        now = datetime.now(tz).replace(hour=21, minute=0, second=0, microsecond=0)
        past_due = now.date() - timedelta(days=1)
        with self.sessions() as db:
            user = db.query(User).filter(User.id == self.first_user["id"]).one()
            db.add(Task(title="Late item", is_completed=False, due_date=past_due, due_time=time(19, 30), created_at=datetime.now(timezone.utc), user_id=user.id))
            db.add(Goal(title="Late goal", start_date=past_due - timedelta(days=1), target_date=past_due, target_time=time(19, 30), progress=20, is_completed=False, user_id=user.id))
            db.add(Goal(title="Finished goal", start_date=past_due - timedelta(days=1), target_date=past_due, progress=100, is_completed=True, completed_at=datetime.now(timezone.utc), user_id=user.id))
            db.commit()
            created = check_notifications(db, now)
            self.assertGreaterEqual(created, 1)
            overdue = db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "task_overdue").all()
            self.assertEqual(len(overdue), 1)
            self.assertIn("Late item", overdue[0].message)
            self.assertEqual(db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "goal_overdue").count(), 1)
            self.assertEqual(db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "goal_completed").count(), 1)
            self.assertEqual(check_notifications(db, now + timedelta(seconds=45)), 0)
            self.assertEqual(db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "task_overdue").count(), 1)

    def test_finance_limit_alert_uses_solar_hijri_month_and_one_currency(self):
        tz = application_timezone()
        # 2026-10-25 is 1405/8/3; the Solar month started on 2026-10-23.
        now = datetime(2026, 10, 25, 21, 0, tzinfo=tz)
        with self.sessions() as db:
            user = db.query(User).filter(User.id == self.first_user["id"]).one()
            db.add(AccountSettings(user_id=user.id, preferences={"finance": {"monthly_spending_alert": True, "monthly_spending_limit": 1000, "currency": "AFN"}}))
            db.add(FinanceEntry(kind="expense", title="Previous solar month", category="Food", amount=Decimal("900"), currency="AFN", entry_date=date(2026, 10, 5), user_id=user.id))
            db.add(FinanceEntry(kind="expense", title="Other currency", category="Food", amount=Decimal("900"), currency="USD", entry_date=date(2026, 10, 24), user_id=user.id))
            db.commit()
            check_notifications(db, now)
            alerts = db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "finance_limit").all()
            self.assertEqual(alerts, [])

            db.add(FinanceEntry(kind="expense", title="Current solar month", category="Food", amount=Decimal("1200"), currency="AFN", entry_date=date(2026, 10, 24), user_id=user.id))
            db.commit()
            check_notifications(db, now + timedelta(seconds=45))
            alerts = db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "finance_limit").all()
            self.assertEqual(len(alerts), 1)
            self.assertEqual(alerts[0].dedupe_key, "finance-limit:1405-8")
            self.assertIn("AFN 1,200", alerts[0].message)
            self.assertIn(solar_hijri_month_name(8), alerts[0].message)
            self.assertEqual(check_notifications(db, now + timedelta(seconds=90)), 0)
            self.assertEqual(db.query(Notification).filter(Notification.user_id == user.id, Notification.type == "finance_limit").count(), 1)


if __name__ == "__main__":
    unittest.main()
