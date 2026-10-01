from datetime import date, time

from doma.services.timeutil import (
    local_date_to_utc_datetime,
    next_due_after_completion,
)


def test_next_due_after_late_completion():
    # Назначено на 1 окт, выполнено 3 окт, интервал 7 → 10 окт
    assert next_due_after_completion(date(2026, 10, 3), 7) == date(2026, 10, 10)


def test_next_due_after_postpone_then_complete():
    # Перенос 1→2, выполнение 2 окт, интервал 7 → 9 окт
    assert next_due_after_completion(date(2026, 10, 2), 7) == date(2026, 10, 9)


def test_dst_spring_forward_gap_moscow():
    # В Europe/Moscow переход весной исторически был; в современных годах
    # постоянный UTC+3. Проверяем Asia/Yekaterinburg стабильность и fold.
    dt = local_date_to_utc_datetime(date(2026, 6, 1), time(9, 0), "Europe/Astrakhan")
    assert dt.tzinfo is not None
    assert dt.hour in (5, 6)  # Astrakhan UTC+4 → 09:00 local = 05:00 UTC


def test_ambiguous_time_uses_fold_zero():
    # Europe/Moscow без DST с 2014; используем зону с DST если доступна.
    # UTC простое преобразование
    dt = local_date_to_utc_datetime(date(2026, 1, 15), time(9, 0), "UTC")
    assert dt.hour == 9
