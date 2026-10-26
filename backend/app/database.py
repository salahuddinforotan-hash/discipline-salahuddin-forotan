from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Date, DateTime, Float, Integer, String, Time, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    app_timezone: str = "Asia/Kabul"
    alert_check_interval_seconds: int = 60
    cors_allowed_origins: str = ""
    azizi_bank_api_base_url: str | None = None
    azizi_bank_client_id: str | None = None
    azizi_bank_client_secret: str | None = None
    azizi_bank_redirect_uri: str | None = None
    ai_provider: str | None = None
    ai_api_key: str | None = None
    ai_model: str | None = None
    ai_base_url: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    ai_request_timeout_seconds: int = 45

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()


def _sqlalchemy_database_url(value: str) -> str:
    """Use the psycopg 3 driver for standard hosted PostgreSQL URLs."""
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value.removeprefix("postgres://")
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value.removeprefix("postgresql://")
    return value


engine = create_engine(
    _sqlalchemy_database_url(settings.database_url),
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def upgrade_productivity_columns(target_engine=engine) -> None:
    """Add compatible scheduling and progress fields without rewriting existing records."""
    additions = {
        "tasks": {"due_time": Time(), "completed_at": DateTime()},
        "goals": {
            "start_date": Date(),
            "target_time": Time(),
            "completed_at": DateTime(),
            "target_amount": Float(),
            "current_amount": Float(),
            "unit": String(40),
        },
        "habits": {
            "reminder_time": Time(),
            "day_of_month": Integer(),
            "tracking_type": String(20),
            "daily_target": Float(),
            "target_unit": String(40),
        },
    }

    with target_engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in additions.items():
            if not inspector.has_table(table_name):
                continue

            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name in existing:
                    continue
                sql_type = column_type.compile(dialect=connection.dialect)
                connection.execute(
                    text(
                        f'ALTER TABLE "{table_name}" '
                        f'ADD COLUMN "{column_name}" {sql_type}'
                    )
                )
            if table_name == "habits":
                connection.execute(text("UPDATE habits SET tracking_type = 'yes_no' WHERE tracking_type IS NULL"))

        if inspector.has_table("goals"):
            connection.execute(
                text(
                    "UPDATE goals SET start_date = date(created_at) "
                    "WHERE start_date IS NULL"
                )
            )

