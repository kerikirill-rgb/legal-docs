import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import timedelta

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter
from sqlalchemy.ext.asyncio import async_sessionmaker

from doma.db.models import Household, Notification, NotificationStatus, User
from doma.db.session import session_scope
from doma.services.membership import (
    build_daily_summary_text,
    fetch_due_notifications,
    mark_notification_failed,
    mark_notification_sent,
    schedule_notifications_for_today,
    skip_stale_notifications,
)
from doma.services.timeutil import utc_now

logger = logging.getLogger(__name__)

SendFunc = Callable[[int, str], Awaitable[None]]


async def process_notification_queue(
    session_factory: async_sessionmaker,
    send: SendFunc,
) -> None:
    async with session_scope(session_factory) as session:
        await schedule_notifications_for_today(session)
        await skip_stale_notifications(session)
        due = await fetch_due_notifications(session)
        due_ids = [n.id for n in due]

    for notif_id in due_ids:
        async with session_scope(session_factory) as session:
            n = await session.get(Notification, notif_id)
            if n is None or n.status != NotificationStatus.pending:
                continue
            user = await session.get(User, n.user_id)
            if user is None or user.bot_blocked or not user.notifications_enabled:
                n.status = NotificationStatus.skipped
                await session.flush()
                continue

            text = None
            if n.household_id is not None:
                hh = await session.get(Household, n.household_id)
                if hh:
                    text = await build_daily_summary_text(
                        session,
                        user_id=user.id,
                        household_id=hh.id,
                        timezone=hh.timezone,
                    )

            if not text:
                n.status = NotificationStatus.skipped
                n.last_error = "no_tasks"
                await session.flush()
                continue

            telegram_id = user.telegram_id

        try:
            await send(telegram_id, text)
        except TelegramForbiddenError:
            async with session_scope(session_factory) as session:
                n = await session.get(Notification, notif_id)
                if n:
                    await mark_notification_failed(
                        session, n, "bot_blocked", bot_blocked=True
                    )
            continue
        except TelegramRetryAfter as exc:
            async with session_scope(session_factory) as session:
                n = await session.get(Notification, notif_id)
                if n:
                    n.scheduled_for = utc_now() + timedelta(seconds=exc.retry_after)
                    n.attempts += 1
                    await session.flush()
            continue
        except Exception as exc:
            logger.warning(
                "notification_send_failed id=%s err=%s", notif_id, type(exc).__name__
            )
            async with session_scope(session_factory) as session:
                n = await session.get(Notification, notif_id)
                if n:
                    await mark_notification_failed(session, n, type(exc).__name__)
            continue

        async with session_scope(session_factory) as session:
            n = await session.get(Notification, notif_id)
            if n:
                await mark_notification_sent(session, n)


async def reminder_loop(
    bot: Bot,
    session_factory: async_sessionmaker,
    *,
    interval_seconds: float = 60,
    stop_event: asyncio.Event | None = None,
) -> None:
    stop = stop_event or asyncio.Event()

    async def send(telegram_id: int, text: str) -> None:
        await bot.send_message(telegram_id, text)

    logger.info("reminder_loop_started")
    while not stop.is_set():
        try:
            await process_notification_queue(session_factory, send)
        except Exception:
            logger.exception("reminder_loop_iteration_failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except TimeoutError:
            continue
    logger.info("reminder_loop_stopped")
