from datetime import date, datetime

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    target_date: date | None = None


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    target_date: date | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    is_completed: bool | None = None


class GoalResponse(BaseModel):
    id: int
    title: str
    description: str | None
    target_date: date | None
    progress: int
    is_completed: bool
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}
