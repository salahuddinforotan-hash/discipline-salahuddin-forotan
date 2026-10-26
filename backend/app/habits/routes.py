from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.habits.schemas import (
    HabitCompletionResponse,
    HabitCreate,
    HabitResponse,
    HabitUpdate,
)
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.user import User


router = APIRouter(
    prefix="/api/habits",
    tags=["Habits"],
)


def recalculate_streaks(
    habit: Habit,
    db: Session,
) -> None:
    completions = (
        db.query(HabitCompletion)
        .filter(HabitCompletion.habit_id == habit.id)
        .order_by(HabitCompletion.completion_date.asc())
        .all()
    )

    dates = sorted(
        {completion.completion_date for completion in completions}
    )

    if not dates:
        habit.current_streak = 0
        habit.longest_streak = 0
        return

    longest = 1
    current_run = 1

    for index in range(1, len(dates)):
        if dates[index] == dates[index - 1] + timedelta(days=1):
            current_run += 1
        else:
            current_run = 1

        longest = max(longest, current_run)

    today = date.today()
    current_streak = 0
    expected = today

    for completion_date in reversed(dates):
        if completion_date == expected:
            current_streak += 1
            expected -= timedelta(days=1)
        elif completion_date < expected:
            break

    habit.current_streak = current_streak
    habit.longest_streak = longest


def get_user_habit(
    habit_id: int,
    db: Session,
    current_user: User,
) -> Habit:
    habit = (
        db.query(Habit)
        .filter(
            Habit.id == habit_id,
            Habit.user_id == current_user.id,
        )
        .first()
    )

    if not habit:
        raise HTTPException(
            status_code=404,
            detail="Habit not found.",
        )

    return habit


@router.post("/", response_model=HabitResponse)
def create_habit(
    habit_data: HabitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = Habit(
        name=habit_data.name,
        description=habit_data.description,
        frequency=habit_data.frequency,
        is_active=True,
        current_streak=0,
        longest_streak=0,
        user_id=current_user.id,
    )

    db.add(habit)
    db.commit()
    db.refresh(habit)

    return habit


@router.get("/", response_model=list[HabitResponse])
def get_habits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .order_by(Habit.created_at.desc())
        .all()
    )


@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_habit(habit_id, db, current_user)


@router.patch("/{habit_id}", response_model=HabitResponse)
def update_habit(
    habit_id: int,
    habit_data: HabitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)

    update_data = habit_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(habit, field, value)

    db.commit()
    db.refresh(habit)

    return habit


@router.delete("/{habit_id}")
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)

    db.delete(habit)
    db.commit()

    return {
        "message": "Habit deleted successfully.",
    }


@router.post(
    "/{habit_id}/complete",
    response_model=HabitCompletionResponse,
)
def complete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)
    today = date.today()

    existing = (
        db.query(HabitCompletion)
        .filter(
            HabitCompletion.habit_id == habit.id,
            HabitCompletion.completion_date == today,
        )
        .first()
    )

    if existing:
        return existing

    completion = HabitCompletion(
        habit_id=habit.id,
        completion_date=today,
    )

    db.add(completion)
    db.flush()

    recalculate_streaks(habit, db)

    db.commit()
    db.refresh(completion)

    return completion


@router.delete("/{habit_id}/complete")
def uncomplete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)
    today = date.today()

    completion = (
        db.query(HabitCompletion)
        .filter(
            HabitCompletion.habit_id == habit.id,
            HabitCompletion.completion_date == today,
        )
        .first()
    )

    if not completion:
        raise HTTPException(
            status_code=404,
            detail="Habit is not completed today.",
        )

    db.delete(completion)
    db.flush()

    recalculate_streaks(habit, db)

    db.commit()

    return {
        "message": "Habit marked incomplete for today.",
    }


@router.get(
    "/{habit_id}/completions",
    response_model=list[HabitCompletionResponse],
)
def get_habit_completions(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)

    return (
        db.query(HabitCompletion)
        .filter(HabitCompletion.habit_id == habit.id)
        .order_by(HabitCompletion.completion_date.desc())
        .all()
    )
