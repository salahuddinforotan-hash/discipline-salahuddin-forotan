from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AIStatusResponse(BaseModel):
    configured: bool
    provider: str | None
    model: str | None
    local: bool
    data_sent_externally: bool
    message: str


class AISettingsPayload(BaseModel):
    memory_enabled: bool = True
    journal_sharing_enabled: bool = False
    provider: Literal["server-default", "ollama", "openai", "openai-compatible"] = "server-default"
    model: str | None = Field(default=None, max_length=120)

    @field_validator("model")
    @classmethod
    def normalize_model(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    model_config = {"from_attributes": True}


class AIConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIMessageResponse(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AIAction(BaseModel):
    type: Literal["create_task"]
    title: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    due_time: time | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank.")
        return value


class AIChatResponse(BaseModel):
    conversation_id: int
    reply: str
    action: AIAction | None = None


class AITaskActionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    due_date: date | None = None
    due_time: time | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value
