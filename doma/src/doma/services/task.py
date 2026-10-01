from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
from doma.services.timeutil import local_today, next_due_after_completion, utc_now


class TaskError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass
class CompleteResult:
    completed: TaskOccurrence
    next_occurrence: TaskOccurrence


async def complete_occurrence(
    session: AsyncSession,
    *,
    occurrence_id: int,
    actor: User,
    household_timezone: str,
    completed_local_date: date | None = None,
) -> CompleteResult:
    """Закрыть выполнение и создать следующий цикл в одной транзакции.

    Защита от двойного клика: SELECT FOR UPDATE + уникальный индекс на открытое выполнение.
    """
    result = await session.execute(
        select(TaskOccurrence)
        .where(TaskOccurrence.id == occurrence_id)
        .options(selectinload(TaskOccurrence.template))
        .with_for_update()
    )
    occ = result.scalar_one_or_none()
    if occ is None:
        raise TaskError("not_found")
    if occ.status != OccurrenceStatus.open:
        raise TaskError("already_closed")

    template = occ.template
    if template.status != ChoreStatus.active:
        raise TaskError("chore_inactive")

    done_date = completed_local_date or local_today(household_timezone)
    now = utc_now()

    occ.status = OccurrenceStatus.completed
    occ.completed_by_user_id = actor.id
    occ.completed_at = now

    # Закрыть открытые предложения передачи
    offers = await session.execute(
        select(AssignmentOffer).where(
            AssignmentOffer.occurrence_id == occ.id,
            AssignmentOffer.status == OfferStatus.pending,
        )
    )
    for o in offers.scalars().all():
        o.status = OfferStatus.cancelled

    next_due = next_due_after_completion(done_date, template.interval_days)
    next_occ = TaskOccurrence(
        template_id=template.id,
        due_date=next_due,
        assignee_user_id=template.assignee_user_id,
        status=OccurrenceStatus.open,
    )
    session.add(next_occ)

    try:
        await session.flush()
    except IntegrityError as exc:
        raise TaskError("concurrent_complete") from exc

    await record_event(
        session,
        "task_completed",
        household_id=template.household_id,
        user_id=actor.id,
    )
    await session.flush()
    return CompleteResult(completed=occ, next_occurrence=next_occ)


async def postpone_occurrence(
    session: AsyncSession,
    *,
    occurrence_id: int,
    actor: User,
    new_due_date: date,
    household_timezone: str,
) -> TaskOccurrence:
    result = await session.execute(
        select(TaskOccurrence)
        .where(TaskOccurrence.id == occurrence_id)
        .options(selectinload(TaskOccurrence.template))
        .with_for_update()
    )
    occ = result.scalar_one_or_none()
    if occ is None:
        raise TaskError("not_found")
    if occ.status != OccurrenceStatus.open:
        raise TaskError("already_closed")
    if occ.assignee_user_id != actor.id:
        raise TaskError("not_assignee")

    today = local_today(household_timezone)
    if new_due_date < today:
        raise TaskError("date_in_past")

    occ.due_date = new_due_date
    await record_event(
        session,
        "task_postponed",
        household_id=occ.template.household_id,
        user_id=actor.id,
    )
    await session.flush()
    return occ


