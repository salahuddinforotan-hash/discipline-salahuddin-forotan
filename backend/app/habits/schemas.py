from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    frequency: Literal["daily", "weekly", "monthly"] = "daily"
    reminder_time: time | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    tracking_type: Literal["yes_no", "measurable"] = "yes_no"
    daily_target: float | None = Field(default=None, gt=0)
    target_unit: str | None = Field(default=None, min_length=1, max_length=40)


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    frequency: Literal["daily", "weekly", "monthly"] | None = None
    reminder_time: time | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None
    tracking_type: Literal["yes_no", "measurable"] | None = None
    daily_target: float | None = Field(default=None, gt=0)
    target_unit: str | None = Field(default=None, min_length=1, max_length=40)


class HabitResponse(BaseModel):
    id: int
    name: str
    description: str | None
    frequency: str
    reminder_time: time | None
    day_of_month: int | None
    tracking_type: str = "yes_no"
    daily_target: float | None = None
    target_unit: str | None = None
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


class HabitProgressCreate(BaseModel):
    amount: float = Field(gt=0)
    entry_date: date
    note: str | None = Field(default=None, max_length=2000)


class HabitProgressResponse(BaseModel):
    id: int
    habit_id: int
    amount: float
    unit: str
    entry_date: date
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
