from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from doma.ai.provider import (
    ChoreSuggestionProvider,
    SuggestionRequest,
    SuggestionResponse,
)
from doma.config import Settings
from doma.db.models import AiUsage
from doma.services.analytics import record_event
from doma.services.timeutil import local_today


class AiError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


async def _increment_usage(
    session: AsyncSession,
    household_id: int,
    local_date: date,
    limit: int,
) -> None:
    stmt = insert(AiUsage).values(
        household_id=household_id,
        local_date=local_date,
        request_count=1,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["household_id", "local_date"],
        set_={"request_count": AiUsage.request_count + 1},
    ).returning(AiUsage.request_count)
    result = await session.execute(stmt)
    count = result.scalar_one()
    if count > limit:
        raise AiError("daily_limit")


async def suggest_chores(
    session: AsyncSession,
    *,
    settings: Settings,
    provider: ChoreSuggestionProvider | None,
    household_id: int,
    user_id: int,
    timezone: str,
    description: str,
) -> SuggestionResponse:
    if provider is None:
        raise AiError("disabled")

    description = description.strip()
    if not description:
        raise AiError("empty_description")
    if len(description) > 1000:
        raise AiError("too_long")

    today = local_today(timezone)
    await _increment_usage(
        session,
        household_id,
        today,
        settings.ai_max_requests_per_household_per_day,
    )
    # Проверка после инкремента: если превысили — откат счётчика не делаем в MVP
    # (лимит фиксирует попытку). Перечитаем:
    usage = await session.execute(
        select(AiUsage).where(
            AiUsage.household_id == household_id, AiUsage.local_date == today
        )
    )
    row = usage.scalar_one()
    if row.request_count > settings.ai_max_requests_per_household_per_day:
        raise AiError("daily_limit")

    # Счётчик уже в сессии; сетевой вызов — без удержания длинной транзакции.
    # Вызывающий код (хендлер) коммитит usage до/после; провайдер не пишет в БД.
    try:
        response = await provider.suggest(SuggestionRequest(description=description))
    except Exception as exc:
        raise AiError("provider_failed") from exc

    return response


async def record_ai_accepted(
    session: AsyncSession,
    *,
    household_id: int,
    user_id: int,
) -> None:
    await record_event(
        session, "ai_suggestion_accepted", household_id=household_id, user_id=user_id
    )