async def propose_transfer(
    session: AsyncSession,
    *,
    occurrence_id: int,
    actor: User,
    recipient: User,
) -> AssignmentOffer:
    settings = get_settings()
    result = await session.execute(
        select(TaskOccurrence)
        .where(TaskOccurrence.id == occurrence_id)
        .options(selectinload(TaskOccurrence.template))
        .with_for_update()
    )
    occ = result.scalar_one_or_none()
    if occ is None:
        raise TaskError("not_found")
    if occ.status != OccurrenceStatus.open:
        raise TaskError("already_closed")
    if occ.assignee_user_id != actor.id:
        raise TaskError("not_assignee")
    if recipient.id == actor.id:
        raise TaskError("cannot_transfer_to_self")

    # Одно открытое предложение
    existing = await session.execute(
        select(AssignmentOffer).where(
            AssignmentOffer.occurrence_id == occ.id,
            AssignmentOffer.status == OfferStatus.pending,
            AssignmentOffer.offer_type == OfferType.task_transfer,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise TaskError("offer_exists")

    offer = AssignmentOffer(
        offer_type=OfferType.task_transfer,
        template_id=occ.template_id,
        occurrence_id=occ.id,
        initiator_user_id=actor.id,
        recipient_user_id=recipient.id,
        expires_at=utc_now() + timedelta(hours=settings.transfer_offer_ttl_hours),
        status=OfferStatus.pending,
    )
    session.add(offer)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise TaskError("offer_exists") from exc
    return offer


async def accept_transfer(
    session: AsyncSession,
    *,
    offer_id: int,
    user: User,
) -> TaskOccurrence:
    result = await session.execute(
        select(AssignmentOffer)
        .where(AssignmentOffer.id == offer_id)
        .with_for_update()
    )
    offer = result.scalar_one_or_none()
    if offer is None or offer.offer_type != OfferType.task_transfer:
        raise TaskError("offer_not_found")
    if offer.recipient_user_id != user.id:
        raise TaskError("not_recipient")
    if offer.status != OfferStatus.pending:
        raise TaskError("offer_closed")
    if offer.expires_at <= utc_now():
        offer.status = OfferStatus.expired
        await session.flush()
        raise TaskError("offer_expired")

    occ_result = await session.execute(
        select(TaskOccurrence)
        .where(TaskOccurrence.id == offer.occurrence_id)
        .options(selectinload(TaskOccurrence.template))
        .with_for_update()
    )
    occ = occ_result.scalar_one_or_none()
    if occ is None or occ.status != OccurrenceStatus.open:
        offer.status = OfferStatus.cancelled
        await session.flush()
        raise TaskError("occurrence_closed")

    # Передача только текущего выполнения; постоянный исполнитель шаблона не меняется
    occ.assignee_user_id = user.id
    offer.status = OfferStatus.accepted

    await record_event(
        session,
        "transfer_accepted",
        household_id=occ.template.household_id,
        user_id=user.id,
    )
    await session.flush()
    return occ


async def decline_transfer(
    session: AsyncSession,
    *,
    offer_id: int,
    user: User,
) -> None:
    result = await session.execute(
        select(AssignmentOffer)
        .where(AssignmentOffer.id == offer_id)
        .with_for_update()
    )
    offer = result.scalar_one_or_none()
    if offer is None or offer.offer_type != OfferType.task_transfer:
        raise TaskError("offer_not_found")
    if offer.recipient_user_id != user.id:
        raise TaskError("not_recipient")
    if offer.status != OfferStatus.pending:
        raise TaskError("offer_closed")
    offer.status = OfferStatus.declined
    await session.flush()


async def list_my_occurrences(
    session: AsyncSession,
    *,
    user_id: int,
    household_id: int,
    today: date,
    include_future: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[TaskOccurrence]:
    q = (
        select(TaskOccurrence)
        .join(ChoreTemplate, TaskOccurrence.template_id == ChoreTemplate.id)
        .where(
            ChoreTemplate.household_id == household_id,
            ChoreTemplate.status == ChoreStatus.active,
            TaskOccurrence.status == OccurrenceStatus.open,
            TaskOccurrence.assignee_user_id == user_id,
        )
        .options(selectinload(TaskOccurrence.template))
    )
    if include_future:
        q = q.where(TaskOccurrence.due_date > today).order_by(TaskOccurrence.due_date)
    else:
        # Просроченные и сегодняшние
        q = q.where(TaskOccurrence.due_date <= today).order_by(TaskOccurrence.due_date)
    q = q.limit(limit).offset(offset)
    result = await session.execute(q)
    return list(result.scalars().all())


async def list_household_occurrences(
    session: AsyncSession,
    *,
    household_id: int,
    today: date,
    limit: int = 20,
    offset: int = 0,
) -> list[TaskOccurrence]:
    q = (
        select(TaskOccurrence)
        .join(ChoreTemplate, TaskOccurrence.template_id == ChoreTemplate.id)
        .where(
            ChoreTemplate.household_id == household_id,
            ChoreTemplate.status == ChoreStatus.active,
            TaskOccurrence.status == OccurrenceStatus.open,
            TaskOccurrence.due_date <= today,
        )
        .options(selectinload(TaskOccurrence.template))
        .order_by(TaskOccurrence.due_date)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def list_history(
    session: AsyncSession,
    *,
    household_id: int,
    since: date,
    limit: int = 50,
) -> list[TaskOccurrence]:
    q = (
        select(TaskOccurrence)
        .join(ChoreTemplate, TaskOccurrence.template_id == ChoreTemplate.id)
        .where(
            ChoreTemplate.household_id == household_id,
            TaskOccurrence.status == OccurrenceStatus.completed,
            TaskOccurrence.completed_at.is_not(None),
        )
        .options(selectinload(TaskOccurrence.template))
        .order_by(TaskOccurrence.completed_at.desc())
        .limit(limit)
    )
    result = await session.execute(q)
    items = list(result.scalars().all())
    # Фильтр по локальной дате приблизительно через completed_at.date — уточняется в UI
    # с timezone; здесь отсекаем грубо по UTC-дате минус запас
    filtered = []
    for item in items:
        if item.completed_at and item.completed_at.date() >= since - timedelta(days=1):
            filtered.append(item)
    return filtered
