from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from doma.config import get_settings
from doma.db.models import (
    ChoreStatus,
    ChoreTemplate,
    Event,
    Household,
    Membership,
    OccurrenceStatus,
    TaskOccurrence,
    User,
)
from doma.services.timeutil import utc_now


async def build_report(session: AsyncSession, household_id: int) -> str:
    hh = await session.get(Household, household_id)
    if hh is None:
        return f"Дом {household_id} не найден."

    members = (
        await session.execute(select(Membership).where(Membership.household_id == household_id))
    ).scalars().all()

    active_chores = (
        await session.execute(
            select(ChoreTemplate).where(
                ChoreTemplate.household_id == household_id,
                ChoreTemplate.status == ChoreStatus.active,
            )
        )
    ).scalars().all()

    from datetime import timedelta

    since = utc_now() - timedelta(days=7)

    lines = [
        f"Отчёт по дому id={household_id} «{hh.name}»",
        f"Участников: {len(members)}",
        f"Активных дел: {len(active_chores)}",
        "",
        "Выполнения за 7 дней:",
    ]

    days_with_completions: set = set()
    for m in members:
        user = await session.get(User, m.user_id)
        name = user.display_name if user else f"user:{m.user_id}"
        completed = (
            await session.execute(
                select(TaskOccurrence)
                .join(ChoreTemplate)
                .where(
                    ChoreTemplate.household_id == household_id,
                    TaskOccurrence.status == OccurrenceStatus.completed,
                    TaskOccurrence.completed_by_user_id == m.user_id,
                    TaskOccurrence.completed_at >= since,
                )
            )
        ).scalars().all()
        for c in completed:
            if c.completed_at:
                days_with_completions.add(c.completed_at.date())
        lines.append(f"  {name}: {len(completed)}")

    lines.append(f"Дней с выполнениями: {len(days_with_completions)}")

    failed = (
        await session.execute(
            select(Event).where(
                Event.household_id == household_id,
                Event.event_name == "reminder_failed",
                Event.created_at >= since,
            )
        )
    ).scalars().all()
    lines.append(f"Ошибки доставки (7д): {len(failed)}")
    return "\n".join(lines)


def main() -> None:
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="CLI-отчёт по дому (без текстов сообщений)")
    parser.add_argument("household_id", type=int)
    args = parser.parse_args()

    settings = get_settings()

    async def _run() -> None:
        engine = create_async_engine(settings.database_url)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            text = await build_report(session, args.household_id)
            print(text)
        await engine.dispose()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
