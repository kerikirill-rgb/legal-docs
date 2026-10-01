from datetime import date, timedelta

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from doma.bot.keyboards import (
    assignee_kb,
    declined_chore_kb,
    interval_kb,
    main_menu_kb,
    offer_kb,
)
from doma.bot.states import AddChoreStates
from doma.services import chore as chore_service
from doma.services.access import get_member_context, get_or_create_user, get_partner
from doma.services.timeutil import local_today

router = Router(name="chores")


@router.message(F.text == "Добавить дело")
async def add_chore_start(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Сначала создайте или вступите в дом: /start")
        return
    await state.set_state(AddChoreStates.title)
    await message.answer("Название дела (до 100 символов):")


@router.message(AddChoreStates.title, F.text)
async def add_chore_title(message: Message, state: FSMContext) -> None:
    title = (message.text or "").strip()
    if not title or len(title) > 100:
        await message.answer("Название: 1–100 символов.")
        return
    await state.update_data(title=title)
    await state.set_state(AddChoreStates.interval)
    await message.answer("Как часто повторять?", reply_markup=interval_kb())


@router.callback_query(F.data.startswith("interval:"))
async def add_chore_interval(callback: CallbackQuery, state: FSMContext) -> None:
    value = callback.data.split(":", 1)[1]
    if value == "custom":
        await state.set_state(AddChoreStates.interval_custom)
        await callback.message.answer("Введите число дней (1–365):")
        await callback.answer()
        return
    await state.update_data(interval_days=int(value))
    await state.set_state(AddChoreStates.duration)
    await callback.message.answer("Сколько примерно минут занимает? (1–180)")
    await callback.answer()


@router.message(AddChoreStates.interval_custom, F.text)
async def add_chore_interval_custom(message: Message, state: FSMContext) -> None:
    try:
        days = int((message.text or "").strip())
        if days < 1 or days > 365:
            raise ValueError
    except ValueError:
        await message.answer("Число от 1 до 365.")
        return
    await state.update_data(interval_days=days)
    await state.set_state(AddChoreStates.duration)
    await message.answer("Сколько примерно минут занимает? (1–180)")


@router.message(AddChoreStates.duration, F.text)
async def add_chore_duration(message: Message, state: FSMContext) -> None:
    try:
        mins = int((message.text or "").strip())
        if mins < 1 or mins > 180:
            raise ValueError
    except ValueError:
        await message.answer("Число от 1 до 180.")
        return
    await state.update_data(duration=mins)
    await state.set_state(AddChoreStates.due)
    await message.answer(
        "Первая дата (ГГГГ-ММ-ДД) или «сегодня» / «завтра»:"
    )


@router.message(AddChoreStates.due, F.text)
async def add_chore_due(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await state.clear()
        return
    raw = (message.text or "").strip().lower()
    today = local_today(ctx.household.timezone)
    if raw == "сегодня":
        due = today
    elif raw == "завтра":
        due = today + timedelta(days=1)
    else:
        try:
            due = date.fromisoformat(raw)
        except ValueError:
            await message.answer("Формат ГГГГ-ММ-ДД, либо «сегодня»/«завтра».")
            return
    await state.update_data(due=due.isoformat())
    partner = await get_partner(session, ctx)
    await state.set_state(AddChoreStates.assignee)
    await message.answer(
        "Кто постоянный исполнитель?",
        reply_markup=assignee_kb(has_partner=partner is not None),
    )


@router.callback_query(F.data.startswith("assignee:"))
async def add_chore_assignee(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
    bot: Bot,
) -> None:
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await callback.answer("Нет дома", show_alert=True)
        return

    data = await state.get_data()
    who = callback.data.split(":", 1)[1]
    partner = await get_partner(session, ctx)
    assignee = user if who == "self" else partner
    if assignee is None:
        await callback.answer("Партнёра пока нет", show_alert=True)
        return

    try:
        result = await chore_service.create_chore(
            session,
            household_id=ctx.household.id,
            created_by=user,
            title=data["title"],
            interval_days=int(data["interval_days"]),
            duration_minutes=int(data["duration"]),
            first_due_date=date.fromisoformat(data["due"]),
            assignee=assignee,
        )
    except chore_service.ChoreError as exc:
        await callback.message.answer(f"Не удалось создать дело ({exc.code}).")
        await callback.answer()
        await state.clear()
        return

    await state.clear()
    if result.needs_acceptance and result.offer and partner:
        await callback.message.answer(
            f"Дело «{result.template.title}» создано. Ожидает согласия партнёра.",
            reply_markup=main_menu_kb(),
        )
        try:
            await bot.send_message(
                partner.telegram_id,
                f"{user.display_name} предлагает вам дело «{result.template.title}» "
                f"(каждые {result.template.interval_days} дн., "
                f"{result.template.duration_minutes} мин).",
                reply_markup=offer_kb(result.offer.id, prefix="assign"),
            )
        except Exception:
            pass
    else:
        await callback.message.answer(
            f"Дело «{result.template.title}» добавлено.",
            reply_markup=main_menu_kb(),
        )
    await callback.answer()


@router.callback_query(F.data.startswith("assign:yes:"))
async def assign_yes(callback: CallbackQuery, session: AsyncSession, bot: Bot) -> None:
    offer_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        template = await chore_service.accept_chore_assignment(
            session, offer_id=offer_id, user=user
        )
    except chore_service.ChoreError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    await callback.message.edit_text(f"Вы приняли дело «{template.title}».")
    await callback.answer()


@router.callback_query(F.data.startswith("assign:no:"))
async def assign_no(callback: CallbackQuery, session: AsyncSession, bot: Bot) -> None:
    offer_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        template = await chore_service.decline_chore_assignment(
            session, offer_id=offer_id, user=user
        )
    except chore_service.ChoreError as exc:
        await callback.answer(exc.code, show_alert=True)
        return

    await callback.message.edit_text("Отказ принят.")
    # Уведомить автора
    from doma.db.models import User as DbUser

    author = await session.get(DbUser, template.created_by_user_id)
    if author:
        try:
            await bot.send_message(
                author.telegram_id,
                f"Партнёр не принял дело «{template.title}».",
                reply_markup=declined_chore_kb(template.id),
            )
        except Exception:
            pass
    await callback.answer()


@router.callback_query(F.data.startswith("declined:take:"))
async def declined_take(callback: CallbackQuery, session: AsyncSession) -> None:
    template_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        template = await chore_service.take_declined_chore(
            session, template_id=template_id, user=user
        )
    except chore_service.ChoreError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    await callback.message.edit_text(f"Дело «{template.title}» теперь ваше.")
    await callback.answer()


@router.callback_query(F.data.startswith("declined:cancel:"))
async def declined_cancel(callback: CallbackQuery, session: AsyncSession) -> None:
    template_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        await chore_service.cancel_pending_chore(
            session, template_id=template_id, user=user
        )
    except chore_service.ChoreError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    await callback.message.edit_text("Создание дела отменено.")
    await callback.answer()
