from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from doma.db.models import ChoreTemplate, Household, Membership, TaskOccurrence, User


class AccessError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass
class MemberContext:
    user: User
    household: Household
    membership: Membership


async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    display_name: str,
) -> User:
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=telegram_id, display_name=display_name[:255] or "Участник")
        session.add(user)
        await session.flush()
    else:
        if display_name and user.display_name != display_name[:255]:
            user.display_name = display_name[:255]
        if user.bot_blocked:
            user.bot_blocked = False
    return user


async def get_member_context(
    session: AsyncSession,
    user_id: int,
) -> MemberContext | None:
    result = await session.execute(
        select(Membership)
        .where(Membership.user_id == user_id)
        .options(
            selectinload(Membership.household),
            selectinload(Membership.user),
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        return None
    return MemberContext(
        user=membership.user,
        household=membership.household,
        membership=membership,
    )


async def require_member(session: AsyncSession, user_id: int) -> MemberContext:
    ctx = await get_member_context(session, user_id)
    if ctx is None:
        raise AccessError("not_a_member")
    return ctx


async def require_household_member(
    session: AsyncSession,
    user_id: int,
    household_id: int,
) -> MemberContext:
    ctx = await require_member(session, user_id)
    if ctx.household.id != household_id:
        raise AccessError("wrong_household")
    return ctx


async def require_chore_access(
    session: AsyncSession,
    user_id: int,
    chore_id: int,
) -> tuple[MemberContext, ChoreTemplate]:
    result = await session.execute(select(ChoreTemplate).where(ChoreTemplate.id == chore_id))
    chore = result.scalar_one_or_none()
    if chore is None:
        raise AccessError("chore_not_found")
    ctx = await require_household_member(session, user_id, chore.household_id)
    return ctx, chore


async def require_occurrence_access(
    session: AsyncSession,
    user_id: int,
    occurrence_id: int,
) -> tuple[MemberContext, TaskOccurrence, ChoreTemplate]:
    result = await session.execute(
        select(TaskOccurrence)
        .where(TaskOccurrence.id == occurrence_id)
        .options(selectinload(TaskOccurrence.template))
    )
    occ = result.scalar_one_or_none()
    if occ is None:
        raise AccessError("occurrence_not_found")
    ctx = await require_household_member(session, user_id, occ.template.household_id)
    return ctx, occ, occ.template


async def get_partner(session: AsyncSession, ctx: MemberContext) -> User | None:
    result = await session.execute(
        select(Membership)
        .where(
            Membership.household_id == ctx.household.id,
            Membership.user_id != ctx.user.id,
        )
        .options(selectinload(Membership.user))
    )
    other = result.scalar_one_or_none()
    return other.user if other else None


async def count_members(session: AsyncSession, household_id: int) -> int:
    result = await session.execute(
        select(Membership).where(Membership.household_id == household_id)
    )
    return len(result.scalars().all())
