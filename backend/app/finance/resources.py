from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.finance.calendar import (
    gregorian_to_solar_hijri,
    solar_hijri_month_name,
    solar_hijri_month_range,
)
from app.finance.resource_schemas import (
    CurrencyTotal,
    FinanceBudgetCreate,
    FinanceBudgetDetail,
    FinanceBudgetResponse,
    FinanceBudgetUpdate,
    FinanceCategoryCreate,
    FinanceCategoryResponse,
    FinanceCategoryUpdate,
    FinanceOverviewResponse,
    FinanceTransactionPage,
    FinancialGoalCreate,
    FinancialGoalProgressCreate,
    FinancialGoalProgressResponse,
    FinancialGoalResponse,
    FinancialGoalUpdate,
    RecurringFinanceCreate,
    RecurringFinanceResponse,
    RecurringFinanceUpdate,
    SavingsActivityCreate,
    SavingsActivityResponse,
    SavingsGoalCreate,
    SavingsGoalResponse,
    SavingsGoalUpdate,
)
from app.finance.schemas import FinanceEntryResponse
from app.models.bank_account import BankAccount
from app.models.finance_entry import FinanceEntry
from app.models.finance_resources import (
    FinanceBudget,
    FinanceCategory,
    FinancialGoal,
    FinancialGoalProgress,
    RecurringFinanceTransaction,
    SavingsActivity,
    SavingsGoal,
)
from app.models.user import User


router = APIRouter(tags=["Finance"])
ZERO = Decimal("0.00")

DEFAULT_CATEGORIES = {
    "income": ("Salary", "Freelance", "Business", "Investment", "Gift", "Bonus", "Other Income"),
    "expense": (
        "Housing", "Food", "Transport", "Utilities", "Health", "Education",
        "Shopping", "Bills", "Entertainment", "Other",
    ),
}


def _user_budget(db: Session, user_id: int, budget_id: int) -> FinanceBudget:
    budget = db.query(FinanceBudget).filter_by(id=budget_id, user_id=user_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found.")
    return budget


def _assert_no_overlapping_budget(
    db: Session,
    user_id: int,
    *,
    category: str,
    currency: str,
    start_date: date,
    end_date: date,
    is_active: bool,
    exclude_id: int | None = None,
) -> None:
    if not is_active:
        return
    conflicts = db.query(FinanceBudget).filter(
        FinanceBudget.user_id == user_id,
        FinanceBudget.is_active.is_(True),
        func.lower(FinanceBudget.category) == category.strip().casefold(),
        FinanceBudget.currency == currency,
        FinanceBudget.start_date <= end_date,
        FinanceBudget.end_date >= start_date,
    )
    if exclude_id is not None:
        conflicts = conflicts.filter(FinanceBudget.id != exclude_id)
    if conflicts.first():
        raise HTTPException(
            status_code=409,
            detail="An active budget already covers this category, currency, and overlapping period.",
        )


def _budget_expenses(db: Session, budget: FinanceBudget) -> list[FinanceEntry]:
    return (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.user_id == budget.user_id,
            FinanceEntry.kind == "expense",
            FinanceEntry.category == budget.category,
            FinanceEntry.currency == budget.currency,
            FinanceEntry.entry_date >= budget.start_date,
            FinanceEntry.entry_date <= budget.end_date,
        )
        .order_by(FinanceEntry.entry_date.desc(), FinanceEntry.id.desc())
        .all()
    )


