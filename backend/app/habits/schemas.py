from datetime import date, datetime

from pydantic import BaseModel, Field


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    frequency: str = Field(default="daily", pattern="^(daily|weekly)$")


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    frequency: str | None = Field(default=None, pattern="^(daily|weekly)$")
    is_active: bool | None = None


class HabitResponse(BaseModel):
    id: int
    name: str
    description: str | None
    frequency: str
    is_active: bool
    current_streak: int
    longest_streak: int
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}


class HabitCompletionResponse(BaseModel):
    id: int
    habit_id: int
    completion_date: date
    created_at: datetime

    model_config = {"from_attributes": True}
