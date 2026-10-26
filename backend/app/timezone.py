from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.database import settings


def application_timezone() -> ZoneInfo:
    return ZoneInfo(settings.app_timezone)


def application_now() -> datetime:
    return datetime.now(application_timezone())


def application_today() -> date:
    return application_now().date()
