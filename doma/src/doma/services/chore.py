from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from doma.config import get_settings
from doma.db.models import (
    AssignmentOffer,
    ChoreStatus,
    ChoreTemplate,
    OccurrenceStatus,
    OfferStatus,
    OfferType,
    TaskOccurrence,
    User,
)
from doma.services.analytics import record_event
from doma.services.timeutil import utc_now


class ChoreError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass
class CreateChoreResult:
    template: ChoreTemplate
    occurrence: TaskOccurrence | None
    offer: AssignmentOffer | None
    needs_acceptance: bool


def _validate_chore_fields(
    title: str,
    interval_days: int,
    duration_minutes: int,
    room: str | None,
) -> tuple[str, int, int, str | None]:
    title = title.strip()
    if not title or len(title) > 100:
        raise ChoreError("invalid_title")
    if interval_days < 1 or interval_days > 365:
        raise ChoreError("invalid_interval")
    if duration_minutes < 1 or duration_minutes > 180:
        raise ChoreError("invalid_duration")
    if room is not None:
        room = room.strip() or None
        if room and len(room) > 50:
            raise ChoreError("invalid_room")
    return title, interval_days, duration_minutes, room


async def count_active_chores(session: AsyncSession, household_id: int) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(ChoreTemplate)
        .where(
            ChoreTemplate.household_id == household_id,
            ChoreTemplate.status.in_([ChoreStatus.active, ChoreStatus.pending_acceptance]),
        )
    )
    return int(result.scalar_one())


async def create_chore(
    session: AsyncSession,
    *,
    household_id: int,
    created_by: User,
    title: str,
    interval_days: int,
    duration_minutes: int,
    first_due_date: date,
    assignee: User | None,
    room: str | None = None,
) -> CreateChoreResult:
    settings = get_settings()
    title, interval_days, duration_minutes, room = _validate_chore_fields(
        title, interval_days, duration_minutes, room
    )

    if await count_active_chores(session, household_id) >= settings.max_active_chores_per_household:
        raise ChoreError("limit_reached")

    needs_acceptance = (
        assignee is not None and assignee.id != created_by.id
    )
    status = ChoreStatus.pending_acceptance if needs_acceptance else ChoreStatus.active

    template = ChoreTemplate(
        household_id=household_id,
        title=title,
        interval_days=interval_days,
        assignee_user_id=assignee.id if assignee and not needs_acceptance else (
            None if needs_acceptance else (assignee.id if assignee else created_by.id)
        ),
        duration_minutes=duration_minutes,
        room=room,
        status=status,
        created_by_user_id=created_by.id,
        first_due_date=first_due_date,
    )
    # Для pending — храним предполагаемого исполнителя через offer, не в assignee
    if needs_acceptance:
        template.assignee_user_id = None

    session.add(template)
    await session.flush()

    occurrence = None
    offer = None

    if not needs_acceptance:
        assignee_id = template.assignee_user_id
        occurrence = TaskOccurrence(
            template_id=template.id,
            due_date=first_due_date,
            assignee_user_id=assignee_id,
            status=OccurrenceStatus.open,
        )
        session.add(occurrence)
        await record_event(
            session, "chore_created", household_id=household_id, user_id=created_by.id
        )
    else:
        assert assignee is not None
        from datetime import timedelta

        offer = AssignmentOffer(
            offer_type=OfferType.chore_assignment,
            template_id=template.id,
            occurrence_id=None,
            initiator_user_id=created_by.id,
            recipient_user_id=assignee.id,
            expires_at=utc_now() + timedelta(hours=settings.transfer_offer_ttl_hours),
            status=OfferStatus.pending,
        )
        session.add(offer)
        await record_event(
            session, "chore_created", household_id=household_id, user_id=created_by.id
        )

    await session.flush()
    return CreateChoreResult(
        template=template,
        occurrence=occurrence,
        offer=offer,
        needs_acceptance=needs_acceptance,
    )


async def accept_chore_assignment(
    session: AsyncSession,
    *,
    offer_id: int,
    user: User,
) -> ChoreTemplate:
    result = await session.execute(
        select(AssignmentOffer)
        .where(AssignmentOffer.id == offer_id)
        .with_for_update()
    )
    offer = result.scalar_one_or_none()
    if offer is None or offer.offer_type != OfferType.chore_assignment:
        raise ChoreError("offer_not_found")
    if offer.recipient_user_id != user.id:
        raise ChoreError("not_recipient")
    if offer.status != OfferStatus.pending:
        raise ChoreError("offer_closed")
    if offer.expires_at <= utc_now():
        offer.status = OfferStatus.expired
        await session.flush()
        raise ChoreError("offer_expired")

    template = await session.get(ChoreTemplate, offer.template_id)
    if template is None or template.status != ChoreStatus.pending_acceptance:
        offer.status = OfferStatus.cancelled
        await session.flush()
        raise ChoreError("chore_unavailable")

    template.status = ChoreStatus.active
    template.assignee_user_id = user.id
    offer.status = OfferStatus.accepted

    occurrence = TaskOccurrence(
        template_id=template.id,
        due_date=template.first_due_date,
        assignee_user_id=user.id,
        status=OccurrenceStatus.open,
    )
    session.add(occurrence)
    await record_event(
        session,
        "assignment_accepted",
        household_id=template.household_id,
        user_id=user.id,
    )
    await session.flush()
    return template


