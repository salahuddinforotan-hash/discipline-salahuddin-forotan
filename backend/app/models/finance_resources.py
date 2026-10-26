from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FinanceCategory(Base):
    __tablename__ = "finance_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "kind", "name", name="uq_finance_category_user_kind_name"),
        Index("ix_finance_category_user_kind_active", "user_id", "kind", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class FinanceBudget(Base):
    __tablename__ = "finance_budgets"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_finance_budget_positive_amount"),
        CheckConstraint("period IN ('weekly', 'monthly', 'yearly', 'custom')", name="ck_finance_budget_period"),
        Index("ix_finance_budget_user_dates", "user_id", "start_date", "end_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="AFN", nullable=False)
    period: Mapped[str] = mapped_column(String(10), nullable=False, default="monthly")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SavingsGoal(Base):
    __tablename__ = "finance_savings_goals"
    __table_args__ = (CheckConstraint("target_amount > 0", name="ck_savings_goal_positive_target"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="AFN", nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    activities: Mapped[list["SavingsActivity"]] = relationship(back_populates="goal", cascade="all, delete-orphan", order_by="SavingsActivity.activity_date.desc(), SavingsActivity.id.desc()")


class SavingsActivity(Base):
    __tablename__ = "finance_savings_activities"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_savings_activity_positive_amount"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("finance_savings_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(12), nullable=False, default="contribution")
    activity_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    goal: Mapped[SavingsGoal] = relationship(back_populates="activities")


class FinancialGoal(Base):
    __tablename__ = "finance_goals"
    __table_args__ = (CheckConstraint("target_amount > 0", name="ck_finance_goal_positive_target"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="AFN", nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    progress: Mapped[list["FinancialGoalProgress"]] = relationship(back_populates="goal", cascade="all, delete-orphan", order_by="FinancialGoalProgress.activity_date.desc(), FinancialGoalProgress.id.desc()")


class FinancialGoalProgress(Base):
    __tablename__ = "finance_goal_progress"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_finance_goal_progress_positive_amount"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("finance_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(12), nullable=False, default="contribution")
    activity_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    goal: Mapped[FinancialGoal] = relationship(back_populates="progress")


class RecurringFinanceTransaction(Base):
    __tablename__ = "finance_recurring_transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_recurring_finance_positive_amount"),
        CheckConstraint("kind IN ('income', 'expense')", name="ck_recurring_finance_kind"),
        CheckConstraint("frequency IN ('weekly', 'monthly', 'yearly')", name="ck_recurring_finance_frequency"),
        Index("ix_recurring_finance_user_active", "user_id", "is_active", "next_occurrence"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="AFN", nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    account_id: Mapped[int | None] = mapped_column(ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    frequency: Mapped[str] = mapped_column(String(10), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_occurrence: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
