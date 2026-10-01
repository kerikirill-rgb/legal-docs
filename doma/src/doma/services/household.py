from dataclasses import dataclass
from datetime import time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from doma.db.models import Household, Membership, User
from doma.services.analytics import record_event
from doma.services.timeutil import SUPPORTED_TIMEZONES, ensure_tz, utc_now


class HouseholdError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass
class CreateHouseholdResult:
    household: Household
    membership: Membership


async def create_household(
    session: AsyncSession,
    *,
    user: User,
    name: str,
    timezone: str,
    notification_time: time | None = None,
) -> CreateHouseholdResult:
    existing = await session.execute(select(Membership).where(Membership.user_id == user.id))
    if existing.scalar_one_or_none() is not None:
        raise HouseholdError("already_in_household")

    name = name.strip()
    if not name or len(name) > 100:
        raise HouseholdError("invalid_name")

    try:
        ensure_tz(timezone)
    except ValueError as exc:
        raise HouseholdError("invalid_timezone") from exc

    household = Household(
        name=name,
        timezone=timezone,
        owner_user_id=user.id,
    )
    session.add(household)
    await session.flush()

    membership = Membership(
        household_id=household.id,
        user_id=user.id,
        joined_at=utc_now(),
    )
    session.add(membership)

    if notification_time is not None:
        user.notification_time = notification_time
    user.notifications_enabled = True

    await record_event(
        session, "house_created", household_id=household.id, user_id=user.id
    )
    await session.flush()
    return CreateHouseholdResult(household=household, membership=membership)


async def list_supported_timezones() -> list[str]:
    return list(SUPPORTED_TIMEZONES)


async def delete_household(
    session: AsyncSession,
    *,
    household_id: int,
    actor_user_id: int,
) -> None:
    result = await session.execute(select(Household).where(Household.id == household_id))
    household = result.scalar_one_or_none()
    if household is None:
        raise HouseholdError("not_found")
    if household.owner_user_id != actor_user_id:
        raise HouseholdError("not_owner")

    await session.delete(household)
    await session.flush()


async def transfer_ownership(
    session: AsyncSession,
    *,
    household: Household,
    new_owner_id: int,
) -> None:
    household.owner_user_id = new_owner_id
    await session.flush()


async def member_count(session: AsyncSession, household_id: int) -> int:
    result = await session.execute(
        select(func.count()).select_from(Membership).where(
            Membership.household_id == household_id
        )
    )
    return int(result.scalar_one())
