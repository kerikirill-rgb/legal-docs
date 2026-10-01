import asyncio
import logging
import sys

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from doma.bot.app import create_dispatcher
from doma.config import get_settings
from doma.db.session import create_engine, create_session_factory
from doma.jobs.reminders import reminder_loop
from doma.logging_setup import setup_logging

logger = logging.getLogger(__name__)


async def run_bot() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)

    if not settings.bot_token or settings.bot_token.startswith("123456"):
        logger.error(
            "BOT_TOKEN не задан. Скопируйте doma/.env.example в .env и укажите токен."
        )
        sys.exit(1)

    engine = create_engine(settings)
    session_factory = create_session_factory(engine)

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = create_dispatcher(session_factory, settings)

    stop_event = asyncio.Event()
    reminder_task = asyncio.create_task(
        reminder_loop(bot, session_factory, stop_event=stop_event)
    )

    logger.info("starting_long_polling")
    # Не удаляем webhook автоматически: если бот уже на webhook — конфликт.
    # Владелец должен сам переключить режим (см. README).
    try:
        webhook_info = await bot.get_webhook_info()
        if webhook_info.url:
            logger.error(
                "У бота установлен webhook (%s). Long polling не запущен. "
                "Снимите webhook командой deleteWebhook через Bot API, затем перезапустите.",
                webhook_info.url.split("?")[0],
            )
            stop_event.set()
            await reminder_task
            await engine.dispose()
            return

        await dp.start_polling(bot)
    finally:
        stop_event.set()
        await reminder_task
        await bot.session.close()
        await engine.dispose()


def main() -> None:
    asyncio.run(run_bot())


if __name__ == "__main__":
    main()
