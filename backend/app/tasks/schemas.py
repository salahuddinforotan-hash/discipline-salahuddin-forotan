from datetime import date, datetime

from datetime import time

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    due_date: date | None = None
    due_time: time | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_completed: bool | None = None
    due_date: date | None = None
    due_time: time | None = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None
    is_completed: bool
    completed_at: datetime | None = None
    due_date: date | None
    due_time: time | None
    created_at: datetime
    user_id: int

    model_config = {
        "from_attributes": True,
    }
