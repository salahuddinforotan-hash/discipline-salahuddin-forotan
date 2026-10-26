from sqlalchemy import String, inspect, text
from sqlalchemy.engine import Engine


def upgrade_ai_settings(engine: Engine) -> None:
    """Add non-secret per-user AI provider/model preferences to older databases."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("ai_user_settings"):
            return

        columns = {column["name"] for column in inspector.get_columns("ai_user_settings")}
        for name, column_type in (("provider", String(30)), ("model", String(120))):
            if name in columns:
                continue
            sql_type = column_type.compile(dialect=connection.dialect)
            connection.execute(
                text(f'ALTER TABLE ai_user_settings ADD COLUMN "{name}" {sql_type}')
            )
