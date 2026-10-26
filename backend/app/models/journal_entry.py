from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_journal_user_entry_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    mood: Mapped[str | None] = mapped_column(String(24), nullable=True)
    answers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)

    tasks_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tasks_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    habits_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    habits_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active_goals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    goal_progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discipline_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
