from datetime import date, datetime

from datetime import time

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    target_date: date | None = None
    target_time: time | None = None
    target_amount: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=40)


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    target_date: date | None = None
    target_time: time | None = None
    target_amount: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    progress: int | None = Field(default=None, ge=0, le=100)
    is_completed: bool | None = None


class GoalResponse(BaseModel):
    id: int
    title: str
    description: str | None
    start_date: date | None
    target_date: date | None
    target_time: time | None
    target_amount: float | None = None
    current_amount: float | None = None
    unit: str | None = None
    progress: int
    is_completed: bool
    completed_at: datetime | None
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}


class GoalProgressCreate(BaseModel):
    amount: float = Field(gt=0)
    entry_date: date
    note: str | None = Field(default=None, max_length=2000)


class GoalProgressResponse(BaseModel):
    id: int
    goal_id: int
    amount: float
    unit: str
    entry_date: date
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
