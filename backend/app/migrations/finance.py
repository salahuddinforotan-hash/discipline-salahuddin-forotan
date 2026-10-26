from sqlalchemy import DateTime, String, inspect, text
from sqlalchemy.engine import Engine


def upgrade_finance_columns(engine: Engine) -> None:
    """Safely add update timestamps to old finance rows."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("finance_entries"):
            return

        columns = {column["name"] for column in inspector.get_columns("finance_entries")}
        if "updated_at" not in columns:
            sql_type = DateTime().compile(dialect=connection.dialect)
            connection.execute(
                text(f'ALTER TABLE finance_entries ADD COLUMN updated_at {sql_type}')
            )

        if "account_id" not in columns and inspector.has_table("bank_accounts"):
            connection.execute(
                text(
                    "ALTER TABLE finance_entries ADD COLUMN account_id INTEGER "
                    "REFERENCES bank_accounts(id) ON DELETE SET NULL"
                )
            )

        if "source" not in columns:
            source_type = String(40).compile(dialect=connection.dialect)
            connection.execute(
                text(
                    "ALTER TABLE finance_entries ADD COLUMN source "
                    f"{source_type} NOT NULL DEFAULT 'manual'"
                )
            )

        if "account_id" in columns or inspector.has_table("bank_accounts"):
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_finance_entries_account_id ON finance_entries (account_id)")
            )

        connection.execute(
            text("UPDATE finance_entries SET updated_at = created_at WHERE updated_at IS NULL")
        )

        if inspector.has_table("finance_recurring_transactions"):
            recurring_columns = {
                column["name"]
                for column in inspector.get_columns("finance_recurring_transactions")
            }
            if "account_id" not in recurring_columns and inspector.has_table("bank_accounts"):
                connection.execute(
                    text(
                        "ALTER TABLE finance_recurring_transactions ADD COLUMN account_id INTEGER "
                        "REFERENCES bank_accounts(id) ON DELETE SET NULL"
                    )
                )
