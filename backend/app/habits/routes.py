from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.history.calendar import checked_month, month_fields, solar_month_key
from app.history.schemas import HabitHistoryDetail, HabitHistoryMonth
from app.habits.schemas import (
    HabitCompletionResponse,
    HabitCreate,
    HabitProgressCreate,
    HabitProgressResponse,
    HabitResponse,
    HabitUpdate,
)
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.habit_progress import HabitProgress
from app.models.user import User
from app.timezone import application_today


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

    dates = {completion.completion_date for completion in completions}

    if not dates:
        habit.current_streak = 0
        habit.longest_streak = 0
        return

    def period_index(completion_date: date) -> int:
        if habit.frequency == "weekly":
            week_start = completion_date - timedelta(days=completion_date.weekday())
            return week_start.toordinal() // 7
        if habit.frequency == "monthly":
            return completion_date.year * 12 + completion_date.month
        return completion_date.toordinal()

    periods = sorted({period_index(completion_date) for completion_date in dates})

    longest = 1
    current_run = 1

    for index in range(1, len(periods)):
        if periods[index] == periods[index - 1] + 1:
            current_run += 1
        else:
            current_run = 1

        longest = max(longest, current_run)

    today = application_today()
    current_streak = 0
    expected = period_index(today)
    if periods[-1] == expected:
        current_streak = 1
        for completed_period in reversed(periods[:-1]):
            if completed_period == expected - 1:
                current_streak += 1
                expected = completed_period
            else:
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
    if habit_data.frequency == "monthly" and habit_data.day_of_month is None:
        raise HTTPException(
            status_code=422,
            detail="Choose a day of the month for monthly habits.",
        )
    if habit_data.tracking_type == "measurable" and (habit_data.daily_target is None or not habit_data.target_unit or not habit_data.target_unit.strip()):
        raise HTTPException(status_code=422, detail="Measurable habits need a daily target and unit.")

    habit = Habit(
        name=habit_data.name,
        description=habit_data.description,
        frequency=habit_data.frequency,
        reminder_time=habit_data.reminder_time,
        day_of_month=habit_data.day_of_month if habit_data.frequency == "monthly" else None,
        tracking_type=habit_data.tracking_type,
        daily_target=habit_data.daily_target if habit_data.tracking_type == "measurable" else None,
        target_unit=habit_data.target_unit.strip() if habit_data.tracking_type == "measurable" and habit_data.target_unit else None,
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


def _monthly_habit_data(db: Session, current_user: User):
    habits = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .order_by(Habit.created_at.desc())
        .all()
    )
    habit_by_id = {habit.id: habit for habit in habits}
    habit_ids = list(habit_by_id)
    completions = (
        db.query(HabitCompletion)
        .filter(HabitCompletion.habit_id.in_(habit_ids))
        .order_by(HabitCompletion.completion_date.desc(), HabitCompletion.id.desc())
        .all()
        if habit_ids
        else []
    )
    return habits, habit_by_id, completions


@router.get("/monthly-history", response_model=list[HabitHistoryMonth])
def get_habit_monthly_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habits, _, completions = _monthly_habit_data(db, current_user)
    habit_ids = [habit.id for habit in habits]
    progress = db.query(HabitProgress).filter(HabitProgress.habit_id.in_(habit_ids)).all() if habit_ids else []
    grouped_habits: dict[tuple[int, int], list[Habit]] = {}
    grouped_completions: dict[tuple[int, int], list[HabitCompletion]] = {}
    for habit in habits:
        grouped_habits.setdefault(solar_month_key(habit.created_at), []).append(habit)
    for completion in completions:
        grouped_completions.setdefault(solar_month_key(completion.completion_date), []).append(completion)
    grouped_progress: dict[tuple[int, int], list[HabitProgress]] = {}
    for entry in progress:
        grouped_progress.setdefault(solar_month_key(entry.entry_date), []).append(entry)
    month_keys = set(grouped_habits) | set(grouped_completions) | set(grouped_progress)
    return [
        {
            **month_fields(year, month),
            "added_habits": len(grouped_habits.get((year, month), [])),
            "completion_count": len(grouped_completions.get((year, month), [])),
            "completed_habits": len({
                completion.habit_id
                for completion in grouped_completions.get((year, month), [])
            }),
            "progress_count": len(grouped_progress.get((year, month), [])),
        }
        for year, month in sorted(month_keys, reverse=True)
    ]


