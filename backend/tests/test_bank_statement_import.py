import os
import unittest
from decimal import Decimal
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "isolated-bank-test-key")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bank_accounts.routes import _fingerprint, _owned_account, _persist_statement_rows, _read_statement
from app.database import Base, settings
from app.models.bank_account import BankAccount, BankTransaction
from app.models.finance_entry import FinanceEntry
from app.models.user import User


class BankStatementImportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(
            self.engine,
            tables=[User.__table__, BankAccount.__table__, FinanceEntry.__table__, BankTransaction.__table__],
        )
        self.session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)()
        self.user = User(email="bank-test@example.com", password_hash="unused", full_name="Bank Test")
        self.other_user = User(email="bank-other@example.com", password_hash="unused", full_name="Other User")
        self.session.add_all([self.user, self.other_user])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(
            self.engine,
            tables=[User.__table__, BankAccount.__table__, FinanceEntry.__table__, BankTransaction.__table__],
        )
        self.engine.dispose()

    def test_statement_parser_fingerprints_transactions_and_reports_bad_rows(self):
        csv_data = (
            "Date,Description,Amount,Type,Currency,Reference\n"
            "2026-10-05,Salary,20000,Income,AFN,payroll-1\n"
            "not-a-date,Restaurant,500,Expense,AFN,\n"
        ).encode()

        rows, invalid = _read_statement(csv_data)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["amount"], Decimal("20000.00"))
        self.assertEqual(rows[0]["transaction_type"], "income")
        self.assertEqual(len(rows[0]["fingerprint"]), 64)
        self.assertTrue(invalid)
        same_transaction, _ = _read_statement(csv_data.splitlines()[0] + b"\n" + csv_data.splitlines()[1] + b"\n")
        self.assertEqual(_fingerprint(rows[0]), _fingerprint(same_transaction[0]))

    def test_reimport_skips_duplicates_and_keeps_one_finance_record(self):
        statement = (
            b"date,description,amount,type,currency,reference\n"
            b"2026-10-05,Salary,20000,income,AFN,payroll-1\n"
        )

        first = self._import(statement)
        second = self._import(statement)

        self.assertEqual(first["imported_transactions"], 1)
        self.assertEqual(second["imported_transactions"], 0)
        self.assertEqual(second["duplicates_skipped"], 1)
        self.assertEqual(self.session.query(BankTransaction).count(), 1)
        self.assertEqual(self.session.query(FinanceEntry).count(), 1)
        self.assertEqual(self.session.query(BankAccount).one().current_balance, None)

    def _import(self, statement):
        rows, invalid_rows = _read_statement(statement)
        return _persist_statement_rows(
            account_name="Personal account",
            last_four="1234",
            selected_rows="",
            db=self.session,
            current_user=self.user,
            rows=rows,
            invalid_rows=invalid_rows,
        )

    def test_account_access_is_user_scoped(self):
        account = BankAccount(
            user_id=self.user.id,
            provider="azizi",
            institution_name="Azizi Bank",
            account_name="Personal",
            masked_account_number="••••1234",
            currency="AFN",
            status="statement_import",
        )
        self.session.add(account)
        self.session.commit()

        with self.assertRaises(HTTPException) as error:
            _owned_account(self.session, self.other_user.id, account.id)
        self.assertEqual(error.exception.status_code, 404)

    def test_provider_state_never_claims_live_sync_without_an_adapter(self):
        with patch.object(settings, "azizi_bank_api_base_url", None), patch.object(
            settings, "azizi_bank_client_id", None
        ), patch.object(settings, "azizi_bank_client_secret", None):
            from app.bank_accounts.providers.azizi import azizi_connection_status

            self.assertEqual(azizi_connection_status()["status"], "not_configured")

        with patch.object(settings, "azizi_bank_api_base_url", "https://bank.example"), patch.object(
            settings, "azizi_bank_client_id", "configured"), patch.object(
            settings, "azizi_bank_client_secret", "configured"
        ):
            self.assertEqual(azizi_connection_status()["status"], "adapter_unavailable")


if __name__ == "__main__":
    unittest.main()
