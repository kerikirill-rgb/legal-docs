from datetime import date, timedelta

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from doma.bot.keyboards import main_menu_kb, my_list_nav_kb, occurrence_actions_kb, offer_kb
from doma.bot.states import PostponeStates
from doma.db.models import User
from doma.services import task as task_service
from doma.services.access import (
    AccessError,
    get_member_context,
    get_or_create_user,
    get_partner,
    require_occurrence_access,
)
from doma.services.timeutil import local_today

router = Router(name="tasks")


def _fmt_occ(occ, today: date, names: dict[int, str]) -> str:
    overdue = " ⚠️ просрочено" if occ.due_date < today else ""
    assignee = names.get(occ.assignee_user_id or -1, "не назначен")
    return (
        f"• {occ.template.title}{overdue}\n"
        f"  исполнитель: {assignee}, до {occ.due_date.isoformat()}, "
        f"{occ.template.duration_minutes} мин"
    )


async def _name_map(session: AsyncSession, user_ids: set[int]) -> dict[int, str]:
    result = {}
    for uid in user_ids:
        if uid is None:
            continue
        u = await session.get(User, uid)
        if u:
            result[uid] = u.display_name
    return result


@router.message(F.text == "Мои дела")
async def my_tasks(message: Message, session: AsyncSession, state: FSMContext) -> None:
    await state.clear()
    await _show_my_list(message, session, offset=0, future=False)


@router.callback_query(F.data.startswith("mylist:"))
async def my_list_nav(callback: CallbackQuery, session: AsyncSession) -> None:
    parts = callback.data.split(":")
    if parts[1] == "future":
        await _show_my_list(callback.message, session, offset=0, future=True, edit=True)
    elif parts[1] == "today":
        await _show_my_list(callback.message, session, offset=0, future=False, edit=True)
    elif parts[1] == "page":
        offset = int(parts[2])
        # determine mode from message — default today
        await _show_my_list(callback.message, session, offset=max(0, offset), future=False, edit=True)
    await callback.answer()


async def _show_my_list(
    message: Message,
    session: AsyncSession,
    *,
    offset: int,
    future: bool,
    edit: bool = False,
) -> None:
    user = await get_or_create_user(
        session, message.chat.id if edit else message.from_user.id,
        (message.from_user.full_name if message.from_user else "Участник") or "Участник",
    )
    # When editing from callback, from_user may be on callback — chat.id is telegram_id for private
    if edit:
        # message.chat.id == telegram user id in private chats
        from sqlalchemy import select

        from doma.db.models import User as DbUser

        res = await session.execute(select(DbUser).where(DbUser.telegram_id == message.chat.id))
        user = res.scalar_one_or_none() or user

    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Сначала создайте дом: /start")
        return

    today = local_today(ctx.household.timezone)
    items = await task_service.list_my_occurrences(
        session,
        user_id=user.id,
        household_id=ctx.household.id,
        today=today,
        include_future=future,
        limit=10,
        offset=offset,
    )
    names = await _name_map(session, {i.assignee_user_id for i in items if i.assignee_user_id})

    title = "Будущие дела:" if future else "Мои дела (просроченные и сегодня):"
    if not items:
        text = title + "\nПока пусто."
        kb = my_list_nav_kb(show_future=future, offset=offset)
        if edit:
            await message.edit_text(text, reply_markup=kb)
        else:
            await message.answer(text, reply_markup=main_menu_kb())
            await message.answer("Навигация:", reply_markup=kb)
        return

    lines = [title]
    for occ in items:
        lines.append(_fmt_occ(occ, today, names))
    text = "\n".join(lines)

    if edit:
        await message.edit_text(text, reply_markup=my_list_nav_kb(show_future=future, offset=offset))
    else:
        await message.answer(text, reply_markup=main_menu_kb())
        for occ in items:
            await message.answer(
                f"{occ.template.title} — до {occ.due_date.isoformat()}",
                reply_markup=occurrence_actions_kb(occ.id, is_assignee=True),
            )


@router.message(F.text == "Все дела дома")
async def all_tasks(message: Message, session: AsyncSession, state: FSMContext) -> None:
    await state.clear()
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Сначала создайте дом: /start")
        return
    today = local_today(ctx.household.timezone)
    items = await task_service.list_household_occurrences(
        session, household_id=ctx.household.id, today=today
    )
    names = await _name_map(session, {i.assignee_user_id for i in items if i.assignee_user_id})
    if not items:
        await message.answer("Открытых дел на сегодня/просроченных нет.", reply_markup=main_menu_kb())
        return
    lines = ["Все дела дома (сегодня и просроченные):"]
    for occ in items:
        lines.append(_fmt_occ(occ, today, names))
    await message.answer("\n".join(lines), reply_markup=main_menu_kb())
    for occ in items:
        is_assignee = occ.assignee_user_id == user.id
        await message.answer(
            f"{occ.template.title}",
            reply_markup=occurrence_actions_kb(occ.id, is_assignee=is_assignee),
        )


@router.message(F.text == "История")
async def history(message: Message, session: AsyncSession) -> None:
    from datetime import timedelta

    from doma.config import get_settings

    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    ctx = await get_member_context(session, user.id)
    if ctx is None:
        await message.answer("Сначала создайте дом: /start")
        return
    settings = get_settings()
    since = local_today(ctx.household.timezone) - timedelta(days=settings.history_days)
    items = await task_service.list_history(
        session, household_id=ctx.household.id, since=since
    )
    if not items:
        await message.answer("За последние 7 дней выполнений нет.", reply_markup=main_menu_kb())
        return
    lines = ["История за 7 дней:"]
    for occ in items:
        author_id = occ.completed_by_user_id
        if author_id:
            author = await session.get(User, author_id)
            author_name = author.display_name if author else "Бывший участник"
        else:
            author_name = "Бывший участник"
        when = occ.completed_at.date().isoformat() if occ.completed_at else "?"
        lines.append(f"• {occ.template.title} — {author_name}, {when}")
    await message.answer("\n".join(lines), reply_markup=main_menu_kb())


