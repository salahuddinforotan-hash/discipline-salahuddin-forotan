import calendar
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.account.schemas import AppSettingsPayload
from app.database import SessionLocal, settings
from app.finance.calendar import (
    gregorian_to_solar_hijri,
    solar_hijri_month_name,
    solar_hijri_month_range,
)
from app.journal.routes import calculate_discipline_snapshot
from app.models.account_settings import AccountSettings
from app.models.finance_entry import FinanceEntry
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.journal_entry import JournalEntry
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User
from app.timezone import application_timezone


logger = logging.getLogger(__name__)


def _aware_local(value: datetime, tz) -> datetime:
    if value.tzinfo is None:
        # Earlier application versions stored datetime.utcnow() as a naive value.
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(tz)


def _at(day: date, at_time: time, tz) -> datetime:
    return datetime.combine(day, at_time.replace(tzinfo=None), tzinfo=tz)


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _previous_month(day: date) -> date:
    first = _month_start(day)
    return (first - timedelta(days=1)).replace(day=1)


def _monthly_occurrence(day: date, configured_day: int) -> date:
    last_day = calendar.monthrange(day.year, day.month)[1]
    return day.replace(day=min(configured_day, last_day))


def _completed_in_period(
    completions: list[HabitCompletion],
    frequency: str,
    period_start: date,
    occurrence_day: date,
) -> bool:
    if frequency == "daily":
        return any(row.completion_date == occurrence_day for row in completions)
    if frequency == "weekly":
        period_end = period_start + timedelta(days=7)
        return any(period_start <= row.completion_date < period_end for row in completions)
    return any(
        row.completion_date.year == period_start.year
        and row.completion_date.month == period_start.month
        for row in completions
    )


def _habit_periods(habit: Habit, today: date) -> list[tuple[str, date, date, date]]:
    periods: list[tuple[str, date, date, date]] = []
    if habit.frequency == "daily":
        for offset in range(2, -1, -1):
            occurrence = today - timedelta(days=offset)
            periods.append((occurrence.isoformat(), occurrence, occurrence, occurrence + timedelta(days=1)))
    elif habit.frequency == "weekly":
        this_monday = today - timedelta(days=today.weekday())
        for offset in (14, 7, 0):
            start = this_monday - timedelta(days=offset)
            periods.append((start.strftime("%G-W%V"), start, start, start + timedelta(days=7)))
    else:
        month = _month_start(today)
        for _ in range(3):
            occurrence = _monthly_occurrence(month, habit.day_of_month or 1)
            periods.append((month.strftime("%Y-%m"), month, occurrence, occurrence + timedelta(days=1)))
            month = _previous_month(month)
        periods.reverse()
    return periods


def _event(
    user_id: int,
    event_type: str,
    title: str,
    message: str,
    dedupe_key: str,
    now: datetime,
    related_type: str | None = None,
    related_id: int | None = None,
) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "type": event_type,
        "title": title,
        "message": message,
        "related_item_type": related_type,
        "related_item_id": related_id,
        "dedupe_key": dedupe_key,
        "is_read": False,
        "created_at": now,
    }


