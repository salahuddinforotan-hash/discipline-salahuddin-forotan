from collections import defaultdict
from datetime import date, datetime
from typing import TypeVar

from fastapi import HTTPException

from app.finance.calendar import gregorian_to_solar_hijri, solar_hijri_month_name


T = TypeVar("T")


def solar_month_key(value: date | datetime) -> tuple[int, int]:
    calendar_date = value.date() if isinstance(value, datetime) else value
    year, month, _ = gregorian_to_solar_hijri(calendar_date)
    return year, month


def checked_month(year: int, month: int) -> tuple[int, int]:
    if year < 1 or not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="Invalid Solar Hijri month.")
    return year, month


def month_fields(year: int, month: int) -> dict[str, int | str]:
    return {
        "solar_year": year,
        "solar_month": month,
        "month_name": solar_hijri_month_name(month),
    }


def group_by_month(items: list[T], date_for_item) -> dict[tuple[int, int], list[T]]:
    grouped: dict[tuple[int, int], list[T]] = defaultdict(list)
    for item in items:
        grouped[solar_month_key(date_for_item(item))].append(item)
    return grouped


