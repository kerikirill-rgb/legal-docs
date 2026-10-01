from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SUPPORTED_TIMEZONES = (
    "Europe/Astrakhan",
    "Europe/Moscow",
    "Europe/Samara",
    "Asia/Yekaterinburg",
    "Asia/Novosibirsk",
    "Asia/Krasnoyarsk",
    "Asia/Irkutsk",
    "Asia/Yakutsk",
    "Asia/Vladivostok",
    "Asia/Magadan",
    "Asia/Kamchatka",
    "Europe/Kaliningrad",
    "UTC",
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def ensure_tz(name: str) -> ZoneInfo:
    if name not in SUPPORTED_TIMEZONES:
        raise ValueError(f"unsupported_timezone:{name}")
    return ZoneInfo(name)


def local_today(tz_name: str, now: datetime | None = None) -> date:
    tz = ensure_tz(tz_name)
    moment = now or utc_now()
    return moment.astimezone(tz).date()


def local_date_to_utc_datetime(local_d: date, local_t: time, tz_name: str) -> datetime:
    """Преобразует локальную дату+время в UTC с учётом DST.

    Неоднозначное время (складка при переходе на зимнее) — берём первое (fold=0).
    Отсутствующее время (прыжок при переходе на летнее) — сдвигаем вперёд
    на первое допустимое время после него.
    """
    tz = ensure_tz(tz_name)
    naive = datetime.combine(local_d, local_t)
    # fold=0 — первая интерпретация в неоднозначном интервале
    aware = naive.replace(tzinfo=tz, fold=0)
    # Если время «пропущено» (gap), Python zoneinfo обычно нормализует;
    # дополнительно подстрахуемся: если обратное преобразование даёт другой wall time,
    # двигаемся по минутам вперёд.
    check = aware.astimezone(tz)
    if check.replace(tzinfo=None) != naive:
        cursor = naive
        for _ in range(180):
            cursor += timedelta(minutes=1)
            candidate = cursor.replace(tzinfo=tz, fold=0)
            back = candidate.astimezone(tz).replace(tzinfo=None)
            if back == cursor:
                aware = candidate
                break
    return aware.astimezone(UTC)


def next_due_after_completion(completed_local_date: date, interval_days: int) -> date:
    """Следующий срок = локальная дата выполнения + N календарных дней."""
    if interval_days < 1 or interval_days > 365:
        raise ValueError("interval_days_out_of_range")
    return completed_local_date + timedelta(days=interval_days)


def hash_token(raw_token: str) -> str:
    import hashlib

    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_opaque_token() -> str:
    import secrets

    return secrets.token_urlsafe(24)