def collect_user_notifications(
    db: Session,
    user: User,
    now: datetime,
) -> list[dict[str, Any]]:
    tz = application_timezone()
    if now.tzinfo is None:
        raise ValueError("Notification scheduler requires a timezone-aware datetime.")
    local_now = now.astimezone(tz)
    today = local_now.date()
    user_id = user.id

    settings_record = (
        db.query(AccountSettings)
        .filter(AccountSettings.user_id == user_id)
        .first()
    )
    prefs = AppSettingsPayload.model_validate(
        settings_record.preferences if settings_record else {}
    )
    events: list[dict[str, Any]] = []

    def add(*args, **kwargs) -> None:
        events.append(_event(user_id, *args, now=now, **kwargs))

    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    if prefs.notifications.late_tasks:
        for task in tasks:
            if task.is_completed or not task.due_date:
                continue
            task_due_time = task.due_time or time(9, 0)
            deadline = _at(task.due_date, task_due_time, tz)
            overdue_at = (
                deadline + timedelta(minutes=5)
                if task.due_time
                else _at(task.due_date + timedelta(days=1), time.min, tz)
            )
            base_key = f"task:{task.id}:{task.due_date.isoformat()}:{task_due_time.isoformat()}"
            due_text = f" on {task.due_date.strftime('%b %d')}"
            if task.due_time:
                due_text += f" at {task.due_time.strftime('%I:%M %p').lstrip('0')}"
            if deadline - timedelta(hours=24) <= local_now < deadline:
                add(
                    "task_upcoming",
                    "Task coming up",
                    f'“{task.title}” is due{due_text}.',
                    f"{base_key}:upcoming",
                    related_type="task",
                    related_id=task.id,
                )
            if deadline <= local_now < overdue_at:
                add(
                    "task_due",
                    "Task due",
                    f'“{task.title}” is due{due_text}.',
                    f"{base_key}:due",
                    related_type="task",
                    related_id=task.id,
                )
            elif local_now >= overdue_at:
                add(
                    "task_overdue",
                    "Task overdue",
                    f'“{task.title}” was due{due_text}.',
                    f"{base_key}:overdue",
                    related_type="task",
                    related_id=task.id,
                )

    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    if prefs.notifications.goal_deadlines:
        for goal in goals:
            if goal.is_completed:
                if goal.completed_at:
                    completed_at = _aware_local(goal.completed_at, tz)
                    add(
                        "goal_completed",
                        "Goal completed",
                        f'You completed “{goal.title}”.',
                        f"goal:{goal.id}:completed:{completed_at.isoformat()}",
                        related_type="goal",
                        related_id=goal.id,
                    )
                continue
            if not goal.target_date:
                continue
            target_time = goal.target_time or time(23, 59)
            deadline = _at(goal.target_date, target_time, tz)
            overdue_at = (
                deadline + timedelta(minutes=5)
                if goal.target_time
                else _at(goal.target_date + timedelta(days=1), time.min, tz)
            )
            key = f"goal:{goal.id}:{goal.target_date.isoformat()}:{target_time.isoformat()}"
            target_text = f" on {goal.target_date.strftime('%b %d')}"
            if goal.target_time:
                target_text += f" at {goal.target_time.strftime('%I:%M %p').lstrip('0')}"
            if deadline - timedelta(hours=24) <= local_now < deadline:
                add(
                    "goal_upcoming",
                    "Goal deadline coming up",
                    f'“{goal.title}” is due{target_text}.',
                    f"{key}:upcoming",
                    related_type="goal",
                    related_id=goal.id,
                )
            if deadline <= local_now < overdue_at:
                add(
                    "goal_due",
                    "Goal deadline reached",
                    f'“{goal.title}” reaches its target{target_text}.',
                    f"{key}:due",
                    related_type="goal",
                    related_id=goal.id,
                )
            elif local_now >= overdue_at:
                add(
                    "goal_overdue",
                    "Goal overdue",
                    f'“{goal.title}” passed its target{target_text}.',
                    f"{key}:overdue",
                    related_type="goal",
                    related_id=goal.id,
                )

    habits = (
        db.query(Habit)
        .filter(Habit.user_id == user_id, Habit.is_active.is_(True))
        .all()
    )
    habit_ids = [habit.id for habit in habits]
    completions_by_habit: dict[int, list[HabitCompletion]] = {habit_id: [] for habit_id in habit_ids}
    if habit_ids:
        for completion in (
            db.query(HabitCompletion)
            .filter(HabitCompletion.habit_id.in_(habit_ids))
            .all()
        ):
            completions_by_habit[completion.habit_id].append(completion)

    if prefs.notifications.missed_habits:
        for habit in habits:
            created_date = _aware_local(habit.created_at, tz).date()
            habit_completions = completions_by_habit[habit.id]
            reminder_time = habit.reminder_time or time.fromisoformat(prefs.discipline.reminder_time)
            for period_key, period_start, occurrence, period_end in _habit_periods(habit, today):
                if created_date >= period_end:
                    continue
                reminder_day = occurrence
                if habit.frequency == "weekly" and created_date > occurrence:
                    reminder_day = created_date
                elif created_date > occurrence:
                    continue
                complete = _completed_in_period(
                    habit_completions,
                    habit.frequency,
                    period_start,
                    occurrence,
                )
                if complete:
                    continue
                reminder_at = _at(reminder_day, reminder_time, tz)
                event_key = f"habit:{habit.id}:{period_key}"
                if reminder_at <= local_now < _at(period_end, time.min, tz):
                    add(
                        "habit_reminder",
                        "Habit reminder",
                        f"It’s time for {habit.name}.",
                        f"{event_key}:reminder",
                        related_type="habit",
                        related_id=habit.id,
                    )
                if local_now >= _at(period_end, time.min, tz):
                    add(
                        "habit_missed",
                        "Habit period missed",
                        f'“{habit.name}” was not completed for this {habit.frequency} period.',
                        f"{event_key}:missed",
                        related_type="habit",
                        related_id=habit.id,
                    )
                if (
                    prefs.discipline.streak_reminders
                    and habit.current_streak > 0
                    and occurrence <= today < period_end
                    and local_now >= _at(today, time.fromisoformat(prefs.discipline.reminder_time), tz)
                ):
                    add(
                        "habit_streak",
                        "Keep your streak going",
                        f'Complete “{habit.name}” to protect your {habit.current_streak}-period streak.',
                        f"{event_key}:streak",
                        related_type="habit",
                        related_id=habit.id,
                    )

    journal_entry = (
        db.query(JournalEntry.id)
        .filter(JournalEntry.user_id == user_id, JournalEntry.entry_date == today)
        .first()
    )
    if prefs.notifications.journal_reminder and not journal_entry:
        journal_time = time.fromisoformat(prefs.discipline.reminder_time)
        if local_now >= _at(today, journal_time, tz):
            add(
                "journal_reminder",
                "Take a moment to reflect",
                "Your private journal entry for today is not saved yet.",
                f"journal:{today.isoformat()}:reminder",
                related_type="journal",
            )

    if prefs.notifications.daily_discipline:
        snapshot = calculate_discipline_snapshot(today, db, user, journal_entry is not None)
        if (
            local_now >= _at(today, time.fromisoformat(prefs.discipline.reminder_time), tz)
            and snapshot.discipline_score < prefs.discipline.daily_goal
        ):
            add(
                "daily_discipline",
                "Daily discipline goal still open",
                f"You’re at {snapshot.discipline_score}%. Your daily goal is {prefs.discipline.daily_goal}%.",
                f"discipline:{today.isoformat()}:reminder",
                related_type="discipline",
            )

    if prefs.finance.monthly_spending_alert and prefs.finance.monthly_spending_limit > 0:
        solar_year, solar_month, _ = gregorian_to_solar_hijri(today)
        month_start, month_end = solar_hijri_month_range(solar_year, solar_month)
        expense_total = (
            db.query(FinanceEntry)
            .filter(
                FinanceEntry.user_id == user_id,
                FinanceEntry.kind == "expense",
                FinanceEntry.currency == prefs.finance.currency,
                FinanceEntry.entry_date >= month_start,
                FinanceEntry.entry_date < month_end,
            )
            .all()
        )
        spent = sum(float(entry.amount) for entry in expense_total)
        if spent >= prefs.finance.monthly_spending_limit:
            add(
                "finance_limit",
                "Monthly spending limit reached",
                f"Expenses reached {prefs.finance.currency} {spent:,.0f} in {solar_hijri_month_name(solar_month)}.",
                f"finance-limit:{solar_year}-{solar_month}",
                related_type="finance",
            )

    return events


