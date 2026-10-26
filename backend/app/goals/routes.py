from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from datetime import date, datetime

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.history.calendar import checked_month, month_fields, solar_month_key
from app.history.schemas import GoalHistoryDetail, GoalHistoryMonth
from app.goals.schemas import GoalCreate, GoalProgressCreate, GoalProgressResponse, GoalResponse, GoalUpdate
from app.models.goal import Goal, GoalProgressEntry
from app.models.user import User
from app.timezone import application_today


router = APIRouter(
    prefix="/api/goals",
    tags=["Goals"],
)


@router.post("/", response_model=GoalResponse)
def create_goal(
    goal_data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_date = goal_data.start_date or date.today()
    if goal_data.target_date and goal_data.target_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="The target date cannot be before the start date.",
        )
    if (goal_data.target_amount is None) != (goal_data.unit is None) or (goal_data.unit is not None and not goal_data.unit.strip()):
        raise HTTPException(status_code=422, detail="Set both a target amount and its unit.")

    goal = Goal(
        title=goal_data.title,
        description=goal_data.description,
        start_date=start_date,
        target_date=goal_data.target_date,
        target_time=goal_data.target_time,
        target_amount=goal_data.target_amount,
        current_amount=0 if goal_data.target_amount is not None else None,
        unit=goal_data.unit.strip() if goal_data.unit else None,
        progress=0,
        is_completed=False,
        user_id=current_user.id,
    )

    db.add(goal)
    db.commit()
    db.refresh(goal)

    return goal


@router.get("/", response_model=list[GoalResponse])
def get_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )


def _goal_start_date(goal: Goal) -> date:
    return goal.start_date or goal.created_at.date()


def _goal_month_events(goal: Goal, entries: list[GoalProgressEntry] | None = None) -> set[tuple[int, int]]:
    months = {solar_month_key(_goal_start_date(goal))}
    if goal.completed_at:
        months.add(solar_month_key(goal.completed_at))
    months.update(solar_month_key(entry.entry_date) for entry in (entries or []))
    return months


@router.get("/monthly-history", response_model=list[GoalHistoryMonth])
def get_goal_monthly_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )
    progress_rows = db.query(GoalProgressEntry).join(Goal).filter(Goal.user_id == current_user.id).all()
    events_by_goal: dict[int, list[GoalProgressEntry]] = {}
    for entry in progress_rows:
        events_by_goal.setdefault(entry.goal_id, []).append(entry)
    grouped: dict[tuple[int, int], dict[int, Goal]] = {}
    for goal in goals:
        for event_month in _goal_month_events(goal, events_by_goal.get(goal.id)):
            grouped.setdefault(event_month, {})[goal.id] = goal
    return [
        {
            **month_fields(year, month),
            "started_count": sum(
                1 for goal in month_goals.values()
                if solar_month_key(_goal_start_date(goal)) == (year, month)
            ),
            "completed_count": sum(
                1 for goal in month_goals.values()
                if goal.completed_at and solar_month_key(goal.completed_at) == (year, month)
            ),
        }
        for (year, month), month_goals in sorted(grouped.items(), reverse=True)
    ]


@router.get(
    "/monthly-history/{solar_year}/{solar_month}",
    response_model=GoalHistoryDetail,
)
def get_goal_monthly_history_detail(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, month = checked_month(solar_year, solar_month)
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )
    progress_entries = db.query(GoalProgressEntry).join(Goal).filter(Goal.user_id == current_user.id).all()
    entries_by_goal: dict[int, list[GoalProgressEntry]] = {}
    for entry in progress_entries:
        entries_by_goal.setdefault(entry.goal_id, []).append(entry)
    month_entries = [entry for entry in progress_entries if solar_month_key(entry.entry_date) == (year, month)]
    month_goals = [goal for goal in goals if (year, month) in _goal_month_events(goal, entries_by_goal.get(goal.id))]
    if not month_goals:
        raise HTTPException(status_code=404, detail="No goal activity exists for this month.")
    return {
        **month_fields(year, month),
        "started_count": sum(
            1 for goal in month_goals
            if solar_month_key(_goal_start_date(goal)) == (year, month)
        ),
        "completed_count": sum(
            1 for goal in month_goals
            if goal.completed_at and solar_month_key(goal.completed_at) == (year, month)
        ),
        "goals": month_goals,
        "progress_entries": month_entries,
    }


def _owned_goal(goal_id: int, db: Session, current_user: User) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return goal


