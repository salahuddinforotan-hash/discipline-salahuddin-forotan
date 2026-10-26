from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"
    __table_args__ = (
        Index("ix_bank_accounts_user_status", "user_id", "status"),
        UniqueConstraint("user_id", "provider", "account_name", "masked_account_number", name="uq_bank_account_user_name_mask"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="azizi")
    institution_name: Mapped[str] = mapped_column(String(100), nullable=False, default="Azizi Bank")
    account_name: Mapped[str] = mapped_column(String(100), nullable=False)
    masked_account_number: Mapped[str | None] = mapped_column(String(8), nullable=True)
    account_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AFN")
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="statement_import")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_imported_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    transactions: Mapped[list["BankTransaction"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    __table_args__ = (
        UniqueConstraint("bank_account_id", "fingerprint", name="uq_bank_transaction_fingerprint"),
        Index("ix_bank_transactions_account_date", "bank_account_id", "transaction_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    finance_entry_id: Mapped[int | None] = mapped_column(ForeignKey("finance_entries.id", ondelete="SET NULL"), nullable=True, unique=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AFN")
    transaction_type: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="statement_import")
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    account: Mapped[BankAccount] = relationship(back_populates="transactions")
