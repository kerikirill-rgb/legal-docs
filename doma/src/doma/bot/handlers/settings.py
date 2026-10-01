from datetime import time

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from doma.bot.keyboards import main_menu_kb, notify_time_kb, settings_kb, start_kb
from doma.bot.states import AiStates, SettingsStates
from doma.config import Settings
from doma.services import invitation as invitation_service
from doma.services.access import get_member_context, get_or_create_user
from doma.services.household import delete_household as hh_delete
from doma.services.membership import leave_household

router = Router(name="settings")


@router.message(F.text == "Настройки")
async def settings_menu(message: Message, session: AsyncSession, state: FSMContext) -> None:
    await state.clear()
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Сначала создайте дом: /start", reply_markup=start_kb())
        return
    await message.answer(
        f"Дом «{ctx.household.name}»\n"
        f"Часовой пояс: {ctx.household.timezone}\n"
        f"Уведомления: {'вкл' if user.notifications_enabled else 'выкл'} "
        f"в {user.notification_time.strftime('%H:%M')}",
        reply_markup=settings_kb(notifications_on=user.notifications_enabled),
    )


@router.callback_query(F.data == "settings:notify_toggle")
async def notify_toggle(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    user.notifications_enabled = not user.notifications_enabled
    await session.flush()
    await callback.message.edit_reply_markup(
        reply_markup=settings_kb(notifications_on=user.notifications_enabled)
    )
    await callback.answer(
        "Уведомления включены" if user.notifications_enabled else "Уведомления выключены"
    )


@router.callback_query(F.data == "settings:notify_time")
async def notify_time(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.message.answer("Выберите время:", reply_markup=notify_time_kb())
    await state.set_state(SettingsStates.notify_time)
    await callback.answer()


@router.callback_query(SettingsStates.notify_time, F.data.startswith("ntime:"))
async def notify_time_set(callback: CallbackQuery, session: AsyncSession, state: FSMContext) -> None:
    value = callback.data.split(":", 1)[1]
    if value == "other":
        await callback.message.answer("Введите ЧЧ:ММ:")
        await callback.answer()
        return
    hh, mm = value.split(":")
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    user.notification_time = time(int(hh), int(mm))
    await session.flush()
    await state.clear()
    await callback.message.answer(f"Время уведомления: {value}")
    await callback.answer()


@router.callback_query(F.data == "settings:invite")
async def settings_invite(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await callback.answer("Нет дома", show_alert=True)
        return
    try:
        created = await invitation_service.create_invitation(
            session, household=ctx.household, created_by=user
        )
    except invitation_service.InvitationError as exc:
        await callback.answer(
            "В доме уже двое" if exc.code == "household_full" else exc.code,
            show_alert=True,
        )
        return

    me = await callback.bot.get_me()
    link = f"https://t.me/{me.username}?start={created.raw_token}"
    await callback.message.answer(
        f"Ссылка-приглашение (действует 48 часов, одноразовая):\n{link}\n\n"
        "Токен не содержит имени и ID. Можно отозвать в настройках."
    )
    await callback.answer()


@router.callback_query(F.data == "settings:revoke")
async def settings_revoke(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await callback.answer("Нет дома", show_alert=True)
        return
    n = await invitation_service.revoke_invitation(
        session, household_id=ctx.household.id, actor_user_id=user.id
    )
    await callback.answer(f"Отозвано: {n}")
    await callback.message.answer(f"Активные приглашения отозваны: {n}.")


@router.callback_query(F.data == "settings:leave")
async def settings_leave(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(SettingsStates.confirm_leave)
    await callback.message.answer("Покинуть дом? Напишите: ПОКИНУТЬ")
    await callback.answer()


@router.message(SettingsStates.confirm_leave, F.text == "ПОКИНУТЬ")
async def confirm_leave(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    await leave_household(session, user=user)
    await state.clear()
    await message.answer("Вы покинули дом.", reply_markup=start_kb())


@router.callback_query(F.data == "settings:delete_home")
async def settings_delete_home(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(SettingsStates.confirm_delete)
    await callback.message.answer(
        "Удалить дом и все связанные данные? Напишите: УДАЛИТЬ ДОМ"
    )
    await callback.answer()


@router.message(SettingsStates.confirm_delete, F.text == "УДАЛИТЬ ДОМ")
async def confirm_delete_home(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Дома нет.")
        await state.clear()
        return
    try:
        await hh_delete(session, household_id=ctx.household.id, actor_user_id=user.id)
    except Exception as exc:
        await message.answer(f"Не удалось удалить: {exc}")
        await state.clear()
        return
    await state.clear()
    await message.answer("Дом удалён.", reply_markup=start_kb())


@router.callback_query(F.data == "settings:ai")
async def settings_ai(
    callback: CallbackQuery,
    state: FSMContext,
    settings: Settings,
) -> None:
    if not settings.ai_enabled:
        await callback.message.answer(
            "ИИ-подбор сейчас выключен. Используйте шаблоны при создании дома "
            "или добавьте дела вручную. Владелец может включить AI_ENABLED и провайдера."
        )
        await callback.answer()
        return
    await state.set_state(AiStates.confirm_privacy)
    await callback.message.answer(
        "Краткое описание быта будет передано ИИ-сервису (без Telegram ID и истории семьи).\n"
        "Продолжить? Напишите: ДА"
    )
    await callback.answer()


@router.message(AiStates.confirm_privacy, F.text.upper() == "ДА")
async def ai_privacy_ok(message: Message, state: FSMContext) -> None:
    await state.set_state(AiStates.wait_description)
    await message.answer(
        "Опишите быт одним сообщением (до 1000 символов), например:\n"
        "«Живём вдвоём, две комнаты, есть кот, хотим по 10 минут уборки в день»."
    )


@router.message(AiStates.wait_description, F.text)
async def ai_description(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
    settings: Settings,
) -> None:
    from doma.ai import build_provider
    from doma.ai import service as ai_service

    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await state.clear()
        return

    provider = build_provider(
        enabled=settings.ai_enabled,
        provider=settings.ai_provider,
        api_key=settings.ai_api_key,
        base_url=settings.ai_base_url,
        model=settings.ai_model,
        timeout_seconds=settings.ai_timeout_seconds,
    )
    try:
        suggestions = await ai_service.suggest_chores(
            session,
            settings=settings,
            provider=provider,
            household_id=ctx.household.id,
            user_id=user.id,
            timezone=ctx.household.timezone,
            description=message.text or "",
        )
    except ai_service.AiError as exc:
        await message.answer(
            "Не удалось получить предложения ИИ. Можно выбрать шаблоны вручную "
            f"({exc.code}).",
            reply_markup=main_menu_kb(),
        )
        await state.clear()
        return

    # Сохраняем черновик в FSM
    draft = [c.model_dump() for c in suggestions.chores]
    await state.set_state(AiStates.review)
    await state.update_data(ai_draft=draft)
    lines = ["Черновик предложений (ИИ). Напишите СОХРАНИТЬ или ОТМЕНА:"]
    for i, c in enumerate(suggestions.chores, 1):
        room = f", {c.room}" if c.room else ""
        lines.append(
            f"{i}. {c.title} — каждые {c.interval_days} дн., {c.duration_minutes} мин{room}"
        )
    await message.answer("\n".join(lines))


@router.message(AiStates.review, F.text.upper() == "СОХРАНИТЬ")
async def ai_save(message: Message, session: AsyncSession, state: FSMContext) -> None:
    from doma.ai import service as ai_service
    from doma.services import chore as chore_service
    from doma.services.timeutil import local_today

    data = await state.get_data()
    draft = data.get("ai_draft") or []
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await state.clear()
        return
    today = local_today(ctx.household.timezone)
    saved = 0
    for item in draft:
        try:
            await chore_service.create_chore(
                session,
                household_id=ctx.household.id,
                created_by=user,
                title=item["title"],
                interval_days=item["interval_days"],
                duration_minutes=item["duration_minutes"],
                first_due_date=today,
                assignee=user,
                room=item.get("room"),
            )
            saved += 1
        except chore_service.ChoreError:
            break
    await ai_service.record_ai_accepted(
        session, household_id=ctx.household.id, user_id=user.id
    )
    await state.clear()
    await message.answer(
        f"Сохранено дел: {saved}. Назначить партнёру можно при редактировании позже "
        "или создавая дела вручную.",
        reply_markup=main_menu_kb(),
    )


@router.message(AiStates.review, F.text.upper() == "ОТМЕНА")
async def ai_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("Черновик отменён.", reply_markup=main_menu_kb())