@router.get("/{goal_id}/progress", response_model=list[GoalProgressResponse])
def get_goal_progress(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _owned_goal(goal_id, db, current_user)
    return db.query(GoalProgressEntry).filter(GoalProgressEntry.goal_id == goal.id).order_by(GoalProgressEntry.entry_date.desc(), GoalProgressEntry.created_at.desc()).all()


@router.post("/{goal_id}/progress", response_model=GoalProgressResponse)
def add_goal_progress(goal_id: int, progress_data: GoalProgressCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _owned_goal(goal_id, db, current_user)
    if progress_data.entry_date > application_today():
        raise HTTPException(status_code=422, detail="Progress dates cannot be in the future.")
    if goal.target_amount is None or goal.unit is None:
        # Existing percent-only goals are represented as a 100 percent measurable target.
        goal.target_amount = 100
        goal.current_amount = float(goal.progress)
        goal.unit = "%"
    if goal.current_amount is None:
        goal.current_amount = 0
    if goal.current_amount + progress_data.amount > goal.target_amount:
        raise HTTPException(status_code=422, detail="Progress cannot exceed the goal target.")
    entry = GoalProgressEntry(goal_id=goal.id, amount=progress_data.amount, unit=goal.unit, entry_date=progress_data.entry_date, note=progress_data.note)
    goal.current_amount += progress_data.amount
    goal.progress = min(100, round((goal.current_amount / goal.target_amount) * 100))
    goal.is_completed = goal.progress >= 100
    if goal.is_completed and goal.completed_at is None:
        goal.completed_at = datetime.utcnow()
    elif not goal.is_completed:
        goal.completed_at = None
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = (
        db.query(Goal)
        .filter(
            Goal.id == goal_id,
            Goal.user_id == current_user.id,
        )
        .first()
    )

    if not goal:
        raise HTTPException(
            status_code=404,
            detail="Goal not found.",
        )

    return goal


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    goal_data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = (
        db.query(Goal)
        .filter(
            Goal.id == goal_id,
            Goal.user_id == current_user.id,
        )
        .first()
    )

    if not goal:
        raise HTTPException(
            status_code=404,
            detail="Goal not found.",
        )

    update_data = goal_data.model_dump(exclude_unset=True)
    percentage_goal = goal.target_amount == 100 and goal.unit == "%"
    if goal.target_amount is not None and not percentage_goal and ("progress" in update_data or "is_completed" in update_data):
        raise HTTPException(status_code=422, detail="Measured goal progress must be recorded as a dated entry.")
    updated_start_date = update_data.get("start_date", goal.start_date)
    updated_target_date = update_data.get("target_date", goal.target_date)
    if updated_start_date and updated_target_date and updated_target_date < updated_start_date:
        raise HTTPException(
            status_code=422,
            detail="The target date cannot be before the start date.",
        )

    if "target_amount" in update_data or "unit" in update_data:
        target_amount = update_data.get("target_amount", goal.target_amount)
        unit = update_data.get("unit", goal.unit)
        has_history = db.query(GoalProgressEntry.id).filter(GoalProgressEntry.goal_id == goal.id).first() is not None
        if (target_amount is None) != (unit is None) or (unit is not None and not unit.strip()):
            raise HTTPException(status_code=422, detail="Set both a target amount and its unit.")
        if has_history and unit != goal.unit:
            raise HTTPException(status_code=409, detail="A goal's unit cannot change after progress has been recorded.")
        if has_history and target_amount is None:
            raise HTTPException(status_code=409, detail="A measured target cannot be removed after progress has been recorded.")
        if goal.target_amount is None and target_amount is not None and goal.progress > 0:
            raise HTTPException(status_code=409, detail="Existing percentage progress cannot be converted to a new unit automatically. Record progress first or create a new goal.")
        if target_amount is not None and goal.current_amount is not None and goal.current_amount > target_amount:
            raise HTTPException(status_code=422, detail="The target cannot be less than progress already recorded.")
        if target_amount is None:
            update_data["current_amount"] = None
        else:
            current_amount = goal.current_amount or 0
            update_data["current_amount"] = current_amount
            update_data["progress"] = min(100, round(current_amount / target_amount * 100))
            update_data["is_completed"] = current_amount >= target_amount
        update_data["target_amount"] = target_amount
        update_data["unit"] = unit.strip() if unit else None

    percentage_progress_recorded = False
    # Keep the existing percentage control backward compatible while recording every increase as an append-only event.
    if (goal.target_amount is None or percentage_goal) and "target_amount" not in update_data and "unit" not in update_data:
        requested_progress = goal_data.progress
        requested_complete = goal_data.is_completed
        next_progress = 100 if requested_complete is True else requested_progress
        if next_progress is not None:
            if next_progress < goal.progress:
                raise HTTPException(status_code=409, detail="Saved goal progress cannot be reduced; add dated progress instead.")
            goal.target_amount = 100
            goal.current_amount = float(goal.progress)
            goal.unit = "%"
            increment = next_progress - goal.progress
            if increment > 0:
                db.add(GoalProgressEntry(goal_id=goal.id, amount=float(increment), unit="%", entry_date=application_today(), note="Added from the percentage progress control."))
            percentage_progress_recorded = True
            goal.current_amount = float(next_progress)
            update_data["target_amount"] = 100
            update_data["current_amount"] = float(next_progress)
            update_data["unit"] = "%"
            update_data["progress"] = next_progress
            if next_progress == 100:
                update_data["is_completed"] = True
        elif requested_complete is False and goal.progress >= 100:
            raise HTTPException(status_code=409, detail="A completed goal with saved progress cannot be reopened without changing its history.")

    if "progress" in update_data:
        progress = update_data["progress"]

        if progress == 100:
            update_data["is_completed"] = True
        elif progress < 100:
            update_data["is_completed"] = False

    if update_data.get("is_completed") is True:
        update_data["progress"] = 100
        update_data["completed_at"] = goal.completed_at or datetime.utcnow()
    elif update_data.get("is_completed") is False:
        if not percentage_progress_recorded:
            update_data["progress"] = min(goal.progress, 95)
        update_data["completed_at"] = None

    for field, value in update_data.items():
        setattr(goal, field, value)

    db.commit()
    db.refresh(goal)

    return goal


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = (
        db.query(Goal)
        .filter(
            Goal.id == goal_id,
            Goal.user_id == current_user.id,
        )
        .first()
    )

    if not goal:
        raise HTTPException(
            status_code=404,
            detail="Goal not found.",
        )

    db.query(GoalProgressEntry).filter(GoalProgressEntry.goal_id == goal.id).delete(synchronize_session=False)
    db.delete(goal)
    db.commit()

    return {
        "message": "Goal deleted successfully.",
    }