def _user_savings_goal(db: Session, user_id: int, goal_id: int) -> SavingsGoal:
    goal = db.query(SavingsGoal).filter_by(id=goal_id, user_id=user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")
    return goal


def _user_financial_goal(db: Session, user_id: int, goal_id: int) -> FinancialGoal:
    goal = db.query(FinancialGoal).filter_by(id=goal_id, user_id=user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Financial goal not found.")
    return goal


def _validate_account(db: Session, user_id: int, account_id: int | None) -> None:
    if account_id is not None and not db.query(BankAccount.id).filter_by(id=account_id, user_id=user_id).first():
        raise HTTPException(status_code=404, detail="Finance account not found.")


def _budget_payload(db: Session, budget: FinanceBudget, today: date | None = None) -> dict:
    today = today or date.today()
    spent = db.query(func.coalesce(func.sum(FinanceEntry.amount), 0)).filter(
        FinanceEntry.user_id == budget.user_id,
        FinanceEntry.kind == "expense",
        FinanceEntry.category == budget.category,
        FinanceEntry.currency == budget.currency,
        FinanceEntry.entry_date >= budget.start_date,
        FinanceEntry.entry_date <= budget.end_date,
    ).scalar()
    spent_amount = Decimal(str(spent or 0))
    percent = float((spent_amount / budget.amount) * 100) if budget.amount else 0.0
    if not budget.is_active:
        status = "inactive"
    elif spent_amount >= budget.amount:
        status = "over_budget"
    elif percent >= 80:
        status = "approaching"
    else:
        status = "on_track"
    return {
        "id": budget.id,
        "category": budget.category,
        "amount": budget.amount,
        "currency": budget.currency,
        "period": budget.period,
        "start_date": budget.start_date,
        "end_date": budget.end_date,
        "is_active": budget.is_active,
        "spent": spent_amount,
        "remaining": budget.amount - spent_amount,
        "percent_used": round(percent, 2),
        "status": status,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
    }


def _activity_balance(activities: list) -> Decimal:
    total = ZERO
    for activity in activities:
        if activity.direction == "withdrawal":
            total -= activity.amount
        else:
            total += activity.amount
    return total


def _savings_payload(goal: SavingsGoal) -> dict:
    current = _activity_balance(goal.activities)
    return {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": current,
        "currency": goal.currency,
        "deadline": goal.deadline,
        "description": goal.description,
        "is_active": goal.is_active,
        "progress": round(float(current / goal.target_amount * 100), 2) if goal.target_amount else 0.0,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at,
        "activities": goal.activities,
    }


def _financial_goal_payload(goal: FinancialGoal) -> dict:
    current = _activity_balance(goal.progress)
    return {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": current,
        "currency": goal.currency,
        "deadline": goal.deadline,
        "description": goal.description,
        "is_completed": goal.is_completed,
        "progress": round(float(current / goal.target_amount * 100), 2) if goal.target_amount else 0.0,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at,
        "progress_history": goal.progress,
    }


@router.get("/transactions", response_model=FinanceTransactionPage)
def get_finance_transactions(
    kind: str | None = Query(default=None, pattern="^(income|expense)$"),
    category: str | None = Query(default=None, max_length=50),
    account_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    min_amount: Decimal | None = Query(default=None, ge=0),
    max_amount: Decimal | None = Query(default=None, ge=0),
    source: str | None = Query(default=None, max_length=40),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise HTTPException(status_code=422, detail="Minimum amount must not exceed maximum amount.")
    query = db.query(FinanceEntry).filter(FinanceEntry.user_id == current_user.id)
    if kind:
        query = query.filter(FinanceEntry.kind == kind)
    if category:
        query = query.filter(FinanceEntry.category == category)
    if account_id is not None:
        account = db.query(BankAccount.id).filter_by(id=account_id, user_id=current_user.id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Finance account not found.")
        query = query.filter(FinanceEntry.account_id == account_id)
    if start_date:
        query = query.filter(FinanceEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(FinanceEntry.entry_date <= end_date)
    if min_amount is not None:
        query = query.filter(FinanceEntry.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(FinanceEntry.amount <= max_amount)
    if source:
        query = query.filter(FinanceEntry.source == source)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            FinanceEntry.title.ilike(term)
            | FinanceEntry.category.ilike(term)
            | FinanceEntry.notes.ilike(term)
            | FinanceEntry.source.ilike(term)
        )
    total = query.count()
    items = query.order_by(FinanceEntry.entry_date.desc(), FinanceEntry.id.desc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/overview", response_model=FinanceOverviewResponse)
def get_finance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    solar_year, solar_month, _ = gregorian_to_solar_hijri(today)
    month_start, month_end = solar_hijri_month_range(solar_year, solar_month)

    totals = db.query(
        FinanceEntry.currency,
        FinanceEntry.kind,
        func.sum(FinanceEntry.amount),
    ).filter(FinanceEntry.user_id == current_user.id).group_by(FinanceEntry.currency, FinanceEntry.kind).all()
    balances: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for currency, kind, amount in totals:
        balances[currency] += amount if kind == "income" else -amount

    def month_totals(kind: str) -> list[CurrencyTotal]:
        rows = db.query(FinanceEntry.currency, func.sum(FinanceEntry.amount)).filter(
            FinanceEntry.user_id == current_user.id,
            FinanceEntry.kind == kind,
            FinanceEntry.entry_date >= month_start,
            FinanceEntry.entry_date < month_end,
        ).group_by(FinanceEntry.currency).all()
        return [CurrencyTotal(currency=currency, amount=amount) for currency, amount in rows]

    savings_rows = db.query(
        SavingsGoal.currency,
        func.coalesce(func.sum(case((SavingsActivity.direction == "withdrawal", -SavingsActivity.amount), else_=SavingsActivity.amount)), 0),
    ).join(SavingsActivity, SavingsActivity.goal_id == SavingsGoal.id).filter(
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active.is_(True),
    ).group_by(SavingsGoal.currency).all()
    budgets = db.query(FinanceBudget).filter(
        FinanceBudget.user_id == current_user.id,
        FinanceBudget.is_active.is_(True),
        FinanceBudget.start_date <= today,
        FinanceBudget.end_date >= today,
    ).order_by(FinanceBudget.end_date.asc()).limit(8).all()
    return {
        "solar_year": solar_year,
        "solar_month": solar_month,
        "month_name": solar_hijri_month_name(solar_month),
        "current_balances": [CurrencyTotal(currency=currency, amount=amount) for currency, amount in sorted(balances.items())],
        "month_income": month_totals("income"),
        "month_expenses": month_totals("expense"),
        "savings_total": [CurrencyTotal(currency=currency, amount=amount) for currency, amount in savings_rows],
        "budget_status": [_budget_payload(db, budget, today) for budget in budgets],
    }


@router.get("/categories", response_model=list[FinanceCategoryResponse])
def get_finance_categories(
    kind: str | None = Query(default=None, pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    custom_filters = [FinanceCategory.user_id == current_user.id]
    if kind:
        custom_filters.append(FinanceCategory.kind == kind)
    custom = db.query(FinanceCategory).filter(*custom_filters).order_by(FinanceCategory.name.asc()).all()
    result: list[FinanceCategoryResponse] = []
    for category_kind in (kind,) if kind else tuple(DEFAULT_CATEGORIES):
        custom_names = {item.name.casefold() for item in custom if item.kind == category_kind and item.is_active}
        result.extend(FinanceCategoryResponse(id=None, kind=category_kind, name=name, is_active=True, is_default=True) for name in DEFAULT_CATEGORIES[category_kind] if name.casefold() not in custom_names)
    result.extend(FinanceCategoryResponse.model_validate(item).model_copy(update={"is_default": False}) for item in custom)
    return result


@router.post("/categories", response_model=FinanceCategoryResponse, status_code=201)
def create_finance_category(data: FinanceCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required.")
    taken = name.casefold() in {item.casefold() for item in DEFAULT_CATEGORIES[data.kind]}
    taken = taken or db.query(FinanceCategory.id).filter(
        FinanceCategory.user_id == current_user.id,
        FinanceCategory.kind == data.kind,
        func.lower(FinanceCategory.name) == name.casefold(),
    ).first() is not None
    if taken:
        raise HTTPException(status_code=409, detail="That category already exists.")
    category = FinanceCategory(user_id=current_user.id, kind=data.kind, name=name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return FinanceCategoryResponse.model_validate(category).model_copy(update={"is_default": False})


@router.patch("/categories/{category_id}", response_model=FinanceCategoryResponse)
def update_finance_category(category_id: int, data: FinanceCategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    category = db.query(FinanceCategory).filter_by(id=category_id, user_id=current_user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        name = changes["name"].strip()
        if not name:
            raise HTTPException(status_code=422, detail="Category name is required.")
        duplicate = db.query(FinanceCategory.id).filter(
            FinanceCategory.user_id == current_user.id,
            FinanceCategory.kind == category.kind,
            FinanceCategory.id != category.id,
            func.lower(FinanceCategory.name) == name.casefold(),
        ).first()
        if duplicate or name.casefold() in {item.casefold() for item in DEFAULT_CATEGORIES[category.kind]}:
            raise HTTPException(status_code=409, detail="That category already exists.")
        changes["name"] = name
    for key, value in changes.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return FinanceCategoryResponse.model_validate(category).model_copy(update={"is_default": False})


@router.delete("/categories/{category_id}")
def archive_finance_category(category_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    category = db.query(FinanceCategory).filter_by(id=category_id, user_id=current_user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    category.is_active = False
    db.commit()
    return {"message": "Category archived. Historical transactions keep their saved category name."}


@router.get("/budgets", response_model=list[FinanceBudgetResponse])
def get_budgets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budgets = db.query(FinanceBudget).filter_by(user_id=current_user.id).order_by(FinanceBudget.start_date.desc(), FinanceBudget.id.desc()).all()
    return [_budget_payload(db, item) for item in budgets]


@router.post("/budgets", response_model=FinanceBudgetResponse, status_code=201)
def create_budget(data: FinanceBudgetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.start_date > data.end_date:
        raise HTTPException(status_code=422, detail="Budget end date must be on or after its start date.")
    _assert_no_overlapping_budget(
        db, current_user.id, category=data.category, currency=data.currency,
        start_date=data.start_date, end_date=data.end_date, is_active=data.is_active,
    )
    budget = FinanceBudget(user_id=current_user.id, **data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _budget_payload(db, budget)


@router.get("/budgets/{budget_id}", response_model=FinanceBudgetDetail)
def get_budget(budget_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = _user_budget(db, current_user.id, budget_id)
    return {**_budget_payload(db, budget), "expenses": _budget_expenses(db, budget)}


@router.patch("/budgets/{budget_id}", response_model=FinanceBudgetResponse)
def update_budget(budget_id: int, data: FinanceBudgetUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = _user_budget(db, current_user.id, budget_id)
    changes = data.model_dump(exclude_unset=True)
    start = changes.get("start_date", budget.start_date)
    end = changes.get("end_date", budget.end_date)
    if start > end:
        raise HTTPException(status_code=422, detail="Budget end date must be on or after its start date.")
    _assert_no_overlapping_budget(
        db, current_user.id,
        category=changes.get("category", budget.category),
        currency=changes.get("currency", budget.currency),
        start_date=start, end_date=end,
        is_active=changes.get("is_active", budget.is_active),
        exclude_id=budget.id,
    )
    for key, value in changes.items():
        setattr(budget, key, value)
    db.commit()
    db.refresh(budget)
    return _budget_payload(db, budget)


@router.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = _user_budget(db, current_user.id, budget_id)
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted."}


@router.get("/savings", response_model=list[SavingsGoalResponse])
def get_savings_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goals = db.query(SavingsGoal).filter_by(user_id=current_user.id).order_by(SavingsGoal.created_at.desc()).all()
    return [_savings_payload(goal) for goal in goals]


@router.post("/savings", response_model=SavingsGoalResponse, status_code=201)
def create_savings_goal(data: SavingsGoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    values = data.model_dump()
    initial = values.pop("initial_amount")
    goal = SavingsGoal(user_id=current_user.id, **values)
    db.add(goal)
    db.flush()
    if initial > 0:
        db.add(SavingsActivity(goal_id=goal.id, amount=initial, direction="contribution", activity_date=date.today(), notes="Initial saved amount"))
    db.commit()
    db.refresh(goal)
    return _savings_payload(goal)


@router.patch("/savings/{goal_id}", response_model=SavingsGoalResponse)
def update_savings_goal(goal_id: int, data: SavingsGoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_savings_goal(db, current_user.id, goal_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return _savings_payload(goal)


@router.delete("/savings/{goal_id}")
def delete_savings_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_savings_goal(db, current_user.id, goal_id)
    db.delete(goal)
    db.commit()
    return {"message": "Savings goal and its activity history deleted."}


@router.post("/savings/{goal_id}/contributions", response_model=SavingsActivityResponse, status_code=201)
def add_savings_activity(goal_id: int, data: SavingsActivityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_savings_goal(db, current_user.id, goal_id)
    if data.direction == "withdrawal" and data.amount > _activity_balance(goal.activities):
        raise HTTPException(status_code=422, detail="Withdrawal cannot exceed the saved amount.")
    activity = SavingsActivity(goal_id=goal.id, **data.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/financial-goals", response_model=list[FinancialGoalResponse])
def get_financial_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goals = db.query(FinancialGoal).filter_by(user_id=current_user.id).order_by(FinancialGoal.created_at.desc()).all()
    return [_financial_goal_payload(goal) for goal in goals]


@router.post("/financial-goals", response_model=FinancialGoalResponse, status_code=201)
def create_financial_goal(data: FinancialGoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    values = data.model_dump()
    initial = values.pop("initial_amount")
    goal = FinancialGoal(user_id=current_user.id, **values)
    db.add(goal)
    db.flush()
    if initial > 0:
        db.add(FinancialGoalProgress(goal_id=goal.id, amount=initial, direction="contribution", activity_date=date.today(), notes="Initial progress"))
    db.commit()
    db.refresh(goal)
    return _financial_goal_payload(goal)


@router.patch("/financial-goals/{goal_id}", response_model=FinancialGoalResponse)
def update_financial_goal(goal_id: int, data: FinancialGoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_financial_goal(db, current_user.id, goal_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return _financial_goal_payload(goal)


@router.delete("/financial-goals/{goal_id}")
def delete_financial_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_financial_goal(db, current_user.id, goal_id)
    db.delete(goal)
    db.commit()
    return {"message": "Financial goal and its progress history deleted."}


@router.post("/financial-goals/{goal_id}/progress", response_model=FinancialGoalProgressResponse, status_code=201)
def add_financial_goal_progress(goal_id: int, data: FinancialGoalProgressCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _user_financial_goal(db, current_user.id, goal_id)
    if data.direction == "withdrawal" and data.amount > _activity_balance(goal.progress):
        raise HTTPException(status_code=422, detail="Progress reduction cannot exceed the recorded amount.")
    entry = FinancialGoalProgress(goal_id=goal.id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/recurring-transactions", response_model=list[RecurringFinanceResponse])
def get_recurring_transactions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(RecurringFinanceTransaction).filter_by(user_id=current_user.id).order_by(RecurringFinanceTransaction.next_occurrence.asc()).all()


@router.post("/recurring-transactions", response_model=RecurringFinanceResponse, status_code=201)
def create_recurring_transaction(data: RecurringFinanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.end_date and data.end_date < data.start_date:
        raise HTTPException(status_code=422, detail="End date must be on or after the start date.")
    if data.next_occurrence < data.start_date or (data.end_date and data.next_occurrence > data.end_date):
        raise HTTPException(status_code=422, detail="Next occurrence must be within the schedule dates.")
    _validate_account(db, current_user.id, data.account_id)
    item = RecurringFinanceTransaction(user_id=current_user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/recurring-transactions/{item_id}", response_model=RecurringFinanceResponse)
def update_recurring_transaction(item_id: int, data: RecurringFinanceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(RecurringFinanceTransaction).filter_by(id=item_id, user_id=current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring transaction not found.")
    changes = data.model_dump(exclude_unset=True)
    if "account_id" in changes:
        _validate_account(db, current_user.id, changes["account_id"])
    start = changes.get("start_date", item.start_date)
    end = changes.get("end_date", item.end_date)
    next_date = changes.get("next_occurrence", item.next_occurrence)
    if end and end < start:
        raise HTTPException(status_code=422, detail="End date must be on or after the start date.")
    if next_date < start or (end and next_date > end):
        raise HTTPException(status_code=422, detail="Next occurrence must be within the schedule dates.")
    for key, value in changes.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/recurring-transactions/{item_id}")
def delete_recurring_transaction(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(RecurringFinanceTransaction).filter_by(id=item_id, user_id=current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring transaction not found.")
    db.delete(item)
    db.commit()
    return {"message": "Recurring schedule deleted. No transaction was automatically created."}
