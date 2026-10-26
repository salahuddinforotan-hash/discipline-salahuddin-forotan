from sqlalchemy.engine import Engine

from app.models.notification import Notification


def upgrade_notifications(engine: Engine) -> None:
    """Safely add persistent notifications to an existing database."""
    Notification.__table__.create(bind=engine, checkfirst=True)
