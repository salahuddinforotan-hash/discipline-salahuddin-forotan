from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class BankAccountResponse(BaseModel):
    id: int
    provider: str
    institution_name: str
    account_name: str
    masked_account_number: str | None
    account_type: str | None
    currency: str
    current_balance: Decimal | None
    status: str
    last_synced_at: datetime | None
    last_imported_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BankTransactionResponse(BaseModel):
    id: int
    bank_account_id: int
    finance_entry_id: int | None
    transaction_date: date
    description: str
    amount: Decimal
    currency: str
    transaction_type: str
    category: str
    source: str
    imported_at: datetime

    model_config = {"from_attributes": True}


class StatementPreviewRow(BaseModel):
    row_number: int
    transaction_date: date
    description: str
    amount: Decimal
    currency: str
    transaction_type: str
    category: str
    fingerprint: str
    duplicate: bool


class StatementPreviewResponse(BaseModel):
    rows: list[StatementPreviewRow]
    invalid_rows: list[str]


class StatementImportResponse(BaseModel):
    status: str = "success"
    imported_transactions: int
    duplicates_skipped: int
    account: BankAccountResponse
    message: str
