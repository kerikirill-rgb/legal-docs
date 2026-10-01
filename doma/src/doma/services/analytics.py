from datetime import UTC

from sqlalchemy.ext.asyncio import AsyncSession

from doma.db.models import Event


async def record_event(
    session: AsyncSession,
    event_name: str,
    *,
    household_id: int | None = None,
    user_id: int | None = None,
) -> None:
    """Записать аналитическое событие без текстов сообщений и названий дел."""
    from datetime import datetime

    session.add(
        Event(
            event_name=event_name,
            household_id=household_id,
            user_id=user_id,
            created_at=datetime.now(UTC),
        )
    )
