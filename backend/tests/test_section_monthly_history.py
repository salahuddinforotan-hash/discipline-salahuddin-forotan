import unittest
from datetime import date, datetime, time
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.account.schemas import AppSettingsPayload
from app.database import Base, get_db, upgrade_productivity_columns
from app.finance.calendar import gregorian_to_solar_hijri
from app.finance.routes import router as finance_router
from app.goals.routes import router as goals_router
from app.habits.routes import router as habits_router
from app.journal.routes import router as journal_router
from app.learning.routes import router as learning_router
from app.models.finance_entry import FinanceEntry
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.journal_entry import JournalEntry
from app.models.learning_plan import LearningPlan
from app.models.task import Task
from app.models.user import User
from app.tasks.routes import router as tasks_router
from app.timezone import application_today


class SectionMonthlyHistoryTests(unittest.TestCase):
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
            email="history@example.com",
            password_hash="not-used-by-this-test",
            full_name="History User",
        )
        self.other_user = User(
            email="other-history@example.com",
            password_hash="not-used-by-this-test",
            full_name="Other User",
        )
        self.db.add_all([self.user, self.other_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.other_user)

        self.task = Task(
            title="Finish report",
            description="Write monthly summary",
            due_date=date(2026, 9, 29),
            due_time=time(19, 30),
            is_completed=True,
            created_at=datetime(2026, 9, 29, 8),
            user_id=self.user.id,
        )
        self.goal = Goal(
            title="Complete reading goal",
            description="Finish the selected book",
            start_date=date(2026, 9, 29),
            target_date=date(2026, 10, 20),
            target_time=time(23, 59),
            progress=100,
            is_completed=True,
            completed_at=datetime(2026, 10, 2, 17),
            created_at=datetime(2026, 9, 29, 9),
            user_id=self.user.id,
        )
        self.habit = Habit(
            name="Read every day",
            description="Read before bed",
            frequency="daily",
            is_active=True,
            current_streak=1,
            longest_streak=3,
            created_at=datetime(2026, 9, 29, 9),
            user_id=self.user.id,
        )
        self.learning = LearningPlan(
            title="Deep Work",
            author="Cal Newport",
            total_pages=300,
            current_page=30,
            started_on=date(2026, 9, 29),
            target_date=date(2026, 11, 1),
            study_start_time=time(20),
            study_end_time=time(21),
            study_days_per_week=5,
            created_at=datetime(2026, 9, 29, 10),
            user_id=self.user.id,
        )
        self.journal = JournalEntry(
            entry_date=date(2026, 9, 29),
            mood="motivated",
            answers={"What did I learn?": "Keep showing up."},
            tasks_completed=1,
            tasks_total=2,
            habits_completed=1,
            habits_total=1,
            active_goals=1,
            goal_progress=40,
            discipline_score=78,
            created_at=datetime(2026, 9, 29, 21),
            updated_at=datetime(2026, 9, 29, 21),
            user_id=self.user.id,
        )
        self.finance_income = FinanceEntry(
            kind="income",
            title="Salary",
            category="Salary",
            amount=Decimal("640.00"),
            currency="AFN",
            entry_date=date(2026, 9, 29),
            user_id=self.user.id,
        )
        self.finance_expense = FinanceEntry(
            kind="expense",
            title="Rent",
            category="Housing",
            amount=Decimal("240.00"),
            currency="AFN",
            entry_date=date(2026, 10, 2),
            user_id=self.user.id,
        )
        self.db.add_all([
            self.task,
            self.goal,
            self.habit,
            self.learning,
            self.journal,
            self.finance_income,
            self.finance_expense,
        ])
        self.db.commit()
        for row in [self.task, self.goal, self.habit, self.learning, self.journal]:
            self.db.refresh(row)
        self.db.add(
            HabitCompletion(
                habit_id=self.habit.id,
                completion_date=date(2026, 10, 1),
                created_at=datetime(2026, 10, 1, 21),
            )
        )
        self.db.add(
            Task(
                title="Another person's task",
                due_date=date(2026, 9, 29),
                created_at=datetime(2026, 9, 29),
                user_id=self.other_user.id,
            )
        )
        self.db.commit()

        app = FastAPI()
        for router in (
            tasks_router,
            goals_router,
            habits_router,
            learning_router,
            finance_router,
            journal_router,
        ):
            app.include_router(router)

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

    def test_each_section_lists_and_opens_real_solar_month_records(self):
        section_urls = {
            "tasks": "/api/tasks/monthly-history",
            "goals": "/api/goals/monthly-history",
            "habits": "/api/habits/monthly-history",
            "learning": "/api/learning/monthly-history",
            "journal": "/api/journal/monthly-history",
            "income": "/api/finance/monthly-reports",
        }
        for section, url in section_urls.items():
            with self.subTest(section=section):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200, response.text)
                months = response.json()
                self.assertTrue(months)
                self.assertEqual(months[0]["solar_year"], 1405)
                self.assertEqual(months[0]["solar_month"], 7)

        tasks = self.client.get("/api/tasks/monthly-history/1405/7")
        self.assertEqual(tasks.status_code, 200, tasks.text)
        self.assertEqual(tasks.json()["completed_tasks"], 1)
        self.assertEqual([row["title"] for row in tasks.json()["tasks"]], ["Finish report"])

        goals = self.client.get("/api/goals/monthly-history/1405/7")
        self.assertEqual(goals.status_code, 200, goals.text)
        self.assertEqual(goals.json()["started_count"], 1)
        self.assertEqual(goals.json()["completed_count"], 1)
        self.assertEqual([row["title"] for row in goals.json()["goals"]], ["Complete reading goal"])

        habits = self.client.get("/api/habits/monthly-history/1405/7")
        self.assertEqual(habits.status_code, 200, habits.text)
        self.assertEqual(habits.json()["completion_count"], 1)
        self.assertEqual(habits.json()["completions"][0]["completion_date"], "2026-10-01")

        learning = self.client.get("/api/learning/monthly-history/1405/7")
        self.assertEqual(learning.status_code, 200, learning.text)
        self.assertEqual(learning.json()["plans"][0]["title"], "Deep Work")
        self.assertEqual(learning.json()["plans"][0]["current_page"], 30)

        journal = self.client.get("/api/journal/monthly-history/1405/7")
        self.assertEqual(journal.status_code, 200, journal.text)
        self.assertEqual(journal.json()["entry_count"], 1)
        self.assertEqual(journal.json()["entries"][0]["answers"]["What did I learn?"], "Keep showing up.")

        income = self.client.get("/api/finance/monthly-reports/1405/7")
        self.assertEqual(income.status_code, 200, income.text)
        self.assertEqual(income.json()["total_income"], "640.00")
        self.assertEqual(income.json()["total_expenses"], "240.00")
        self.assertEqual(income.json()["balance"], "400.00")

    def test_learning_page_changes_are_saved_as_dated_history(self):
        update = self.client.patch(
            f"/api/learning/{self.learning.id}",
            json={"current_page": 38},
        )
        self.assertEqual(update.status_code, 200, update.text)
        self.assertEqual(update.json()["current_page"], 38)

        year, month, _ = gregorian_to_solar_hijri(application_today())
        detail = self.client.get(f"/api/learning/monthly-history/{year}/{month}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["pages_advanced"], 8)
        self.assertEqual(detail.json()["progress_updates"], 1)
        self.assertEqual(detail.json()["progress_updates_detail"][0]["from_page"], 30)
        self.assertEqual(detail.json()["progress_updates_detail"][0]["to_page"], 38)

    def test_completed_tasks_record_timestamp_and_are_user_scoped(self):
        created = self.client.post("/api/tasks/", json={"title": "Finish integration"})
        self.assertEqual(created.status_code, 200, created.text)
        task_id = created.json()["id"]
        completed = self.client.patch(f"/api/tasks/{task_id}", json={"is_completed": True})
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertIsNotNone(completed.json()["completed_at"])
        rows = self.client.get("/api/tasks/completed").json()
        self.assertIn(task_id, [row["id"] for row in rows])
        self.assertNotIn("Another person's task", [row["title"] for row in rows])

    def test_goal_progress_is_additive_and_monthly_history_keeps_entries(self):
        created = self.client.post("/api/goals/", json={
            "title": "Learn Python", "target_amount": 100, "unit": "hours",
            "start_date": "2026-10-01", "target_date": "2026-10-31",
        })
        self.assertEqual(created.status_code, 200, created.text)
        goal_id = created.json()["id"]
        for amount in (35, 2):
            added = self.client.post(f"/api/goals/{goal_id}/progress", json={
                "amount": amount, "entry_date": "2026-10-02", "note": "Study session",
            })
            self.assertEqual(added.status_code, 200, added.text)
        current = next(item for item in self.client.get("/api/goals/").json() if item["id"] == goal_id)
        self.assertEqual(current["current_amount"], 37)
        self.assertEqual(current["progress"], 37)
        history = self.client.get(f"/api/goals/{goal_id}/progress")
        self.assertEqual([row["amount"] for row in history.json()], [2, 35])
        report = self.client.get("/api/goals/monthly-history/1405/7")
        self.assertEqual(report.status_code, 200, report.text)
        self.assertEqual(len([row for row in report.json()["progress_entries"] if row["goal_id"] == goal_id]), 2)
        changed_unit = self.client.patch(f"/api/goals/{goal_id}", json={"unit": "pages"})
        self.assertEqual(changed_unit.status_code, 409)

    def test_existing_percentage_goal_updates_are_saved_without_erasing_progress(self):
        created = self.client.post("/api/goals/", json={"title": "Legacy goal"})
        self.assertEqual(created.status_code, 200, created.text)
        goal_id = created.json()["id"]
        increased = self.client.patch(f"/api/goals/{goal_id}", json={"progress": 35})
        self.assertEqual(increased.status_code, 200, increased.text)
        self.assertEqual(increased.json()["current_amount"], 35)
        events = self.client.get(f"/api/goals/{goal_id}/progress").json()
        self.assertEqual([(row["amount"], row["unit"]) for row in events], [(35, "%")])
        decreased = self.client.patch(f"/api/goals/{goal_id}", json={"progress": 20})
        self.assertEqual(decreased.status_code, 409)

    def test_measurable_habit_saves_entries_and_completes_at_target(self):
        created = self.client.post("/api/habits/", json={
            "name": "Running", "frequency": "daily", "tracking_type": "measurable",
            "daily_target": 5, "target_unit": "km",
        })
        self.assertEqual(created.status_code, 200, created.text)
        habit_id = created.json()["id"]
        for amount in (2, 3):
            added = self.client.post(f"/api/habits/{habit_id}/progress", json={
                "amount": amount, "entry_date": "2026-10-03",
            })
            self.assertEqual(added.status_code, 200, added.text)
        completions = self.client.get(f"/api/habits/{habit_id}/completions")
        self.assertEqual(completions.status_code, 200, completions.text)
        self.assertIn("2026-10-03", [row["completion_date"] for row in completions.json()])
        progress = self.client.get(f"/api/habits/{habit_id}/progress")
        self.assertEqual(sum(row["amount"] for row in progress.json()), 5)
        report = self.client.get("/api/habits/monthly-history/1405/7")
        self.assertEqual(report.status_code, 200, report.text)
        self.assertEqual(len([row for row in report.json()["progress_entries"] if row["habit_id"] == habit_id]), 2)
        changed_unit = self.client.patch(f"/api/habits/{habit_id}", json={"target_unit": "miles"})
        self.assertEqual(changed_unit.status_code, 409)

    def test_calendar_preference_defaults_to_solar_and_old_settings_still_parse(self):
        self.assertEqual(AppSettingsPayload().date_calendar.calendar, "solar")
        previous_settings = AppSettingsPayload.model_validate({"appearance": {"language": "fa"}})
        self.assertEqual(previous_settings.date_calendar.calendar, "solar")

    def test_additive_migration_preserves_old_rows_and_adds_tracking_columns(self):
        legacy_engine = create_engine("sqlite://")
        with legacy_engine.begin() as connection:
            connection.execute(text("CREATE TABLE tasks (id INTEGER PRIMARY KEY, is_completed BOOLEAN)"))
            connection.execute(text("CREATE TABLE goals (id INTEGER PRIMARY KEY, created_at DATETIME, start_date DATE)"))
            connection.execute(text("CREATE TABLE habits (id INTEGER PRIMARY KEY, created_at DATETIME)"))
            connection.execute(text("INSERT INTO tasks (id, is_completed) VALUES (1, 1)"))
            connection.execute(text("INSERT INTO goals (id, created_at) VALUES (1, '2026-10-01 12:00:00')"))
            connection.execute(text("INSERT INTO habits (id, created_at) VALUES (1, '2026-10-01 12:00:00')"))
        try:
            upgrade_productivity_columns(legacy_engine)
            inspector = inspect(legacy_engine)
            self.assertIn("completed_at", {column["name"] for column in inspector.get_columns("tasks")})
            self.assertIn("target_amount", {column["name"] for column in inspector.get_columns("goals")})
            self.assertIn("daily_target", {column["name"] for column in inspector.get_columns("habits")})
            with legacy_engine.connect() as connection:
                self.assertEqual(connection.execute(text("SELECT start_date FROM goals WHERE id = 1")).scalar(), "2026-10-01")
                self.assertEqual(connection.execute(text("SELECT tracking_type FROM habits WHERE id = 1")).scalar(), "yes_no")
                self.assertEqual(connection.execute(text("SELECT is_completed FROM tasks WHERE id = 1")).scalar(), 1)
        finally:
            legacy_engine.dispose()

    def test_empty_month_and_invalid_month_do_not_create_fake_history(self):
        empty = self.client.get("/api/tasks/monthly-history/1405/12")
        self.assertEqual(empty.status_code, 404)
        invalid = self.client.get("/api/tasks/monthly-history/1405/13")
        self.assertEqual(invalid.status_code, 422)


if __name__ == "__main__":
    unittest.main()
