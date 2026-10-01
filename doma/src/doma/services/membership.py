from datetime import date, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from doma.config import get_settings
from doma.db.models import (
    AssignmentOffer,
    ChoreStatus,
    ChoreTemplate,
    Household,
    Membership,
    Notification,
    NotificationStatus,
    NotificationType,
    OccurrenceStatus,
    OfferStatus,
    TaskOccurrence,
    User,
)
from doma.services.analytics import record_event
from doma.services.household import delete_household, transfer_ownership
from doma.services.timeutil import local_date_to_utc_datetime, local_today, utc_now


class MembershipError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


async def leave_household(
    session: AsyncSession,
    *,
    user: User,
) -> None:
    result = await session.execute(
        select(Membership)
        .where(Membership.user_id == user.id)
        .options(selectinload(Membership.household))
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise MembershipError("not_a_member")

    household = membership.household
    others = await session.execute(
        select(Membership).where(
            Membership.household_id == household.id,
            Membership.user_id != user.id,
        )
    )
    partner = others.scalar_one_or_none()

    # Снять назначения с уходящего
    await session.execute(
        update(ChoreTemplate)
        .where(
            ChoreTemplate.household_id == household.id,
            ChoreTemplate.assignee_user_id == user.id,
            ChoreTemplate.status == ChoreStatus.active,
        )
        .values(assignee_user_id=None)
    )
    await session.execute(
        update(TaskOccurrence)
        .where(
            TaskOccurrence.assignee_user_id == user.id,
            TaskOccurrence.status == OccurrenceStatus.open,
            TaskOccurrence.template_id.in_(
                select(ChoreTemplate.id).where(ChoreTemplate.household_id == household.id)
            ),
        )
        .values(assignee_user_id=None)
    )

    # Отменить исходящие/входящие pending offers
    await session.execute(
        update(AssignmentOffer)
        .where(
            AssignmentOffer.status == OfferStatus.pending,
            (AssignmentOffer.initiator_user_id == user.id)
            | (AssignmentOffer.recipient_user_id == user.id),
        )
        .values(status=OfferStatus.cancelled)
    )

    if partner is None:
        # Последний участник — удалить дом
        await session.delete(membership)
        await session.flush()
        await delete_household(session, household_id=household.id, actor_user_id=user.id)
    else:
        if household.owner_user_id == user.id:
            await transfer_ownership(
                session, household=household, new_owner_id=partner.user_id
            )
        await session.delete(membership)
        await session.flush()


async def delete_user_account(
    session: AsyncSession,
    *,
    user: User,
) -> None:
    """/delete_me — выйти из дома и удалить личные данные."""
    membership = await session.execute(
        select(Membership).where(Membership.user_id == user.id)
    )
    if membership.scalar_one_or_none() is not None:
        await leave_household(session, user=user)

    # Анонимизировать ссылки на выполнения: completed_by останется NULL через SET NULL
    # или можно оставить FK SET NULL — в модели ON DELETE SET NULL для completed_by
    await session.execute(delete(Notification).where(Notification.user_id == user.id))
    await session.delete(user)
    await session.flush()


def daily_summary_unique_key(user_id: int, local_date: date) -> str:
    return f"daily_summary:{user_id}:{local_date.isoformat()}"


async def ensure_daily_notification(
    session: AsyncSession,
    *,
    user: User,
    household: Household,
    for_local_date: date,
) -> Notification | None:
    """Создать запись ежедневного напоминания, если ещё нет (идемпотентно)."""
    if not user.notifications_enabled or user.bot_blocked:
        return None
    if user.notifications_paused_until and user.notifications_paused_until > for_local_date:
        return None

    scheduled = local_date_to_utc_datetime(
        for_local_date, user.notification_time, household.timezone
    )
    key = daily_summary_unique_key(user.id, for_local_date)

    stmt = (
        insert(Notification)
        .values(
            user_id=user.id,
            household_id=household.id,
            notification_type=NotificationType.daily_summary,
            scheduled_for=scheduled,
            unique_key=key,
            status=NotificationStatus.pending,
            attempts=0,
        )
        .on_conflict_do_nothing(index_elements=["unique_key"])
        .returning(Notification.id)
    )
    result = await session.execute(stmt)
    row = result.first()
    await session.flush()
    if row is None:
        existing = await session.execute(
            select(Notification).where(Notification.unique_key == key)
        )
        return existing.scalar_one_or_none()
    notif = await session.get(Notification, row[0])
    return notif


async def schedule_notifications_for_today(session: AsyncSession) -> int:
    """Пройти всех участников и создать записи на сегодняшнюю локальную дату дома."""
    result = await session.execute(
        select(Membership).options(
            selectinload(Membership.user),
            selectinload(Membership.household),
        )
    )
    created = 0
    for m in result.scalars().all():
        today = local_today(m.household.timezone)
        before = await session.execute(
            select(Notification).where(
                Notification.unique_key == daily_summary_unique_key(m.user.id, today)
            )
        )
        existed = before.scalar_one_or_none() is not None
        await ensure_daily_notification(
            session, user=m.user, household=m.household, for_local_date=today
        )
        if not existed:
            # проверим снова
            after = await session.execute(
                select(Notification).where(
                    Notification.unique_key == daily_summary_unique_key(m.user.id, today)
                )
            )
            if after.scalar_one_or_none() is not None and (
                m.user.notifications_enabled and not m.user.bot_blocked
            ):
                created += 1
    await session.flush()
    return created


async def fetch_due_notifications(
    session: AsyncSession,
    *,
    now: datetime | None = None,
    limit: int = 50,
) -> list[Notification]:
    moment = now or utc_now()
    settings = get_settings()
    earliest = moment - timedelta(hours=settings.reminder_catchup_hours)

    result = await session.execute(
        select(Notification)
        .where(
            Notification.status == NotificationStatus.pending,
            Notification.scheduled_for <= moment,
            Notification.scheduled_for >= earliest,
        )
        .order_by(Notification.scheduled_for)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list(result.scalars().all())


async def skip_stale_notifications(
    session: AsyncSession,
    *,
    now: datetime | None = None,
) -> int:
    moment = now or utc_now()
    settings = get_settings()
    cutoff = moment - timedelta(hours=settings.reminder_catchup_hours)
    result = await session.execute(
        update(Notification)
        .where(
            Notification.status == NotificationStatus.pending,
            Notification.scheduled_for < cutoff,
        )
        .values(status=NotificationStatus.skipped, last_error="stale_missed_window")
    )
    await session.flush()
    return result.rowcount or 0


async def build_daily_summary_text(
    session: AsyncSession,
    *,
    user_id: int,
    household_id: int,
    timezone: str,
) -> str | None:
    today = local_today(timezone)
    q = (
        select(TaskOccurrence)
        .join(ChoreTemplate)
        .where(
            ChoreTemplate.household_id == household_id,
            ChoreTemplate.status == ChoreStatus.active,
            TaskOccurrence.status == OccurrenceStatus.open,
            TaskOccurrence.assignee_user_id == user_id,
            TaskOccurrence.due_date <= today,
        )
        .options(selectinload(TaskOccurrence.template))
        .order_by(TaskOccurrence.due_date)
    )
    result = await session.execute(q)
    items = list(result.scalars().all())
    if not items:
        return None

    lines = ["Сегодня и просроченные:"]
    for occ in items:
        mark = " (просрочено)" if occ.due_date < today else ""
        lines.append(
            f"• {occ.template.title} — {occ.template.duration_minutes} мин"
            f", до {occ.due_date.isoformat()}{mark}"
        )
    return "\n".join(lines)


async def mark_notification_sent(
    session: AsyncSession,
    notification: Notification,
) -> None:
    notification.status = NotificationStatus.sent
    notification.sent_at = utc_now()
    notification.attempts += 1
    await record_event(
        session,
        "reminder_sent",
        household_id=notification.household_id,
        user_id=notification.user_id,
    )
    await session.flush()


async def mark_notification_failed(
    session: AsyncSession,
    notification: Notification,
    error: str,
    *,
    bot_blocked: bool = False,
) -> None:
    notification.attempts += 1
    notification.last_error = error[:255]
    if bot_blocked:
        notification.status = NotificationStatus.failed
        user = await session.get(User, notification.user_id)
        if user:
            user.bot_blocked = True
            user.notifications_enabled = False
    elif notification.attempts >= 5:
        notification.status = NotificationStatus.failed
    # иначе остаётся pending для повтора с задержкой (scheduled_for сдвигаем)
    else:
        delay = min(30, 2**notification.attempts)
        notification.scheduled_for = utc_now() + timedelta(minutes=delay)

    await record_event(
        session,
        "reminder_failed",
        household_id=notification.household_id,
        user_id=notification.user_id,
    )
    await session.flush()
