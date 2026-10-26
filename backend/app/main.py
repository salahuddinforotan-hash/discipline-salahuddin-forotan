from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.database import Base, engine
from app.goals.routes import router as goals_router
from app.habits.routes import router as habits_router
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.task import Task
from app.tasks.routes import router as tasks_router


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Discipline API",
    description="Backend API for the Discipline personal productivity system.",
    version="0.3.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(goals_router)
app.include_router(habits_router)


@app.get("/")
def root():
    return {
        "application": "Discipline",
        "message": "Discipline API is running.",
        "version": "0.3.0",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "discipline-api",
    }
