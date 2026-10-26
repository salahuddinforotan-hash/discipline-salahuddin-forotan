from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.account.schemas import (
    AccountDeletionRequest,
    AppSettingsPayload,
    PasswordUpdate,
    ProfileUpdate,
)
from app.models.ai import AIConversation, AIMessage, AIUserSettings
from app.auth.dependencies import get_current_user
from app.auth.password import hash_password, verify_password
from app.database import get_db
from app.models.account_settings import AccountSettings
from app.models.finance_entry import FinanceEntry
from app.models.goal import Goal, GoalProgressEntry
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.habit_progress import HabitProgress
from app.models.journal_entry import JournalEntry
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User


router = APIRouter(prefix="/api/account", tags=["Account and settings"])


def current_settings(db: Session, user_id: int) -> AccountSettingsPayload:
    record = db.query(AccountSettings).filter(AccountSettings.user_id == user_id).first()
    if not record:
        return AppSettingsPayload()
    return AppSettingsPayload.model_validate(record.preferences)


@router.get("/settings", response_model=AppSettingsPayload)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return current_settings(db, current_user.id)


@router.put("/settings", response_model=AppSettingsPayload)
def save_settings(
    settings_data: AppSettingsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(AccountSettings).filter(AccountSettings.user_id == current_user.id).first()
    if record is None:
        record = AccountSettings(user_id=current_user.id, preferences={})
        db.add(record)

    record.preferences = settings_data.model_dump(mode="json")
    db.commit()
    db.refresh(record)
    return AppSettingsPayload.model_validate(record.preferences)


@router.patch("/profile")
def update_profile(
    profile: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_email = str(profile.email).lower()
    email_owner = (
        db.query(User)
        .filter(func.lower(User.email) == normalized_email, User.id != current_user.id)
        .first()
    )
    if email_owner:
        raise HTTPException(status_code=409, detail="That email address is already in use.")

    current_user.full_name = profile.full_name.strip()
    current_user.email = normalized_email
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
    }


@router.post("/password")
def update_password(
    password_data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if verify_password(password_data.new_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Choose a password you have not used before.")

    current_user.password_hash = hash_password(password_data.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


def export_rows(db: Session, model, user_id: int):
    return [
        {
            column.name: getattr(row, column.name)
            for column in model.__table__.columns
            if column.name not in {"password_hash"}
        }
        for row in db.query(model).filter(model.user_id == user_id).all()
    ]


@router.get("/export")
def export_account_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habits = db.query(Habit).filter(Habit.user_id == current_user.id).all()
    habit_ids = [habit.id for habit in habits]
    completions = (
        db.query(HabitCompletion)
        .filter(HabitCompletion.habit_id.in_(habit_ids))
        .all()
        if habit_ids
        else []
    )
    habit_progress = db.query(HabitProgress).filter(HabitProgress.habit_id.in_(habit_ids)).all() if habit_ids else []
    goal_ids = [goal_id for (goal_id,) in db.query(Goal.id).filter(Goal.user_id == current_user.id).all()]
    goal_progress = db.query(GoalProgressEntry).filter(GoalProgressEntry.goal_id.in_(goal_ids)).all() if goal_ids else []
    learning_plan_ids = [
        plan_id
        for (plan_id,) in db.query(LearningPlan.id).filter(
            LearningPlan.user_id == current_user.id
        ).all()
    ]
    learning_progress = (
        db.query(LearningProgress)
        .filter(LearningProgress.learning_plan_id.in_(learning_plan_ids))
        .all()
        if learning_plan_ids
        else []
    )
    ai_conversations = db.query(AIConversation).filter(AIConversation.user_id == current_user.id).all()
    ai_conversation_ids = [conversation.id for conversation in ai_conversations]
    ai_messages = db.query(AIMessage).filter(AIMessage.conversation_id.in_(ai_conversation_ids)).all() if ai_conversation_ids else []
    ai_settings = db.query(AIUserSettings).filter_by(user_id=current_user.id).first()
    return {
        "exported_for": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
        },
        "settings": current_settings(db, current_user.id).model_dump(mode="json"),
        "tasks": export_rows(db, Task, current_user.id),
        "goals": export_rows(db, Goal, current_user.id),
        "goal_progress": goal_progress,
        "habits": habits,
        "habit_completions": completions,
        "habit_progress": habit_progress,
        "finance_entries": export_rows(db, FinanceEntry, current_user.id),
        "learning_plans": export_rows(db, LearningPlan, current_user.id),
        "learning_progress": learning_progress,
        "journal_entries": export_rows(db, JournalEntry, current_user.id),
        "notifications": export_rows(db, Notification, current_user.id),
        "ai_settings": {
            "memory_enabled": ai_settings.memory_enabled,
            "journal_sharing_enabled": ai_settings.journal_sharing_enabled,
        } if ai_settings else {"memory_enabled": True, "journal_sharing_enabled": False},
        "ai_conversations": ai_conversations,
        "ai_messages": ai_messages,
    }


@router.post("/delete")
def delete_account(
    request: AccountDeletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    db.query(HabitCompletion).filter(
        HabitCompletion.habit_id.in_(db.query(Habit.id).filter(Habit.user_id == current_user.id))
    ).delete(synchronize_session=False)
    db.query(HabitProgress).filter(
        HabitProgress.habit_id.in_(db.query(Habit.id).filter(Habit.user_id == current_user.id))
    ).delete(synchronize_session=False)
    db.query(GoalProgressEntry).filter(
        GoalProgressEntry.goal_id.in_(db.query(Goal.id).filter(Goal.user_id == current_user.id))
    ).delete(synchronize_session=False)
    db.query(LearningProgress).filter(
        LearningProgress.learning_plan_id.in_(
            db.query(LearningPlan.id).filter(LearningPlan.user_id == current_user.id)
        )
    ).delete(synchronize_session=False)
    for model in (Notification, Task, Goal, FinanceEntry, LearningPlan, JournalEntry, AccountSettings, Habit):
        db.query(model).filter(model.user_id == current_user.id).delete(synchronize_session=False)

    user_conversations = db.query(AIConversation).filter_by(user_id=current_user.id).all()
    conversation_ids = [conversation.id for conversation in user_conversations]
    if conversation_ids:
        db.query(AIMessage).filter(AIMessage.conversation_id.in_(conversation_ids)).delete(synchronize_session=False)
        db.query(AIConversation).filter(AIConversation.id.in_(conversation_ids)).delete(synchronize_session=False)
    db.query(AIUserSettings).filter_by(user_id=current_user.id).delete(synchronize_session=False)

    db.delete(current_user)
    db.commit()
    return {"message": "Account and associated data deleted."}
