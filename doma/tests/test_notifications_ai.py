from datetime import time, timedelta

import pytest

from doma.db.models import NotificationStatus
from doma.services import household as household_service
from doma.services.access import get_or_create_user
from doma.services.membership import (
    ensure_daily_notification,
    leave_household,
    skip_stale_notifications,
)
from doma.services.timeutil import local_today, utc_now


@pytest.mark.asyncio
async def test_notification_unique_and_stale_skip(session):
    user = await get_or_create_user(session, 2001, "Настя")
    hh = await household_service.create_household(
        session,
        user=user,
        name="Дом",
        timezone="Europe/Astrakhan",
        notification_time=time(9, 0),
    )
    today = local_today("Europe/Astrakhan")
    n1 = await ensure_daily_notification(
        session, user=user, household=hh.household, for_local_date=today
    )
    n2 = await ensure_daily_notification(
        session, user=user, household=hh.household, for_local_date=today
    )
    assert n1 is not None
    assert n2 is not None
    assert n1.id == n2.id

    # Сделаем запись «устаревшей»
    n1.scheduled_for = utc_now() - timedelta(hours=5)
    await session.flush()
    skipped = await skip_stale_notifications(session)
    assert skipped >= 1
    await session.refresh(n1)
    assert n1.status == NotificationStatus.skipped


@pytest.mark.asyncio
async def test_leave_household_closes_access(session):
    user = await get_or_create_user(session, 2002, "Оля")
    await household_service.create_household(
        session, user=user, name="Дом", timezone="Europe/Moscow"
    )
    await leave_household(session, user=user)
    from doma.services.access import get_member_context

    assert await get_member_context(session, user.id) is None


@pytest.mark.asyncio
async def test_ai_disabled_and_fake(session):
    from doma.ai import FakeChoreSuggestionProvider, build_provider
    from doma.ai import service as ai_service
    from doma.config import Settings
    from doma.services import household as household_service

    user = await get_or_create_user(session, 2003, "Петя")
    hh = await household_service.create_household(
        session, user=user, name="Дом", timezone="UTC"
    )
    settings = Settings(AI_ENABLED=False)
    with pytest.raises(ai_service.AiError) as exc:
        await ai_service.suggest_chores(
            session,
            settings=settings,
            provider=None,
            household_id=hh.household.id,
            user_id=user.id,
            timezone="UTC",
            description="две комнаты кот",
        )
    assert exc.value.code == "disabled"

    fake = FakeChoreSuggestionProvider()
    settings2 = Settings(
        AI_ENABLED=True,
        AI_PROVIDER="fake",
        AI_MAX_REQUESTS_PER_HOUSEHOLD_PER_DAY=3,
    )
    resp = await ai_service.suggest_chores(
        session,
        settings=settings2,
        provider=fake,
        household_id=hh.household.id,
        user_id=user.id,
        timezone="UTC",
        description="две комнаты кот",
    )
    assert 5 <= len(resp.chores) <= 10
    assert (
        build_provider(
            enabled=False,
            provider="fake",
            api_key="",
            base_url="",
            model="",
            timeout_seconds=1,
        )
        is None
    )
