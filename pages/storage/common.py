"""Small helpers shared by the storage modules."""

import datetime
import json

from django.utils import timezone
from django.utils.dateparse import parse_date as django_parse_date
from django.utils.dateparse import parse_datetime


def to_json(value):
    """Compact JSON text, the way the pages keep it in the browser."""
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def from_json(text, fallback):
    """Parse JSON text from the browser; return fallback when empty or broken."""
    if text in (None, ""):
        return fallback
    try:
        value = json.loads(text)
    except ValueError:
        return fallback
    return fallback if value is None else value


def parse_day(text):
    """'2026-10-01' -> date, or None."""
    try:
        return django_parse_date(str(text or "")[:10])
    except ValueError:
        return None


def parse_moment(text):
    """ISO date-time text -> aware datetime, or None."""
    if not text:
        return None
    try:
        moment = parse_datetime(str(text))
    except ValueError:
        return None
    if moment is None:
        day = parse_day(text)
        if day is None:
            return None
        moment = datetime.datetime.combine(day, datetime.time())
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment, datetime.timezone.utc)
    return moment


def iso_moment(moment):
    """aware datetime -> '2026-10-01T09:30:00.000Z' (what JavaScript's toISOString gives)."""
    if moment is None:
        return ""
    utc = moment.astimezone(datetime.timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


def iso_day(day):
    return day.isoformat() if day else ""


def to_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def split_extra(record, mapped_keys):
    """Return the part of a record that has no column of its own."""
    return {key: value for key, value in record.items() if key not in mapped_keys}
