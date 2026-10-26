from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.history.calendar import checked_month, group_by_month, month_fields, solar_month_key
from app.history.schemas import TaskHistoryDetail, TaskHistoryMonth
from app.models.task import Task
from app.models.user import User
from app.tasks.schemas import TaskCreate, TaskResponse, TaskUpdate


router = APIRouter(
    prefix="/api/tasks",
    tags=["Tasks"],
)


@router.post("/", response_model=TaskResponse)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_task = Task(
        title=task_data.title,
        description=task_data.description,
        due_date=task_data.due_date,
        due_time=task_data.due_time,
        user_id=current_user.id,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .all()
    )

    return tasks


@router.get("/completed", response_model=list[TaskResponse])
def get_completed_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.is_completed.is_(True))
        .order_by(Task.completed_at.desc().nullslast(), Task.created_at.desc())
        .all()
    )


@router.get("/monthly-history", response_model=list[TaskHistoryMonth])
def get_task_monthly_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .all()
    )
    grouped = group_by_month(
        tasks,
        lambda task: task.due_date or task.created_at,
    )
    return [
        {
            **month_fields(year, month),
            "total_tasks": len(month_tasks),
            "completed_tasks": sum(1 for task in month_tasks if task.is_completed),
            "incomplete_tasks": sum(1 for task in month_tasks if not task.is_completed),
        }
        for (year, month), month_tasks in sorted(grouped.items(), reverse=True)
    ]


@router.get(
    "/monthly-history/{solar_year}/{solar_month}",
    response_model=TaskHistoryDetail,
)
def get_task_monthly_history_detail(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year, month = checked_month(solar_year, solar_month)
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .all()
    )
    month_tasks = [
        task for task in tasks
        if solar_month_key(task.due_date or task.created_at) == (year, month)
    ]
    if not month_tasks:
        raise HTTPException(status_code=404, detail="No task activity exists for this month.")
    completed = sum(1 for task in month_tasks if task.is_completed)
    return {
        **month_fields(year, month),
        "total_tasks": len(month_tasks),
        "completed_tasks": completed,
        "incomplete_tasks": len(month_tasks) - completed,
        "tasks": month_tasks,
    }


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    update_data = task_data.model_dump(exclude_unset=True)

    if update_data.get("is_completed") is True and not task.is_completed:
        update_data["completed_at"] = datetime.utcnow()
    elif update_data.get("is_completed") is False and task.is_completed:
        update_data["completed_at"] = None

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully.",
    }
