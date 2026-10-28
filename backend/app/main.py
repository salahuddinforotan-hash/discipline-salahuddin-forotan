import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.ai.routes import router as ai_router
from app.account.routes import router as account_router
from app.bank_accounts.routes import router as bank_accounts_router
from app.auth.routes import router as auth_router
from app.database import Base, engine, settings, upgrade_productivity_columns
from app.models.account_settings import AccountSettings
from app.models.ai import AIConversation, AIMessage, AIUserSettings
from app.models.bank_account import BankAccount, BankTransaction
from app.finance.routes import router as finance_router
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
from app.journal.routes import router as journal_router
from app.models.journal_entry import JournalEntry
from app.learning.routes import router as learning_router
from app.migrations.notifications import upgrade_notifications
from app.migrations.finance import upgrade_finance_columns
from app.migrations.ai_settings import upgrade_ai_settings
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.goals.routes import router as goals_router
from app.habits.routes import router as habits_router
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.habit_progress import HabitProgress
from app.models.goal import GoalProgressEntry
from app.models.notification import Notification
from app.models.task import Task
from app.tasks.routes import router as tasks_router
from app.notifications.routes import router as notifications_router
from app.notifications.scheduler import notification_scheduler_loop


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend-dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


logger = logging.getLogger(__name__)


def initialize_database() -> None:
    """Create missing tables and apply additive migrations after app startup."""
    Base.metadata.create_all(
        bind=engine,
        tables=[table for table in Base.metadata.sorted_tables if table.name != Notification.__tablename__],
    )
    upgrade_productivity_columns()
    upgrade_notifications(engine)
    upgrade_finance_columns(engine)
    upgrade_ai_settings(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.database_ready = False
    scheduler = None
    try:
        initialize_database()
        app.state.database_ready = True
    except Exception as exc:
        # Keep the serverless function available for health checks and return a
        # controlled 503 from database-backed requests instead of failing import.
        logger.error("Database initialization failed (%s)", type(exc).__name__)

    if app.state.database_ready:
        scheduler = asyncio.create_task(notification_scheduler_loop())
        app.state.notification_scheduler = scheduler
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.cancel()
            with suppress(asyncio.CancelledError):
                await scheduler


app = FastAPI(
    title="Discipline API",
    description="Backend API for the Discipline personal productivity system.",
    version="0.3.0",
    lifespan=lifespan,
)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error("Database request failed (%s)", type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is temporarily unavailable."},
    )


configured_origins = [
    origin.strip().rstrip("/")
    for origin in settings.cors_allowed_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "https://localhost",
        "http://localhost",
        "capacitor://localhost",
        *configured_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(account_router)
app.include_router(ai_router)
app.include_router(tasks_router)
app.include_router(goals_router)
app.include_router(habits_router)
app.include_router(finance_router)
app.include_router(bank_accounts_router)
app.include_router(learning_router)
app.include_router(journal_router)
app.include_router(notifications_router)


@app.get("/")
def root():
    if FRONTEND_INDEX.is_file():
        return FileResponse(FRONTEND_INDEX)
    return {
        "application": "Discipline",
        "message": "Discipline API is running.",
        "version": "0.3.0",
    }


@app.get("/api/health")
def health(request: Request):
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="The database is temporarily unavailable.")
    return {
        "status": "ok",
        "service": "discipline-api",
    }


@app.get("/{path:path}", include_in_schema=False)
def frontend_routes(path: str):
    """Serve built frontend files and support React Router deep links."""
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    if not FRONTEND_INDEX.is_file():
        raise HTTPException(status_code=404, detail="Not Found")

    frontend_root = FRONTEND_DIST.resolve()
    requested_file = (frontend_root / path).resolve()
    try:
        requested_file.relative_to(frontend_root)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Not Found") from exc

    if requested_file.is_file():
        return FileResponse(requested_file)
    if Path(path).suffix:
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(FRONTEND_INDEX)
