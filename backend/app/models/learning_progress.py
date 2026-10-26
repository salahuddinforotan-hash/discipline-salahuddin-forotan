from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LearningProgress(Base):
    """A dated record of a user's page-position update for a learning plan."""

    __tablename__ = "learning_progress"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    learning_plan_id: Mapped[int] = mapped_column(
        ForeignKey("learning_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_page: Mapped[int] = mapped_column(Integer, nullable=False)
    to_page: Mapped[int] = mapped_column(Integer, nullable=False)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
