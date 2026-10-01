from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from doma.config import get_settings
from doma.db.models import Household, Invitation, Membership, User
from doma.services.analytics import record_event
from doma.services.timeutil import generate_opaque_token, hash_token, utc_now


class InvitationError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass
class InvitationPreview:
    invitation: Invitation
    household_name: str
    inviter_name: str


@dataclass
class CreatedInvitation:
    invitation: Invitation
    raw_token: str


async def create_invitation(
    session: AsyncSession,
    *,
    household: Household,
    created_by: User,
) -> CreatedInvitation:
    # Максимум 2 участника
    members = await session.execute(
        select(Membership).where(Membership.household_id == household.id)
    )
    if len(members.scalars().all()) >= 2:
        raise InvitationError("household_full")

    # Отозвать активные приглашения
    active = await session.execute(
        select(Invitation).where(
            Invitation.household_id == household.id,
            Invitation.redeemed_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    )
    now = utc_now()
    for inv in active.scalars().all():
        inv.revoked_at = now

    settings = get_settings()
    raw = generate_opaque_token()
    invitation = Invitation(
        household_id=household.id,
        created_by_user_id=created_by.id,
        token_hash=hash_token(raw),
        expires_at=now + timedelta(hours=settings.invitation_ttl_hours),
    )
    session.add(invitation)
    await record_event(
        session, "invite_created", household_id=household.id, user_id=created_by.id
    )
    await session.flush()
    return CreatedInvitation(invitation=invitation, raw_token=raw)


async def revoke_invitation(
    session: AsyncSession,
    *,
    household_id: int,
    actor_user_id: int,
) -> int:
    result = await session.execute(
        select(Invitation).where(
            Invitation.household_id == household_id,
            Invitation.redeemed_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    )
    now = utc_now()
    count = 0
    for inv in result.scalars().all():
        inv.revoked_at = now
        count += 1
    _ = actor_user_id  # доступ проверяется снаружи
    await session.flush()
    return count


async def preview_invitation(
    session: AsyncSession,
    raw_token: str,
) -> InvitationPreview:
    token_hash = hash_token(raw_token)
    result = await session.execute(
        select(Invitation).where(Invitation.token_hash == token_hash)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise InvitationError("not_found")
    if invitation.revoked_at is not None:
        raise InvitationError("revoked")
    if invitation.redeemed_at is not None:
        raise InvitationError("already_used")
    if invitation.expires_at <= utc_now():
        raise InvitationError("expired")

    hh = await session.get(Household, invitation.household_id)
    inviter = await session.get(User, invitation.created_by_user_id)
    if hh is None or inviter is None:
        raise InvitationError("not_found")
    return InvitationPreview(
        invitation=invitation,
        household_name=hh.name,
        inviter_name=inviter.display_name,
    )


async def accept_invitation(
    session: AsyncSession,
    *,
    raw_token: str,
    user: User,
) -> Membership:
    preview = await preview_invitation(session, raw_token)
    invitation = preview.invitation

    existing = await session.execute(select(Membership).where(Membership.user_id == user.id))
    if existing.scalar_one_or_none() is not None:
        raise InvitationError("already_in_household")

    members = await session.execute(
        select(Membership)
        .where(Membership.household_id == invitation.household_id)
        .with_for_update()
    )
    if len(members.scalars().all()) >= 2:
        raise InvitationError("household_full")

    # Блокируем приглашение
    locked = await session.execute(
        select(Invitation)
        .where(Invitation.id == invitation.id)
        .with_for_update()
    )
    invitation = locked.scalar_one()
    if invitation.redeemed_at is not None or invitation.revoked_at is not None:
        raise InvitationError("already_used")
    if invitation.expires_at <= utc_now():
        raise InvitationError("expired")

    now = utc_now()
    membership = Membership(
        household_id=invitation.household_id,
        user_id=user.id,
        joined_at=now,
    )
    session.add(membership)
    invitation.redeemed_at = now
    invitation.redeemed_by_user_id = user.id

    await record_event(
        session,
        "member_joined",
        household_id=invitation.household_id,
        user_id=user.id,
    )
    await session.flush()

    # Перезагрузить с relations
    result = await session.execute(
        select(Membership)
        .where(Membership.id == membership.id)
        .options(selectinload(Membership.household), selectinload(Membership.user))
    )
    return result.scalar_one()
