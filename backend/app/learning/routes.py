from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.history.calendar import checked_month, month_fields, solar_month_key
from app.history.schemas import LearningHistoryDetail, LearningHistoryMonth
from app.learning.schemas import (
    LearningPlanCreate,
    LearningPlanResponse,
    LearningPlanUpdate,
)
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.user import User
from app.timezone import application_today


router = APIRouter(prefix="/api/learning", tags=["Learning"])


def get_user_plan(plan_id: int, db: Session, user_id: int) -> LearningPlan:
    plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.id == plan_id, LearningPlan.user_id == user_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    return plan


@router.get("/", response_model=list[LearningPlanResponse])
def get_learning_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LearningPlan)
        .filter(LearningPlan.user_id == current_user.id)
        .order_by(LearningPlan.target_date.asc(), LearningPlan.created_at.desc())
        .all()
    )


def _monthly_learning_data(db: Session, current_user: User):
    plans = (
        db.query(LearningPlan)
        .filter(LearningPlan.user_id == current_user.id)
        .order_by(LearningPlan.created_at.desc())
        .all()
    )
    plan_by_id = {plan.id: plan for plan in plans}
    plan_ids = list(plan_by_id)
    progress = (
        db.query(LearningProgress)
        .filter(LearningProgress.learning_plan_id.in_(plan_ids))
        .order_by(LearningProgress.activity_date.desc(), LearningProgress.id.desc())
        .all()
        if plan_ids
        else []
    )
    return plans, plan_by_id, progress


@router.get("/monthly-history", response_model=list[LearningHistoryMonth])
def get_learning_monthly_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plans, _, progress = _monthly_learning_data(db, current_user)
    grouped_plans: dict[tuple[int, int], list[LearningPlan]] = {}
    grouped_progress: dict[tuple[int, int], list[LearningProgress]] = {}
    for plan in plans:
        grouped_plans.setdefault(solar_month_key(plan.created_at), []).append(plan)
    for update in progress:
        grouped_progress.setdefault(solar_month_key(update.activity_date), []).append(update)
    month_keys = set(grouped_plans) | set(grouped_progress)
    return [
        {
            **month_fields(year, month),
            "plans_added": len(grouped_plans.get((year, month), [])),
            "pages_advanced": sum(
                max(0, update.to_page - update.from_page)
                for update in grouped_progress.get((year, month), [])
            ),
            "progress_updates": len(grouped_progress.get((year, month), [])),
        }
        for year, month in sorted(month_keys, reverse=True)
    ]


@router.get(
    "/monthly-history/{solar_year}/{solar_month}",
    response_model=LearningHistoryDetail,
)
def get_learning_monthly_history_detail(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, month = checked_month(solar_year, solar_month)
    plans, plan_by_id, progress = _monthly_learning_data(db, current_user)
    month_progress = [
        update for update in progress
        if solar_month_key(update.activity_date) == (year, month)
    ]
    month_plans = [
        plan for plan in plans
        if solar_month_key(plan.created_at) == (year, month)
    ]
    plan_ids = {plan.id for plan in month_plans}
    plan_ids.update(update.learning_plan_id for update in month_progress)
    if not plan_ids:
        raise HTTPException(status_code=404, detail="No learning activity exists for this month.")
    month_plans = [plan_by_id[plan_id] for plan_id in plan_ids]
    return {
        **month_fields(year, month),
        "plans_added": len([
            plan for plan in month_plans
            if solar_month_key(plan.created_at) == (year, month)
        ]),
        "pages_advanced": sum(max(0, update.to_page - update.from_page) for update in month_progress),
        "progress_updates": len(month_progress),
        "plans": month_plans,
        "progress_updates_detail": month_progress,
    }


@router.post("/", response_model=LearningPlanResponse, status_code=201)
def create_learning_plan(
    plan_data: LearningPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = LearningPlan(**plan_data.model_dump(), user_id=current_user.id)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/{plan_id}", response_model=LearningPlanResponse)
def update_learning_plan(
    plan_id: int,
    plan_data: LearningPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = get_user_plan(plan_id, db, current_user.id)
    update_data = plan_data.model_dump(exclude_unset=True)
    values = {
        "title": plan.title,
        "author": plan.author,
        "total_pages": plan.total_pages,
        "current_page": plan.current_page,
        "started_on": plan.started_on,
        "target_date": plan.target_date,
        "study_start_time": plan.study_start_time,
        "study_end_time": plan.study_end_time,
        **update_data,
    }
    if values["current_page"] > values["total_pages"]:
        raise HTTPException(status_code=422, detail="Current page cannot exceed total pages.")
    if values["target_date"] < values["started_on"]:
        raise HTTPException(status_code=422, detail="Target date must be on or after the start date.")
    if values["study_end_time"] <= values["study_start_time"]:
        raise HTTPException(status_code=422, detail="Study end time must be later than start time.")

    previous_page = plan.current_page
    for field, value in update_data.items():
        setattr(plan, field, value)
    current_page = update_data.get("current_page", plan.current_page)
    if current_page != previous_page:
        db.add(
            LearningProgress(
                learning_plan_id=plan.id,
                from_page=previous_page,
                to_page=current_page,
                activity_date=application_today(),
            )
        )
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def delete_learning_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = get_user_plan(plan_id, db, current_user.id)
    db.query(LearningProgress).filter(
        LearningProgress.learning_plan_id == plan.id
    ).delete(synchronize_session=False)
    db.delete(plan)
    db.commit()
    return {"message": "Study plan deleted successfully."}
