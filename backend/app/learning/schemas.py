from datetime import date, datetime, time

from pydantic import BaseModel, Field, model_validator


class LearningPlanFields(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str | None = Field(default=None, max_length=160)
    total_pages: int = Field(ge=1, le=100000)
    current_page: int = Field(default=0, ge=0, le=100000)
    started_on: date
    target_date: date
    study_start_time: time
    study_end_time: time
    study_days_per_week: int = Field(default=7, ge=1, le=7)


class LearningPlanCreate(LearningPlanFields):
    @model_validator(mode="after")
    def validate_plan(self):
        if self.current_page > self.total_pages:
            raise ValueError("Current page cannot exceed total pages.")
        if self.target_date < self.started_on:
            raise ValueError("Target date must be on or after the start date.")
        if self.study_end_time <= self.study_start_time:
            raise ValueError("Study end time must be later than start time.")
        return self


class LearningPlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, max_length=160)
    total_pages: int | None = Field(default=None, ge=1, le=100000)
    current_page: int | None = Field(default=None, ge=0, le=100000)
    started_on: date | None = None
    target_date: date | None = None
    study_start_time: time | None = None
    study_end_time: time | None = None
    study_days_per_week: int | None = Field(default=None, ge=1, le=7)


class LearningPlanResponse(BaseModel):
    id: int
    title: str
    author: str | None
    total_pages: int
    current_page: int
    started_on: date
    target_date: date
    study_start_time: time
    study_end_time: time
    study_days_per_week: int
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}