@router.callback_query(F.data.startswith("occ:done:"))
async def occ_done(callback: CallbackQuery, session: AsyncSession) -> None:
    occ_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        ctx, occ, template = await require_occurrence_access(session, user.id, occ_id)
        result = await task_service.complete_occurrence(
            session,
            occurrence_id=occ_id,
            actor=user,
            household_timezone=ctx.household.timezone,
        )
    except AccessError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    except task_service.TaskError as exc:
        await callback.answer(
            {
                "already_closed": "Уже отмечено",
                "concurrent_complete": "Уже отмечено другим",
            }.get(exc.code, exc.code),
            show_alert=True,
        )
        return

    await callback.message.edit_text(
        f"Готово: «{template.title}». Следующий срок — {result.next_occurrence.due_date.isoformat()}."
    )
    await callback.answer("Сделано")


@router.callback_query(F.data.startswith("occ:tomorrow:"))
async def occ_tomorrow(callback: CallbackQuery, session: AsyncSession) -> None:
    occ_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        ctx, occ, template = await require_occurrence_access(session, user.id, occ_id)
        today = local_today(ctx.household.timezone)
        await task_service.postpone_occurrence(
            session,
            occurrence_id=occ_id,
            actor=user,
            new_due_date=today + timedelta(days=1),
            household_timezone=ctx.household.timezone,
        )
    except (AccessError, task_service.TaskError) as exc:
        code = getattr(exc, "code", "error")
        await callback.answer(code, show_alert=True)
        return
    await callback.message.edit_text(f"«{template.title}» перенесено на завтра.")
    await callback.answer()


@router.callback_query(F.data.startswith("occ:date:"))
async def occ_date(callback: CallbackQuery, state: FSMContext) -> None:
    occ_id = int(callback.data.rsplit(":", 1)[1])
    await state.set_state(PostponeStates.wait_date)
    await state.update_data(postpone_occ_id=occ_id)
    await callback.message.answer("Введите новую дату ГГГГ-ММ-ДД (будущий день):")
    await callback.answer()


@router.message(PostponeStates.wait_date, F.text)
async def postpone_date(message: Message, session: AsyncSession, state: FSMContext) -> None:
    data = await state.get_data()
    occ_id = data.get("postpone_occ_id")
    try:
        new_date = date.fromisoformat((message.text or "").strip())
    except ValueError:
        await message.answer("Формат ГГГГ-ММ-ДД.")
        return
    user = await get_or_create_user(
        session, message.from_user.id, message.from_user.full_name or "Участник"
    )
    try:
        ctx, _, template = await require_occurrence_access(session, user.id, occ_id)
        await task_service.postpone_occurrence(
            session,
            occurrence_id=occ_id,
            actor=user,
            new_due_date=new_date,
            household_timezone=ctx.household.timezone,
        )
    except (AccessError, task_service.TaskError) as exc:
        await message.answer(f"Не удалось перенести: {getattr(exc, 'code', exc)}")
        await state.clear()
        return
    await state.clear()
    await message.answer(
        f"«{template.title}» перенесено на {new_date.isoformat()}.",
        reply_markup=main_menu_kb(),
    )


@router.callback_query(F.data.startswith("occ:transfer:"))
async def occ_transfer(callback: CallbackQuery, session: AsyncSession, bot: Bot) -> None:
    occ_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        ctx, occ, template = await require_occurrence_access(session, user.id, occ_id)
        partner = await get_partner(session, ctx)
        if partner is None:
            await callback.answer("В доме пока нет второго участника", show_alert=True)
            return
        offer = await task_service.propose_transfer(
            session, occurrence_id=occ_id, actor=user, recipient=partner
        )
    except (AccessError, task_service.TaskError) as exc:
        await callback.answer(getattr(exc, "code", "error"), show_alert=True)
        return

    await callback.message.answer("Предложение отправлено партнёру.")
    try:
        await bot.send_message(
            partner.telegram_id,
            f"{user.display_name} предлагает вам взять «{template.title}» "
            f"(срок {occ.due_date.isoformat()}).",
            reply_markup=offer_kb(offer.id, prefix="xfer"),
        )
    except Exception:
        pass
    await callback.answer()


@router.callback_query(F.data.startswith("xfer:yes:"))
async def xfer_yes(callback: CallbackQuery, session: AsyncSession) -> None:
    offer_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        await task_service.accept_transfer(session, offer_id=offer_id, user=user)
    except task_service.TaskError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    await callback.message.edit_text("Вы взяли это выполнение.")
    await callback.answer()


@router.callback_query(F.data.startswith("xfer:no:"))
async def xfer_no(callback: CallbackQuery, session: AsyncSession) -> None:
    offer_id = int(callback.data.rsplit(":", 1)[1])
    user = await get_or_create_user(
        session, callback.from_user.id, callback.from_user.full_name or "Участник"
    )
    try:
        await task_service.decline_transfer(session, offer_id=offer_id, user=user)
    except task_service.TaskError as exc:
        await callback.answer(exc.code, show_alert=True)
        return
    await callback.message.edit_text("Отказ от передачи принят.")
    await callback.answer()
