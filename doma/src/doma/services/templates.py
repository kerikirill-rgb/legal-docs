"""Стартовые шаблоны домашних дел (рекомендации, не нормы)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ChoreSeed:
    title: str
    interval_days: int
    duration_minutes: int
    room: str | None = None


STARTER_TEMPLATES: tuple[ChoreSeed, ...] = (
    ChoreSeed("Вынести мусор", 2, 3),
    ChoreSeed("Пропылесосить", 7, 20, "Общее"),
    ChoreSeed("Протереть поверхности", 3, 10),
    ChoreSeed("Помыть раковину", 2, 5, "Кухня"),
    ChoreSeed("Сменить постельное бельё", 14, 15, "Спальня"),
    ChoreSeed("Полить растения", 3, 5),
    ChoreSeed("Помыть полы", 7, 25),
    ChoreSeed("Разобрать посуду", 1, 10, "Кухня"),
)


INTERVAL_PRESETS = (
    ("Ежедневно", 1),
    ("Каждые 3 дня", 3),
    ("Раз в 7 дней", 7),
    ("Раз в 14 дней", 14),
)
