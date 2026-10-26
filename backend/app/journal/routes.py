from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.history.calendar import checked_month, month_fields, solar_month_key
from app.history.schemas import JournalHistoryDetail, JournalHistoryMonth
from app.journal.schemas import (
    DisciplineSnapshot,
    JournalEntryResponse,
    JournalEntryUpsert,
)
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.journal_entry import JournalEntry
from app.models.task import Task
from app.models.user import User


router = APIRouter(prefix="/api/journal", tags=["Journal"])


def calculate_discipline_snapshot(
    entry_date: date,
    db: Session,
    current_user: User,
    journal_completed: bool,
) -> DisciplineSnapshot:
    due_tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.due_date == entry_date)
        .all()
    )
    tasks_completed = sum(1 for task in due_tasks if task.is_completed)

    daily_habits = (
        db.query(Habit)
        .filter(
            Habit.user_id == current_user.id,
            Habit.is_active.is_(True),
            Habit.frequency == "daily",
        )
        .all()
    )
    habit_ids = [habit.id for habit in daily_habits]
    completed_habit_ids = set()
    if habit_ids:
        completed_habit_ids = {
            habit_id
            for (habit_id,) in (
                db.query(HabitCompletion.habit_id)
                .filter(
                    HabitCompletion.habit_id.in_(habit_ids),
                    HabitCompletion.completion_date == entry_date,
                )
                .all()
            )
        }

    active_goals = (
        db.query(Goal)
        .filter(
            Goal.user_id == current_user.id,
            Goal.is_completed.is_(False),
        )
        .all()
    )
    goal_progress = (
        round(sum(goal.progress for goal in active_goals) / len(active_goals))
        if active_goals
        else None
    )

    component_scores = []
    if due_tasks:
        component_scores.append(round((tasks_completed / len(due_tasks)) * 100))
    if daily_habits:
        component_scores.append(round((len(completed_habit_ids) / len(daily_habits)) * 100))
    if goal_progress is not None:
        component_scores.append(goal_progress)
    component_scores.append(100 if journal_completed else 0)

    return DisciplineSnapshot(
        entry_date=entry_date,
        tasks_completed=tasks_completed,
        tasks_total=len(due_tasks),
        habits_completed=len(completed_habit_ids),
        habits_total=len(daily_habits),
        active_goals=len(active_goals),
        goal_progress=goal_progress,
        journal_completed=journal_completed,
        discipline_score=round(sum(component_scores) / len(component_scores)),
    )


def journal_response(entry: JournalEntry) -> JournalEntryResponse:
    return JournalEntryResponse(
        id=entry.id,
        entry_date=entry.entry_date,
        mood=entry.mood,
        answers=entry.answers or {},
        tasks_completed=entry.tasks_completed,
        tasks_total=entry.tasks_total,
        habits_completed=entry.habits_completed,
        habits_total=entry.habits_total,
        active_goals=entry.active_goals,
        goal_progress=entry.goal_progress,
        discipline_score=entry.discipline_score,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def save_snapshot(entry: JournalEntry, snapshot: DisciplineSnapshot) -> None:
    entry.tasks_completed = snapshot.tasks_completed
    entry.tasks_total = snapshot.tasks_total
    entry.habits_completed = snapshot.habits_completed
    entry.habits_total = snapshot.habits_total
    entry.active_goals = snapshot.active_goals
    entry.goal_progress = snapshot.goal_progress
    entry.discipline_score = snapshot.discipline_score


@router.get("/", response_model=list[JournalEntryResponse])
def list_journal_entries(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")

    query = db.query(JournalEntry).filter(JournalEntry.user_id == current_user.id)
    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    entries = query.order_by(JournalEntry.entry_date.desc()).all()
    return [journal_response(entry) for entry in entries]


@router.get("/monthly-history", response_model=list[JournalHistoryMonth])
def get_journal_monthly_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.entry_date.desc())
        .all()
    )
    grouped: dict[tuple[int, int], list[JournalEntry]] = {}
    for entry in entries:
        grouped.setdefault(solar_month_key(entry.entry_date), []).append(entry)
    return [
        {
            **month_fields(year, month),
            "entry_count": len(month_entries),
            "average_discipline_score": round(
                sum(entry.discipline_score for entry in month_entries) / len(month_entries)
            ),
        }
        for (year, month), month_entries in sorted(grouped.items(), reverse=True)
    ]


@router.get(
    "/monthly-history/{solar_year}/{solar_month}",
    response_model=JournalHistoryDetail,
)
def get_journal_monthly_history_detail(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, month = checked_month(solar_year, solar_month)
    entries = (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.entry_date.desc())
        .all()
    )
    month_entries = [
        entry for entry in entries
        if solar_month_key(entry.entry_date) == (year, month)
    ]
    if not month_entries:
        raise HTTPException(status_code=404, detail="No journal activity exists for this month.")
    return {
        **month_fields(year, month),
        "entry_count": len(month_entries),
        "average_discipline_score": round(
            sum(entry.discipline_score for entry in month_entries) / len(month_entries)
        ),
        "entries": [journal_response(entry) for entry in month_entries],
    }


@router.get("/discipline/{entry_date}", response_model=DisciplineSnapshot)
def get_discipline_snapshot(
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    journal_completed = (
        db.query(JournalEntry.id)
        .filter(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date == entry_date,
        )
        .first()
        is not None
    )
    return calculate_discipline_snapshot(
        entry_date,
        db,
        current_user,
        journal_completed,
    )


@router.get("/{entry_date}", response_model=JournalEntryResponse)
def get_journal_entry(
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date == entry_date,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return journal_response(entry)


@router.put("/{entry_date}", response_model=JournalEntryResponse)
def upsert_journal_entry(
    entry_date: date,
    entry_data: JournalEntryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date == entry_date,
        )
        .first()
    )
    snapshot = calculate_discipline_snapshot(
        entry_date,
        db,
        current_user,
        journal_completed=True,
    )

    if entry is None:
        entry = JournalEntry(
            user_id=current_user.id,
            entry_date=entry_date,
            mood=entry_data.mood,
            answers=entry_data.answers,
        )
        db.add(entry)
    else:
        entry.mood = entry_data.mood
        entry.answers = entry_data.answers

    save_snapshot(entry, snapshot)
    db.commit()
    db.refresh(entry)
    return journal_response(entry)
