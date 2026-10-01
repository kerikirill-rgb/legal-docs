from aiogram import Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy.ext.asyncio import async_sessionmaker

from doma.bot.handlers import chores, household, start, tasks
from doma.bot.handlers import settings as settings_handlers
from doma.bot.middlewares import DbSessionMiddleware
from doma.config import Settings


def create_dispatcher(
    session_factory: async_sessionmaker,
    settings: Settings,
) -> Dispatcher:
    dp = Dispatcher(storage=MemoryStorage())
    dp["settings"] = settings
    dp.update.middleware(DbSessionMiddleware(session_factory))

    dp.include_router(start.router)
    dp.include_router(household.router)
    dp.include_router(chores.router)
    dp.include_router(tasks.router)
    dp.include_router(settings_handlers.router)
    return dp
