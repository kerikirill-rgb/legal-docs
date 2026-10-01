from datetime import time

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from doma.bot.keyboards import (
    main_menu_kb,
    notify_time_kb,
    starter_templates_kb,
    timezone_kb,
)
from doma.bot.states import CreateHomeStates, InviteStates
from doma.config import Settings
from doma.services import household as household_service
from doma.services import invitation as invitation_service
from doma.services.access import get_member_context, get_or_create_user
from doma.services.templates import STARTER_TEMPLATES
from doma.services.timeutil import local_today

router = Router(name="household")


@router.callback_query(F.data == "home:create")
async def home_create(callback: CallbackQuery, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    if await get_member_context(session, user.id):
        await callback.answer("Вы уже в доме", show_alert=True)
        return
    await state.set_state(CreateHomeStates.name)
    await callback.message.answer("Как назвать дом? Например: «Наша квартира».")
    await callback.answer()


@router.callback_query(F.data == "home:invite_code")
async def home_invite_code(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(InviteStates.wait_token)
    await state.update_data(delete_confirm=False)
    await callback.message.answer(
        "Пришлите токен из ссылки (часть после start=) или откройте ссылку целиком."
    )
    await callback.answer()


@router.message(InviteStates.wait_token, F.text)
async def invite_token_text(message: Message, session: AsyncSession, state: FSMContext) -> None:
    data = await state.get_data()
    if data.get("delete_confirm"):
        await message.answer("Для удаления аккаунта отправьте точно: УДАЛИТЬ МЕНЯ")
        return

    text = (message.text or "").strip()
    token = text
    if "start=" in text:
        token = text.split("start=", 1)[1].split("&", 1)[0].strip()

    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    if await get_member_context(session, user.id):
        await message.answer("Вы уже в доме.", reply_markup=main_menu_kb())
        await state.clear()
        return

    try:
        preview = await invitation_service.preview_invitation(session, token)
    except invitation_service.InvitationError:
        await message.answer("Приглашение недействительно. Попросите новую ссылку.")
        return

    await state.set_state(InviteStates.confirm)
    await state.update_data(invite_token=token)
    from doma.bot.keyboards import join_invite_kb

    await message.answer(
        f"Дом «{preview.household_name}», пригласил: {preview.inviter_name}. Присоединиться?",
        reply_markup=join_invite_kb(token),
    )


@router.message(CreateHomeStates.name, F.text)
async def home_name(
    message: Message,
    state: FSMContext,
    settings: Settings,
) -> None:
    name = (message.text or "").strip()
    if not name or len(name) > 100:
        await message.answer("Название: 1–100 символов.")
        return
    await state.update_data(home_name=name)
    await state.set_state(CreateHomeStates.seeds)  # временно; timezone через callback
    await message.answer(
        "Выберите часовой пояс дома. "
        f"Для тестовой группы предлагаем {settings.default_timezone}, "
        "но применяем его только после вашего выбора.",
        reply_markup=timezone_kb(settings.default_timezone),
    )


@router.callback_query(F.data.startswith("tz:"))
async def home_tz(callback: CallbackQuery, state: FSMContext) -> None:
    value = callback.data.split(":", 1)[1]
    if value == "other":
        await state.set_state(CreateHomeStates.timezone_other)
        await callback.message.answer(
            "Введите IANA-зону, например Europe/Samara или Asia/Novosibirsk."
        )
        await callback.answer()
        return
    await state.update_data(timezone=value)
    await callback.message.answer(
        "Во сколько присылать ежедневное напоминание (локальное время дома)?",
        reply_markup=notify_time_kb(),
    )
    await callback.answer()


@router.message(CreateHomeStates.timezone_other, F.text)
async def home_tz_other(message: Message, state: FSMContext) -> None:
    from doma.services.timeutil import SUPPORTED_TIMEZONES

    tz = (message.text or "").strip()
    if tz not in SUPPORTED_TIMEZONES:
        await message.answer(
            "Эта зона не в списке поддерживаемых. Доступны:\n"
            + ", ".join(SUPPORTED_TIMEZONES)
        )
        return
    await state.update_data(timezone=tz)
    await message.answer(
        "Во сколько присылать ежедневное напоминание?",
        reply_markup=notify_time_kb(),
    )


@router.callback_query(F.data.startswith("ntime:"))
async def home_ntime(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    value = callback.data.split(":", 1)[1]
    if value == "other":
        await state.set_state(CreateHomeStates.notify_other)
        await callback.message.answer("Введите время в формате ЧЧ:ММ, например 07:30.")
        await callback.answer()
        return

    hh, mm = value.split(":")
    await _finish_home_create(callback, session, state, time(int(hh), int(mm)))


@router.message(CreateHomeStates.notify_other, F.text)
async def home_ntime_other(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    raw = (message.text or "").strip()
    try:
        hh, mm = raw.split(":")
        t = time(int(hh), int(mm))
    except Exception:
        await message.answer("Формат ЧЧ:ММ, например 09:00.")
        return
    # fake callback-like finish
    class _Msg:
        def __init__(self, m: Message) -> None:
            self.message = m
            self.from_user = m.from_user

        async def answer(self, *a, **k):
            return await self.message.answer(*a, **k)

    await _finish_home_create_message(message, session, state, t)


async def _finish_home_create(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
    notify_time: time,
) -> None:
    data = await state.get_data()
    name = data.get("home_name")
    timezone = data.get("timezone")
    if not name or not timezone:
        await callback.answer("Начните создание дома заново: /start", show_alert=True)
        return

    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        result = await household_service.create_household(
            session,
            user=user,
            name=name,
            timezone=timezone,
            notification_time=notify_time,
        )
    except household_service.HouseholdError as exc:
        await callback.message.answer(f"Не удалось создать дом ({exc.code}).")
        await callback.answer()
        return

    await state.set_state(CreateHomeStates.seeds)
    await state.update_data(selected_seeds=[], household_id=result.household.id)
    await callback.message.answer(
        f"Дом «{result.household.name}» создан.\n"
        "Выберите стартовые дела (можно пропустить и добавить позже):",
        reply_markup=starter_templates_kb(set()),
    )
    await callback.answer()


async def _finish_home_create_message(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
    notify_time: time,
) -> None:
    data = await state.get_data()
    name = data.get("home_name")
    timezone = data.get("timezone")
    if not name or not timezone:
        await message.answer("Начните создание дома заново: /start")
        return
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    result = await household_service.create_household(
        session,
        user=user,
        name=name,
        timezone=timezone,
        notification_time=notify_time,
    )
    await state.set_state(CreateHomeStates.seeds)
    await state.update_data(selected_seeds=[], household_id=result.household.id)
    await message.answer(
        f"Дом «{result.household.name}» создан.\nВыберите стартовые дела:",
        reply_markup=starter_templates_kb(set()),
    )


@router.callback_query(F.data.startswith("seed:toggle:"))
async def seed_toggle(callback: CallbackQuery, state: FSMContext) -> None:
    idx = int(callback.data.rsplit(":", 1)[1])
    data = await state.get_data()
    selected = set(data.get("selected_seeds") or [])
    if idx in selected:
        selected.remove(idx)
    else:
        selected.add(idx)
    await state.update_data(selected_seeds=list(selected))
    await callback.message.edit_reply_markup(reply_markup=starter_templates_kb(selected))
    await callback.answer()


@router.callback_query(F.data.in_({"seed:done", "seed:skip"}))
async def seed_finish(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    from doma.services import chore as chore_service

    data = await state.get_data()
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await callback.answer("Сначала создайте дом", show_alert=True)
        return

    selected = set(data.get("selected_seeds") or [])
    if callback.data == "seed:done" and selected:
        today = local_today(ctx.household.timezone)
        for idx in sorted(selected):
            seed = STARTER_TEMPLATES[idx]
            await chore_service.create_chore(
                session,
                household_id=ctx.household.id,
                created_by=user,
                title=seed.title,
                interval_days=seed.interval_days,
                duration_minutes=seed.duration_minutes,
                first_due_date=today,
                assignee=user,
                room=seed.room,
            )

    await state.clear()
    await callback.message.answer(
        "Готово. Можно пригласить второго человека в Настройках.\n"
        "Цель — собрать полезный список за пару минут.",
        reply_markup=main_menu_kb(),
    )
    await callback.answer()
