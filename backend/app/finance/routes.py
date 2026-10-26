from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.finance.schemas import (
    FinanceEntryCreate,
    FinanceEntryResponse,
    FinanceEntryUpdate,
    FinanceMonthlyReportDetail,
    FinanceMonthlyReportSummary,
)
from app.finance.calendar import (
    gregorian_to_solar_hijri,
    solar_hijri_month_name,
    solar_hijri_month_range,
)
from app.finance.resources import router as finance_resources_router
from app.models.bank_account import BankAccount
from app.models.finance_entry import FinanceEntry
from app.models.user import User


router = APIRouter(prefix="/api/finance", tags=["Finance"])


def _validate_account(db: Session, user_id: int, account_id: int | None) -> None:
    if account_id is None:
        return
    if not db.query(BankAccount.id).filter_by(id=account_id, user_id=user_id).first():
        raise HTTPException(status_code=404, detail="Finance account not found.")


def _report_summary(year: int, month: int, entries: list[FinanceEntry]) -> dict:
    totals: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0"), "income_count": 0, "expense_count": 0}
    )
    for entry in entries:
        values = totals[entry.currency]
        kind_key = "income" if entry.kind == "income" else "expense"
        values[kind_key] += entry.amount
        values[f"{kind_key}_count"] += 1
    currencies = [
        {
            "currency": currency,
            "total_income": values["income"],
            "total_expenses": values["expense"],
            "balance": values["income"] - values["expense"],
        }
        for currency, values in sorted(totals.items())
    ]
    afn = totals.get("AFN", {"income": Decimal("0"), "expense": Decimal("0"), "income_count": 0, "expense_count": 0})
    return {
        "solar_year": year,
        "solar_month": month,
        "month_name": solar_hijri_month_name(month),
        "total_income": afn["income"],
        "total_expenses": afn["expense"],
        "balance": afn["income"] - afn["expense"],
        "income_count": afn["income_count"],
        "expense_count": afn["expense_count"],
        "totals_by_currency": currencies,
    }


@router.get("/", response_model=list[FinanceEntryResponse])
def get_finance_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(FinanceEntry)
        .filter(FinanceEntry.user_id == current_user.id)
        .order_by(FinanceEntry.entry_date.desc(), FinanceEntry.id.desc())
        .all()
    )


# Register fixed paths before the single-segment transaction-detail routes below.
router.include_router(finance_resources_router)


@router.get("/monthly-reports", response_model=list[FinanceMonthlyReportSummary])
def get_monthly_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    daily_totals = db.query(
        FinanceEntry.entry_date,
        FinanceEntry.kind,
        FinanceEntry.currency,
        func.sum(FinanceEntry.amount),
        func.count(FinanceEntry.id),
    ).filter(FinanceEntry.user_id == current_user.id).group_by(
        FinanceEntry.entry_date, FinanceEntry.kind, FinanceEntry.currency
    ).all()
    grouped: dict[tuple[int, int], dict[str, dict[str, Decimal | int]]] = defaultdict(
        lambda: defaultdict(lambda: {"income": Decimal("0"), "expense": Decimal("0"), "income_count": 0, "expense_count": 0})
    )
    for entry_date, kind, currency, amount, count in daily_totals:
        solar_year, solar_month, _ = gregorian_to_solar_hijri(entry_date)
        values = grouped[(solar_year, solar_month)][currency]
        kind_key = "income" if kind == "income" else "expense"
        values[kind_key] += amount
        values[f"{kind_key}_count"] += count

    reports = []
    for (year, month), month_totals in sorted(grouped.items(), reverse=True):
        currencies = [
            {
                "currency": currency,
                "total_income": values["income"],
                "total_expenses": values["expense"],
                "balance": values["income"] - values["expense"],
            }
            for currency, values in sorted(month_totals.items())
        ]
        afn = month_totals.get("AFN", {"income": Decimal("0"), "expense": Decimal("0"), "income_count": 0, "expense_count": 0})
        reports.append({
            "solar_year": year,
            "solar_month": month,
            "month_name": solar_hijri_month_name(month),
            "total_income": afn["income"],
            "total_expenses": afn["expense"],
            "balance": afn["income"] - afn["expense"],
            "income_count": afn["income_count"],
            "expense_count": afn["expense_count"],
            "totals_by_currency": currencies,
        })
    return reports


@router.get(
    "/monthly-reports/{solar_year}/{solar_month}",
    response_model=FinanceMonthlyReportDetail,
)
def get_monthly_report(
    solar_year: int,
    solar_month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not 1 <= solar_month <= 12:
        raise HTTPException(status_code=422, detail="Solar Hijri month must be from 1 to 12.")

    month_start, month_end = solar_hijri_month_range(solar_year, solar_month)
    month_entries = (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.user_id == current_user.id,
            FinanceEntry.entry_date >= month_start,
            FinanceEntry.entry_date < month_end,
        )
        .order_by(FinanceEntry.entry_date.desc(), FinanceEntry.id.desc())
        .all()
    )
    income_entries = [entry for entry in month_entries if entry.kind == "income"]
    expense_entries = [entry for entry in month_entries if entry.kind == "expense"]
    return {
        **_report_summary(solar_year, solar_month, month_entries),
        "income_transactions": income_entries,
        "expense_transactions": expense_entries,
        "transactions": month_entries,
    }


@router.post("/", response_model=FinanceEntryResponse, status_code=201)
def create_finance_entry(
    entry_data: FinanceEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_account(db, current_user.id, entry_data.account_id)
    entry = FinanceEntry(**entry_data.model_dump(), user_id=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=FinanceEntryResponse)
def get_finance_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(FinanceEntry).filter_by(id=entry_id, user_id=current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Finance transaction not found.")
    return entry


@router.patch("/{entry_id}", response_model=FinanceEntryResponse)
def update_finance_entry(
    entry_id: int,
    entry_data: FinanceEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.id == entry_id,
            FinanceEntry.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Finance entry not found.")

    changes = entry_data.model_dump(exclude_unset=True)
    if "account_id" in changes:
        _validate_account(db, current_user.id, changes["account_id"])
    for field, value in changes.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_finance_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.id == entry_id,
            FinanceEntry.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Finance entry not found.")

    db.delete(entry)
    db.commit()
    return {"message": "Finance entry deleted successfully."}
