from datetime import date, datetime

from pydantic import BaseModel, Field


class JournalEntryUpsert(BaseModel):
    mood: str | None = Field(default=None, max_length=24)
    answers: dict[str, str] = Field(default_factory=dict)


class DisciplineSnapshot(BaseModel):
    entry_date: date
    tasks_completed: int
    tasks_total: int
    habits_completed: int
    habits_total: int
    active_goals: int
    goal_progress: int | None
    journal_completed: bool
    discipline_score: int


class JournalEntryResponse(BaseModel):
    id: int
    entry_date: date
    mood: str | None
    answers: dict[str, str]
    tasks_completed: int
    tasks_total: int
    habits_completed: int
    habits_total: int
    active_goals: int
    goal_progress: int | None
    discipline_score: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
