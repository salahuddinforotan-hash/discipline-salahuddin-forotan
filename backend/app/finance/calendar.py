from datetime import date


AFGHAN_SOLAR_MONTHS = (
    "حمل",
    "ثور",
    "جوزا",
    "سرطان",
    "اسد",
    "سنبله",
    "میزان",
    "عقرب",
    "قوس",
    "جدی",
    "دلو",
    "حوت",
)

_BREAK_YEARS = (
    -61,
    9,
    38,
    199,
    426,
    686,
    756,
    818,
    1111,
    1181,
    1210,
    1635,
    2060,
    2097,
    2192,
    2262,
    2324,
    2394,
    2456,
    3178,
)


def _trunc_div(value: int, divisor: int) -> int:
    """Integer division truncated toward zero, matching the calendar algorithm."""
    return abs(value) // divisor if value >= 0 else -(abs(value) // divisor)


def _remainder(value: int, divisor: int) -> int:
    return value - _trunc_div(value, divisor) * divisor


def _gregorian_to_jdn(year: int, month: int, day: int) -> int:
    a = (14 - month) // 12
    adjusted_year = year + 4800 - a
    adjusted_month = month + 12 * a - 3
    return (
        day
        + (153 * adjusted_month + 2) // 5
        + 365 * adjusted_year
        + adjusted_year // 4
        - adjusted_year // 100
        + adjusted_year // 400
        - 32045
    )


def _jdn_to_gregorian(jdn: int) -> tuple[int, int, int]:
    a = jdn + 32044
    b = (4 * a + 3) // 146097
    c = a - (146097 * b) // 4
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    day = e - (153 * m + 2) // 5 + 1
    month = m + 3 - 12 * (m // 10)
    year = 100 * b + d - 4800 + m // 10
    return year, month, day


def _jalali_year_info(year: int) -> tuple[int, int]:
    """Return (leap indicator, Gregorian March day) for a Solar Hijri year."""
    if year < _BREAK_YEARS[0] or year >= _BREAK_YEARS[-1]:
        raise ValueError(f"Solar Hijri year is outside the supported range: {year}")

    gregorian_year = year + 621
    leap_jalali = -14
    previous_break = _BREAK_YEARS[0]
    jump = 0

    for next_break in _BREAK_YEARS[1:]:
        jump = next_break - previous_break
        if year < next_break:
            break
        leap_jalali += (jump // 33) * 8 + _remainder(jump, 33) // 4
        previous_break = next_break

    years_since_break = year - previous_break
    leap_jalali += (years_since_break // 33) * 8 + (
        _remainder(years_since_break, 33) + 3
    ) // 4
    if _remainder(jump, 33) == 4 and jump - years_since_break == 4:
        leap_jalali += 1

    leap_gregorian = (
        gregorian_year // 4
        - (((gregorian_year // 100) + 1) * 3) // 4
        - 150
    )
    march_day = 20 + leap_jalali - leap_gregorian

    if jump - years_since_break < 6:
        years_since_break = (
            years_since_break - jump + ((jump + 4) // 33) * 33
        )
    leap = _remainder(_remainder(years_since_break + 1, 33) - 1, 4)
    if leap == -1:
        leap = 4
    return leap, march_day


def gregorian_to_solar_hijri(value: date) -> tuple[int, int, int]:
    """Convert a Gregorian date to Afghan Solar Hijri (year, month, day)."""
    jalali_year = value.year - 621
    leap, march_day = _jalali_year_info(jalali_year)
    first_day_jdn = _gregorian_to_jdn(value.year, 3, march_day)
    offset = _gregorian_to_jdn(value.year, value.month, value.day) - first_day_jdn

    if offset >= 0:
        if offset <= 185:
            month = 1 + offset // 31
            day = offset % 31 + 1
            return jalali_year, month, day
        offset -= 186
    else:
        jalali_year -= 1
        offset += 179
        if leap == 1:
            offset += 1

    month = 7 + offset // 30
    day = offset % 30 + 1
    return jalali_year, month, day


def solar_hijri_to_gregorian(year: int, month: int, day: int = 1) -> date:
    """Convert an Afghan Solar Hijri date to a Gregorian date."""
    if not 1 <= month <= 12:
        raise ValueError("Solar Hijri month must be from 1 to 12.")
    leap, march_day = _jalali_year_info(year)
    month_length = 31 if month <= 6 else 30
    if month == 12 and leap != 1:
        month_length = 29
    if not 1 <= day <= month_length:
        raise ValueError("Solar Hijri day is outside the selected month.")

    if month <= 6:
        offset = (month - 1) * 31 + day - 1
    else:
        offset = 186 + (month - 7) * 30 + day - 1
    year_start = _gregorian_to_jdn(year + 621, 3, march_day)
    gregorian_year, gregorian_month, gregorian_day = _jdn_to_gregorian(year_start + offset)
    return date(gregorian_year, gregorian_month, gregorian_day)


def solar_hijri_month_range(year: int, month: int) -> tuple[date, date]:
    """Return inclusive Solar Hijri month start and exclusive next-month start."""
    if not 1 <= month <= 12:
        raise ValueError("Solar Hijri month must be from 1 to 12.")
    start = solar_hijri_to_gregorian(year, month, 1)
    if month == 12:
        end = solar_hijri_to_gregorian(year + 1, 1, 1)
    else:
        end = solar_hijri_to_gregorian(year, month + 1, 1)
    return start, end


def solar_hijri_month_name(month: int) -> str:
    if not 1 <= month <= 12:
        raise ValueError(f"Invalid Solar Hijri month: {month}")
    return AFGHAN_SOLAR_MONTHS[month - 1]