async def decline_chore_assignment(
    session: AsyncSession,
    *,
    offer_id: int,
    user: User,
) -> ChoreTemplate:
    result = await session.execute(
        select(AssignmentOffer)
        .where(AssignmentOffer.id == offer_id)
        .with_for_update()
    )
    offer = result.scalar_one_or_none()
    if offer is None or offer.offer_type != OfferType.chore_assignment:
        raise ChoreError("offer_not_found")
    if offer.recipient_user_id != user.id:
        raise ChoreError("not_recipient")
    if offer.status != OfferStatus.pending:
        raise ChoreError("offer_closed")

    offer.status = OfferStatus.declined
    template = await session.get(ChoreTemplate, offer.template_id)
    if template is None:
        raise ChoreError("chore_unavailable")
    await session.flush()
    return template


async def take_declined_chore(
    session: AsyncSession,
    *,
    template_id: int,
    user: User,
) -> ChoreTemplate:
    """Автор берёт на себя дело после отказа второго."""
    template = await session.get(ChoreTemplate, template_id)
    if template is None:
        raise ChoreError("chore_not_found")
    if template.created_by_user_id != user.id:
        raise ChoreError("not_author")
    if template.status != ChoreStatus.pending_acceptance:
        raise ChoreError("not_pending")

    template.status = ChoreStatus.active
    template.assignee_user_id = user.id
    session.add(
        TaskOccurrence(
            template_id=template.id,
            due_date=template.first_due_date,
            assignee_user_id=user.id,
            status=OccurrenceStatus.open,
        )
    )
    await session.flush()
    return template


async def cancel_pending_chore(
    session: AsyncSession,
    *,
    template_id: int,
    user: User,
) -> None:
    template = await session.get(ChoreTemplate, template_id)
    if template is None:
        raise ChoreError("chore_not_found")
    if template.created_by_user_id != user.id:
        raise ChoreError("not_author")
    if template.status != ChoreStatus.pending_acceptance:
        raise ChoreError("not_pending")

    # Закрыть предложения
    offers = await session.execute(
        select(AssignmentOffer).where(
            AssignmentOffer.template_id == template_id,
            AssignmentOffer.status == OfferStatus.pending,
        )
    )
    for o in offers.scalars().all():
        o.status = OfferStatus.cancelled

    template.status = ChoreStatus.archived
    await session.flush()


async def update_chore(
    session: AsyncSession,
    *,
    template: ChoreTemplate,
    title: str | None = None,
    interval_days: int | None = None,
    duration_minutes: int | None = None,
    room: str | None = ...,  # type: ignore[assignment]
) -> ChoreTemplate:
    if title is not None:
        title, _, _, _ = _validate_chore_fields(
            title, template.interval_days, template.duration_minutes, template.room
        )
        template.title = title
    if interval_days is not None:
        if interval_days < 1 or interval_days > 365:
            raise ChoreError("invalid_interval")
        # Изменение периода действует на следующий цикл; открытый срок не меняем
        template.interval_days = interval_days
    if duration_minutes is not None:
        if duration_minutes < 1 or duration_minutes > 180:
            raise ChoreError("invalid_duration")
        template.duration_minutes = duration_minutes
    if room is not ...:
        if room is not None:
            room = room.strip() or None
            if room and len(room) > 50:
                raise ChoreError("invalid_room")
        template.room = room
    await session.flush()
    return template


async def archive_chore(
    session: AsyncSession,
    *,
    template: ChoreTemplate,
) -> None:
    template.status = ChoreStatus.archived
    # Закрыть открытое выполнение и предложения
    occs = await session.execute(
        select(TaskOccurrence).where(
            TaskOccurrence.template_id == template.id,
            TaskOccurrence.status == OccurrenceStatus.open,
        )
    )
    for occ in occs.scalars().all():
        occ.status = OccurrenceStatus.cancelled
        offers = await session.execute(
            select(AssignmentOffer).where(
                AssignmentOffer.occurrence_id == occ.id,
                AssignmentOffer.status == OfferStatus.pending,
            )
        )
        for o in offers.scalars().all():
            o.status = OfferStatus.cancelled

    pending = await session.execute(
        select(AssignmentOffer).where(
            AssignmentOffer.template_id == template.id,
            AssignmentOffer.status == OfferStatus.pending,
        )
    )
    for o in pending.scalars().all():
        o.status = OfferStatus.cancelled
    await session.flush()


async def list_chores(
    session: AsyncSession,
    household_id: int,
    *,
    include_archived: bool = False,
) -> list[ChoreTemplate]:
    q = select(ChoreTemplate).where(ChoreTemplate.household_id == household_id)
    if not include_archived:
        q = q.where(ChoreTemplate.status != ChoreStatus.archived)
    q = q.order_by(ChoreTemplate.id)
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_open_occurrence(
    session: AsyncSession,
    template_id: int,
) -> TaskOccurrence | None:
    result = await session.execute(
        select(TaskOccurrence)
        .where(
            TaskOccurrence.template_id == template_id,
            TaskOccurrence.status == OccurrenceStatus.open,
        )
        .options(selectinload(TaskOccurrence.template))
    )
    return result.scalar_one_or_none()
