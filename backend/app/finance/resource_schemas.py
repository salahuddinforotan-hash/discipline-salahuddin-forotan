from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.finance.schemas import EntryKind, FinanceEntryResponse


CurrencyCode = Annotated[str, StringConstraints(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")]


class CurrencyTotal(BaseModel):
    currency: str
    amount: Decimal


class FinanceOverviewResponse(BaseModel):
    solar_year: int
    solar_month: int
    month_name: str
    current_balances: list[CurrencyTotal]
    month_income: list[CurrencyTotal]
    month_expenses: list[CurrencyTotal]
    savings_total: list[CurrencyTotal]
    budget_status: list["FinanceBudgetResponse"]


class FinanceCategoryCreate(BaseModel):
    kind: EntryKind
    name: str = Field(min_length=1, max_length=50)


class FinanceCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None


class FinanceCategoryResponse(BaseModel):
    id: int | None
    kind: EntryKind
    name: str
    is_active: bool
    is_default: bool = False

    model_config = {"from_attributes": True}


class FinanceBudgetCreate(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode = "AFN"
    period: Literal["weekly", "monthly", "yearly", "custom"] = "monthly"
    start_date: date
    end_date: date
    is_active: bool = True


class FinanceBudgetUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=50)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode | None = None
    period: Literal["weekly", "monthly", "yearly", "custom"] | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class FinanceBudgetResponse(BaseModel):
    id: int
    category: str
    amount: Decimal
    currency: str
    period: str
    start_date: date
    end_date: date
    is_active: bool
    spent: Decimal
    remaining: Decimal
    percent_used: float
    status: Literal["on_track", "approaching", "over_budget", "inactive"]
    created_at: datetime
    updated_at: datetime


class FinanceBudgetDetail(FinanceBudgetResponse):
    expenses: list[FinanceEntryResponse] = []


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    initial_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode = "AFN"
    deadline: date | None = None
    description: str | None = Field(default=None, max_length=2000)


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode | None = None
    deadline: date | None = None
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class SavingsActivityCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    direction: Literal["contribution", "withdrawal"] = "contribution"
    activity_date: date
    notes: str | None = Field(default=None, max_length=2000)


class SavingsActivityResponse(BaseModel):
    id: int
    goal_id: int
    amount: Decimal
    direction: Literal["contribution", "withdrawal"]
    activity_date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SavingsGoalResponse(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    currency: str
    deadline: date | None
    description: str | None
    is_active: bool
    progress: float
    created_at: datetime
    updated_at: datetime
    activities: list[SavingsActivityResponse] = Field(default_factory=list)


class FinancialGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    initial_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode = "AFN"
    deadline: date | None = None
    description: str | None = Field(default=None, max_length=2000)


class FinancialGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    deadline: date | None = None
    description: str | None = Field(default=None, max_length=2000)
    is_completed: bool | None = None


class FinancialGoalProgressCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    direction: Literal["contribution", "withdrawal"] = "contribution"
    activity_date: date
    notes: str | None = Field(default=None, max_length=2000)


class FinancialGoalProgressResponse(BaseModel):
    id: int
    goal_id: int
    amount: Decimal
    direction: Literal["contribution", "withdrawal"]
    activity_date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FinancialGoalResponse(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    currency: str
    deadline: date | None
    description: str | None
    is_completed: bool
    progress: float
    created_at: datetime
    updated_at: datetime
    progress_history: list[FinancialGoalProgressResponse] = Field(default_factory=list)


class RecurringFinanceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: EntryKind
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode = "AFN"
    category: str = Field(min_length=1, max_length=50)
    account_id: int | None = None
    frequency: Literal["weekly", "monthly", "yearly"]
    start_date: date
    end_date: date | None = None
    next_occurrence: date
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=2000)


class RecurringFinanceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: EntryKind | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: CurrencyCode | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    account_id: int | None = None
    frequency: Literal["weekly", "monthly", "yearly"] | None = None
    start_date: date | None = None
    end_date: date | None = None
    next_occurrence: date | None = None
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class RecurringFinanceResponse(BaseModel):
    id: int
    name: str
    kind: EntryKind
    amount: Decimal
    currency: str
    category: str
    account_id: int | None
    frequency: str
    start_date: date
    end_date: date | None
    next_occurrence: date
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FinanceTransactionPage(BaseModel):
    items: list[FinanceEntryResponse]
    total: int
    limit: int
    offset: int