def _insert_once(db: Session, events: list[dict[str, Any]]) -> int:
    if not events:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = postgres_insert(Notification).values(events).on_conflict_do_nothing(
            constraint="uq_notification_user_dedupe_key"
        )
    elif dialect == "sqlite":
        statement = sqlite_insert(Notification).values(events).on_conflict_do_nothing(
            index_elements=["user_id", "dedupe_key"]
        )
    else:
        existing = set(
            db.execute(
                select(Notification.dedupe_key).where(
                    Notification.user_id == events[0]["user_id"],
                    Notification.dedupe_key.in_([event["dedupe_key"] for event in events]),
                )
            ).scalars()
        )
        fresh = [event for event in events if event["dedupe_key"] not in existing]
        db.add_all(Notification(**event) for event in fresh)
        db.commit()
        return len(fresh)
    result = db.execute(statement)
    db.commit()
    return max(result.rowcount or 0, 0)


def check_notifications(db: Session, now: datetime | None = None) -> int:
    checked_at = now or datetime.now(timezone.utc)
    if checked_at.tzinfo is None:
        raise ValueError("Notification scheduler requires a timezone-aware datetime.")
    total_created = 0
    users = db.query(User).filter(User.is_active.is_(True)).all()
    for user in users:
        events = collect_user_notifications(db, user, checked_at)
        total_created += _insert_once(db, events)
    return total_created


def check_all_users() -> int:
    db = SessionLocal()
    try:
        return check_notifications(db)
    finally:
        db.close()


async def notification_scheduler_loop() -> None:
    import asyncio

    interval = max(15, settings.alert_check_interval_seconds)
    while True:
        try:
            await asyncio.to_thread(check_all_users)
        except Exception:
            logger.exception("Notification check failed; it will retry on the next interval.")
        await asyncio.sleep(interval)
