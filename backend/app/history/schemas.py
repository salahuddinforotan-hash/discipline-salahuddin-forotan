from datetime import date, datetime
from pydantic import BaseModel

from app.goals.schemas import GoalProgressResponse, GoalResponse
from app.habits.schemas import HabitCompletionResponse, HabitProgressResponse, HabitResponse
from app.journal.schemas import JournalEntryResponse
from app.learning.schemas import LearningPlanResponse
from app.tasks.schemas import TaskResponse


class SolarHistoryMonth(BaseModel):
    solar_year: int
    solar_month: int
    month_name: str


class TaskHistoryMonth(SolarHistoryMonth):
    total_tasks: int
    completed_tasks: int
    incomplete_tasks: int


class TaskHistoryDetail(TaskHistoryMonth):
    tasks: list[TaskResponse]


class GoalHistoryMonth(SolarHistoryMonth):
    started_count: int
    completed_count: int


class GoalHistoryDetail(GoalHistoryMonth):
    goals: list[GoalResponse]
    progress_entries: list[GoalProgressResponse] = []


class HabitHistoryMonth(SolarHistoryMonth):
    added_habits: int
    completion_count: int
    completed_habits: int
    progress_count: int = 0


class HabitHistoryDetail(HabitHistoryMonth):
    habits: list[HabitResponse]
    completions: list[HabitCompletionResponse]
    progress_entries: list[HabitProgressResponse] = []


class LearningProgressResponse(BaseModel):
    id: int
    learning_plan_id: int
    from_page: int
    to_page: int
    activity_date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class LearningHistoryMonth(SolarHistoryMonth):
    plans_added: int
    pages_advanced: int
    progress_updates: int


class LearningHistoryDetail(LearningHistoryMonth):
    plans: list[LearningPlanResponse]
    progress_updates_detail: list[LearningProgressResponse]


class JournalHistoryMonth(SolarHistoryMonth):
    entry_count: int
    average_discipline_score: int | None


class JournalHistoryDetail(JournalHistoryMonth):
    entries: list[JournalEntryResponse]


