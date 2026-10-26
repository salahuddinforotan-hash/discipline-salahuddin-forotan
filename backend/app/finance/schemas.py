from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


EntryKind = Literal["income", "expense"]
CurrencyCode = str


class FinanceEntryCreate(BaseModel):
    kind: EntryKind
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: CurrencyCode = Field(default="AFN", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    entry_date: date
    notes: str | None = Field(default=None, max_length=2000)
    source: str = Field(default="manual", min_length=1, max_length=40)
    account_id: int | None = None


class FinanceEntryUpdate(BaseModel):
    kind: EntryKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    currency: CurrencyCode | None = Field(default=None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    entry_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, min_length=1, max_length=40)
    account_id: int | None = None


class FinanceEntryResponse(BaseModel):
    id: int
    kind: EntryKind
    title: str
    category: str
    amount: Decimal
    currency: CurrencyCode
    entry_date: date
    notes: str | None
    source: str = "manual"
    account_id: int | None = None
    created_at: datetime
    updated_at: datetime
    user_id: int

    model_config = {"from_attributes": True}


class FinanceMonthlyReportSummary(BaseModel):
    solar_year: int
    solar_month: int
    month_name: str
    total_income: Decimal
    total_expenses: Decimal
    balance: Decimal
    income_count: int
    expense_count: int
    totals_by_currency: list["FinanceCurrencyTotals"] = Field(default_factory=list)


class FinanceCurrencyTotals(BaseModel):
    currency: str
    total_income: Decimal
    total_expenses: Decimal
    balance: Decimal


class FinanceMonthlyReportDetail(FinanceMonthlyReportSummary):
    income_transactions: list[FinanceEntryResponse]
    expense_transactions: list[FinanceEntryResponse]
    transactions: list[FinanceEntryResponse]


FinanceMonthlyReportSummary.model_rebuild()
