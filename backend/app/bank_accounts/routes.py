import csv
import hashlib
import io
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.bank_accounts.providers.azizi import azizi_connection_status
from app.bank_accounts.schemas import (
    BankAccountResponse,
    BankTransactionResponse,
    StatementImportResponse,
    StatementPreviewResponse,
)
from app.database import get_db
from app.models.bank_account import BankAccount, BankTransaction
from app.models.finance_entry import FinanceEntry
from app.models.user import User


router = APIRouter(prefix="/api/bank-accounts", tags=["Bank Accounts"])
MAX_STATEMENT_BYTES = 2 * 1024 * 1024
MAX_STATEMENT_ROWS = 2000


def _owned_account(db: Session, user_id: int, account_id: int) -> BankAccount:
    account = db.query(BankAccount).filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found.")
    return account


def _header(row: dict[str, str], *names: str) -> str | None:
    normalized = {str(key).strip().casefold().replace("_", " "): value for key, value in row.items() if key}
    for name in names:
        value = normalized.get(name.casefold().replace("_", " "))
        if value is not None and value.strip():
            return value.strip()
    return None


def _parse_date(value: str) -> date:
    value = value.strip()
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    raise ValueError("Date must use YYYY-MM-DD or DD/MM/YYYY format.")


def _fingerprint(row: dict) -> str:
    stable_reference = (row.get("reference") or "").strip()
    identity = {"reference": stable_reference} if stable_reference else {
        "date": row["transaction_date"].isoformat(),
        "description": row["description"].strip().casefold(),
        "amount": format(row["amount"], "f"),
        "currency": row["currency"],
        "kind": row["transaction_type"],
    }
    return hashlib.sha256(json.dumps(identity, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _read_statement(raw: bytes) -> tuple[list[dict], list[str]]:
    if len(raw) > MAX_STATEMENT_BYTES:
        raise HTTPException(status_code=413, detail="CSV file must be 2 MB or smaller.")
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV file must use UTF-8 encoding.") from exc
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV file must include a header row.")

    rows: list[dict] = []
    invalid: list[str] = []
    for row_number, row in enumerate(reader, start=2):
        if row_number > MAX_STATEMENT_ROWS + 1:
            invalid.append(f"Row {row_number}: maximum of {MAX_STATEMENT_ROWS} rows exceeded.")
            break
        if not any((value or "").strip() for value in row.values()):
            continue
        try:
            date_text = _header(row, "date", "transaction date", "transaction_date", "posted date")
            description = _header(row, "description", "details", "merchant", "narrative")
            amount_text = _header(row, "amount", "value")
            debit_text = _header(row, "debit", "withdrawal")
            credit_text = _header(row, "credit", "deposit")
            kind_text = (_header(row, "type", "transaction type", "transaction_type", "debit/credit") or "").casefold()
            if not date_text or not description or len(description) > 200:
                raise ValueError("Date and description are required (description maximum is 200 characters).")
            if debit_text and Decimal(debit_text.replace(",", "") or "0") != 0:
                amount = abs(Decimal(debit_text.replace(",", "")))
                kind = "expense"
            elif credit_text and Decimal(credit_text.replace(",", "") or "0") != 0:
                amount = abs(Decimal(credit_text.replace(",", "")))
                kind = "income"
            elif amount_text:
                amount = Decimal(amount_text.replace(",", "").strip())
                if kind_text in ("expense", "debit", "withdrawal", "out"):
                    kind = "expense"
                elif kind_text in ("income", "credit", "deposit", "in"):
                    kind = "income"
                else:
                    kind = "expense" if amount < 0 else "income"
                amount = abs(amount)
            else:
                raise ValueError("An amount or debit/credit column is required.")
            if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
                raise ValueError("Amount must be positive and have no more than two decimal places.")
            currency = (_header(row, "currency") or "AFN").upper()
            if len(currency) != 3 or not currency.isalpha():
                raise ValueError("Currency must be a three-letter code.")
            category = _header(row, "category") or ("Other" if kind == "expense" else "Other")
            reference = _header(row, "reference", "transaction id", "transaction_id", "ref")
            values = {
                "row_number": row_number,
                "transaction_date": _parse_date(date_text),
                "description": description,
                "amount": amount.quantize(Decimal("0.01")),
                "currency": currency,
                "transaction_type": kind,
                "category": category[:50],
                "reference": reference,
            }
            values["fingerprint"] = _fingerprint(values)
            rows.append(values)
        except (ValueError, InvalidOperation) as exc:
            invalid.append(f"Row {row_number}: {exc}")
    return rows, invalid


async def _file_bytes(file: UploadFile) -> bytes:
    if file.filename and not file.filename.casefold().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Import a CSV statement file.")
    raw = await file.read(MAX_STATEMENT_BYTES + 1)
    if len(raw) > MAX_STATEMENT_BYTES:
        raise HTTPException(status_code=413, detail="CSV file must be 2 MB or smaller.")
    return raw


@router.get("/connect/status")
def get_connection_status(current_user: User = Depends(get_current_user)):
    del current_user
    return azizi_connection_status()


@router.post("/connect")
def connect_azizi(current_user: User = Depends(get_current_user)):
    del current_user
    return azizi_connection_status()


@router.get("/", response_model=list[BankAccountResponse])
def get_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(BankAccount).filter_by(user_id=current_user.id).order_by(BankAccount.created_at.desc()).all()


@router.post("/statements/preview", response_model=StatementPreviewResponse)
async def preview_statement(
    file: UploadFile = File(...),
    account_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_fingerprints: set[str] = set()
    if account_id is not None:
        account = _owned_account(db, current_user.id, account_id)
        existing_fingerprints = {value[0] for value in db.query(BankTransaction.fingerprint).filter_by(bank_account_id=account.id).all()}
    rows, invalid_rows = _read_statement(await _file_bytes(file))
    seen: set[str] = set()
    preview = []
    for row in rows:
        fingerprint = row["fingerprint"]
        preview.append({**row, "duplicate": fingerprint in existing_fingerprints or fingerprint in seen})
        seen.add(fingerprint)
    return {"rows": preview, "invalid_rows": invalid_rows}


@router.post("/statements/import", response_model=StatementImportResponse, status_code=201)
async def import_statement(
    file: UploadFile = File(...),
    account_name: str = Form(default="Azizi Bank account", min_length=1, max_length=100),
    last_four: str = Form(default="", max_length=4),
    selected_rows: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows, invalid_rows = _read_statement(await _file_bytes(file))
    return _persist_statement_rows(
        db=db,
        current_user=current_user,
        rows=rows,
        invalid_rows=invalid_rows,
        account_name=account_name,
        last_four=last_four,
        selected_rows=selected_rows,
    )


def _persist_statement_rows(
    *,
    db: Session,
    current_user: User,
    rows: list[dict],
    invalid_rows: list[str],
    account_name: str,
    last_four: str,
    selected_rows: str,
):
    if last_four and (len(last_four) != 4 or not last_four.isdigit()):
        raise HTTPException(status_code=422, detail="Enter only the last four account digits, or leave this blank.")
    selected = {int(value) for value in selected_rows.split(",") if value.strip().isdigit()} if selected_rows.strip() else None
    if selected is not None:
        rows = [row for row in rows if row["row_number"] in selected]
    if not rows:
        raise HTTPException(status_code=422, detail=invalid_rows[0] if invalid_rows else "No valid transactions were found in this CSV file.")

    masked = f"••••{last_four}" if last_four else None
    account = db.query(BankAccount).filter_by(
        user_id=current_user.id, provider="azizi", account_name=account_name.strip(), masked_account_number=masked,
    ).first()
    if not account:
        account = BankAccount(
            user_id=current_user.id, provider="azizi", institution_name="Azizi Bank",
            account_name=account_name.strip(), masked_account_number=masked, currency="AFN",
            current_balance=None, status="statement_import",
        )
        db.add(account)
        db.flush()

    existing = {value[0] for value in db.query(BankTransaction.fingerprint).filter_by(bank_account_id=account.id).all()}
    imported = 0
    duplicates = 0
    for row in rows:
        fingerprint = row["fingerprint"]
        if fingerprint in existing:
            duplicates += 1
            continue
        entry = FinanceEntry(
            user_id=current_user.id,
            kind=row["transaction_type"],
            title=row["description"],
            category=row["category"],
            amount=row["amount"],
            currency=row["currency"],
            entry_date=row["transaction_date"],
            source="Azizi Bank statement import",
            account_id=account.id,
        )
        db.add(entry)
        db.flush()
        db.add(BankTransaction(
            bank_account_id=account.id,
            finance_entry_id=entry.id,
            fingerprint=fingerprint,
            transaction_date=row["transaction_date"],
            description=row["description"],
            amount=row["amount"],
            currency=row["currency"],
            transaction_type=row["transaction_type"],
            category=row["category"],
            source="statement_import",
        ))
        existing.add(fingerprint)
        imported += 1
    account.last_imported_at = datetime.utcnow()
    db.commit()
    db.refresh(account)
    return {
        "status": "success",
        "imported_transactions": imported,
        "duplicates_skipped": duplicates,
        "account": account,
        "message": f"Imported {imported} transaction(s); skipped {duplicates} duplicate(s).",
    }


@router.get("/{account_id}", response_model=BankAccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _owned_account(db, current_user.id, account_id)


@router.get("/{account_id}/transactions", response_model=list[BankTransactionResponse])
def get_account_transactions(
    account_id: int,
    kind: str | None = Query(default=None, pattern="^(income|expense)$"),
    search: str | None = Query(default=None, max_length=120),
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_account(db, current_user.id, account_id)
    query = db.query(BankTransaction).filter_by(bank_account_id=account_id)
    if kind:
        query = query.filter(BankTransaction.transaction_type == kind)
    if start_date:
        query = query.filter(BankTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(BankTransaction.transaction_date <= end_date)
    if search:
        query = query.filter(BankTransaction.description.ilike(f"%{search.strip()}%"))
    return query.order_by(BankTransaction.transaction_date.desc(), BankTransaction.id.desc()).limit(500).all()


@router.post("/{account_id}/sync")
def sync_account(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    account = _owned_account(db, current_user.id, account_id)
    del account
    return {
        "status": azizi_connection_status()["status"],
        "new_transactions": 0,
        "updated_transactions": 0,
        "duplicates_skipped": 0,
        "last_synced_at": None,
        "message": azizi_connection_status()["message"],
    }


@router.delete("/{account_id}")
def disconnect_account(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    account = _owned_account(db, current_user.id, account_id)
    account.status = "disconnected"
    db.commit()
    return {"message": "Bank account disconnected. Imported transactions remain in Finance."}