@router.get(
    "/monthly-history/{solar_year}/{solar_month}",
    response_model=HabitHistoryDetail,
)
def get_habit_monthly_history_detail(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, month = checked_month(solar_year, solar_month)
    habits, habit_by_id, completions = _monthly_habit_data(db, current_user)
    month_completions = [
        completion for completion in completions
        if solar_month_key(completion.completion_date) == (year, month)
    ]
    all_progress = db.query(HabitProgress).filter(HabitProgress.habit_id.in_(list(habit_by_id))).all() if habit_by_id else []
    month_progress = [entry for entry in all_progress if solar_month_key(entry.entry_date) == (year, month)]
    new_habits = [
        habit for habit in habits
        if solar_month_key(habit.created_at) == (year, month)
    ]
    habit_ids = {habit.id for habit in new_habits}
    habit_ids.update(completion.habit_id for completion in month_completions)
    habit_ids.update(entry.habit_id for entry in month_progress)
    if not habit_ids:
        raise HTTPException(status_code=404, detail="No habit activity exists for this month.")
    month_habits = [habit_by_id[habit_id] for habit_id in habit_ids]
    return {
        **month_fields(year, month),
        "added_habits": len(new_habits),
        "completion_count": len(month_completions),
        "completed_habits": len({completion.habit_id for completion in month_completions}),
        "habits": month_habits,
        "completions": month_completions,
        "progress_entries": month_progress,
    }


# IMPORTANT:
# This route must come BEFORE /{habit_id}
# so "completions" is not interpreted as a numeric habit_id.
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
    if habit.tracking_type == "measurable":
        raise HTTPException(status_code=422, detail="Record an amount to complete this measurable habit.")
    today = application_today()

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
    frequency = update_data.get("frequency", habit.frequency)
    day_of_month = update_data.get("day_of_month", habit.day_of_month)

    if frequency == "monthly" and day_of_month is None:
        raise HTTPException(
            status_code=422,
            detail="Choose a day of the month for monthly habits.",
        )

    if frequency != "monthly":
        update_data["day_of_month"] = None
    tracking_type = update_data.get("tracking_type", habit.tracking_type)
    target = update_data.get("daily_target", habit.daily_target)
    unit = update_data.get("target_unit", habit.target_unit)
    if tracking_type == "measurable" and (target is None or not unit or not unit.strip()):
        raise HTTPException(status_code=422, detail="Measurable habits need a daily target and unit.")
    if tracking_type == "measurable" and habit.tracking_type == "measurable" and unit != habit.target_unit:
        has_progress = db.query(HabitProgress.id).filter(HabitProgress.habit_id == habit.id).first() is not None
        if has_progress:
            raise HTTPException(status_code=409, detail="A habit's unit cannot change after amount records have been saved.")
    if tracking_type == "yes_no":
        update_data["daily_target"] = None
        update_data["target_unit"] = None

    for field, value in update_data.items():
        setattr(habit, field, value)

    recalculate_streaks(habit, db)
    db.commit()
    db.refresh(habit)

    return habit


@router.get("/{habit_id}/progress", response_model=list[HabitProgressResponse])
def get_habit_progress(habit_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    habit = get_user_habit(habit_id, db, current_user)
    return db.query(HabitProgress).filter(HabitProgress.habit_id == habit.id).order_by(HabitProgress.entry_date.desc(), HabitProgress.created_at.desc()).all()


@router.post("/{habit_id}/progress", response_model=HabitProgressResponse)
def add_habit_progress(habit_id: int, progress_data: HabitProgressCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    habit = get_user_habit(habit_id, db, current_user)
    if progress_data.entry_date > application_today():
        raise HTTPException(status_code=422, detail="Progress dates cannot be in the future.")
    if habit.tracking_type != "measurable" or habit.daily_target is None or not habit.target_unit:
        raise HTTPException(status_code=422, detail="This habit is not configured for measurable tracking.")
    entry = HabitProgress(habit_id=habit.id, amount=progress_data.amount, unit=habit.target_unit, entry_date=progress_data.entry_date, note=progress_data.note)
    db.add(entry)
    day_total = sum(row.amount for row in db.query(HabitProgress).filter(HabitProgress.habit_id == habit.id, HabitProgress.entry_date == progress_data.entry_date).all()) + progress_data.amount
    if day_total >= habit.daily_target:
        completion = db.query(HabitCompletion).filter(HabitCompletion.habit_id == habit.id, HabitCompletion.completion_date == progress_data.entry_date).first()
        if completion is None:
            db.add(HabitCompletion(habit_id=habit.id, completion_date=progress_data.entry_date))
            db.flush()
            recalculate_streaks(habit, db)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{habit_id}")
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = get_user_habit(habit_id, db, current_user)

    db.query(HabitProgress).filter(HabitProgress.habit_id == habit.id).delete(synchronize_session=False)
    db.query(HabitCompletion).filter(HabitCompletion.habit_id == habit.id).delete(synchronize_session=False)
    db.delete(habit)
    db.commit()

    return {
        "message": "Habit deleted successfully.",
    }
