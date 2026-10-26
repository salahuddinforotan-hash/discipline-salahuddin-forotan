from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


Mood = Literal["happy", "calm", "neutral", "sad", "frustrated", "motivated"]
Theme = Literal["dark", "light", "system"]
Accent = Literal["indigo", "violet", "blue", "emerald", "rose"]
Language = Literal["en", "fa"]


class AccountPreferences(BaseModel):
    profile_picture: str | None = Field(default=None, max_length=2_100_000)

    @field_validator("profile_picture")
    @classmethod
    def validate_profile_picture(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed_prefixes = (
            "data:image/png;base64,",
            "data:image/jpeg;base64,",
            "data:image/webp;base64,",
        )
        if not value.startswith(allowed_prefixes):
            raise ValueError("Use a PNG, JPEG, or WebP profile picture.")
        return value


class NotificationPreferences(BaseModel):
    late_tasks: bool = True
    missed_habits: bool = True
    goal_deadlines: bool = True
    daily_discipline: bool = True
    journal_reminder: bool = True
    sound: Literal["alarm", "system"] = "alarm"


class DisciplinePreferences(BaseModel):
    reminder_time: str = "20:00"
    daily_goal: int = Field(default=80, ge=0, le=100)
    streak_reminders: bool = True


class AppearancePreferences(BaseModel):
    theme: Theme = "dark"
    accent: Accent = "indigo"
    compact_sidebar: bool = False
    language: Language = "en"
    reduce_animations: bool = False


class JournalPreferences(BaseModel):
    default_mood: Mood | None = "calm"


class FinancePreferences(BaseModel):
    currency: Literal["AFN"] = "AFN"
    monthly_spending_alert: bool = True
    monthly_spending_limit: float = Field(default=0, ge=0, le=1_000_000_000_000)


class CalendarPreferences(BaseModel):
    calendar: Literal["solar", "gregorian"] = "solar"
    week_start: Literal["monday", "sunday"] = "monday"


class AppSettingsPayload(BaseModel):
    account: AccountPreferences = Field(default_factory=AccountPreferences)
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)
    discipline: DisciplinePreferences = Field(default_factory=DisciplinePreferences)
    appearance: AppearancePreferences = Field(default_factory=AppearancePreferences)
    journal: JournalPreferences = Field(default_factory=JournalPreferences)
    finance: FinancePreferences = Field(default_factory=FinancePreferences)
    date_calendar: CalendarPreferences = Field(default_factory=CalendarPreferences)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AccountDeletionRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    confirmation: Literal["DELETE"]
