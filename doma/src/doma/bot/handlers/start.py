from aiogram import F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from doma.bot.keyboards import (
    join_invite_kb,
    main_menu_kb,
    start_kb,
)
from doma.bot.states import InviteStates
from doma.config import Settings
from doma.services import invitation as invitation_service
from doma.services.access import get_member_context, get_or_create_user

router = Router(name="start")


@router.message(CommandStart(deep_link=True))
async def cmd_start_deeplink(
    message: Message,
    command: CommandObject,
    session: AsyncSession,
    state: FSMContext,
    settings: Settings,
) -> None:
    await state.clear()
    user = await get_or_create_user(
        session,
        message.from_user.id,
        message.from_user.full_name or "Участник",
    )
    token = (command.args or "").strip()
    ctx = await get_member_context(session, user.id)
    if ctx is not None:
        await message.answer(
            f"Вы уже в доме «{ctx.household.name}».",
            reply_markup=main_menu_kb(),
        )
        return

    try:
        preview = await invitation_service.preview_invitation(session, token)
    except invitation_service.InvitationError as exc:
        text = {
            "not_found": "Приглашение не найдено. Попросите новую ссылку.",
            "revoked": "Приглашение отозвано. Попросите новую ссылку.",
            "already_used": "Эта ссылка уже использована. Попросите новую.",
            "expired": "Срок приглашения истёк (48 часов). Попросите новую ссылку.",
        }.get(exc.code, "Не удалось открыть приглашение.")
        await message.answer(text, reply_markup=start_kb())
        return

    await state.set_state(InviteStates.confirm)
    await state.update_data(invite_token=token)
    await message.answer(
        f"Вас приглашают в дом «{preview.household_name}» "
        f"(пригласил: {preview.inviter_name}).\n"
        "Присоединиться?",
        reply_markup=join_invite_kb(token),
    )


@router.message(CommandStart())
async def cmd_start(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
    settings: Settings,
) -> None:
    await state.clear()
    user = await get_or_create_user(
        session,
        message.from_user.id,
        message.from_user.full_name or "Участник",
    )
    ctx = await get_member_context(session, user.id)
    if ctx is not None:
        await message.answer(
            f"Снова здравствуйте. Дом «{ctx.household.name}».\n"
            "Бот хранит договорённости и напоминает о делах сам.",
            reply_markup=main_menu_kb(),
        )
        return

    await message.answer(
        "Дома — договорённости по домашним делам без взаимных напоминаний.\n"
        "Создайте дом или вступите по приглашению.",
        reply_markup=start_kb(),
    )


@router.callback_query(F.data == "invite:join")
async def invite_join(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    token = data.get("invite_token")
    if not token:
        await callback.answer("Сначала откройте ссылку-приглашение", show_alert=True)
        return

    user = await get_or_create_user(
        session,
        callback.from_user.id,
        callback.from_user.full_name or "Участник",
    )
    try:
        membership = await invitation_service.accept_invitation(
            session, raw_token=token, user=user
        )
    except invitation_service.InvitationError as exc:
        msg = {
            "household_full": "В доме уже двое участников.",
            "already_in_household": "Вы уже состоите в доме.",
            "already_used": "Приглашение уже использовано.",
            "expired": "Приглашение истекло.",
            "revoked": "Приглашение отозвано.",
        }.get(exc.code, "Не удалось присоединиться.")
        await callback.message.edit_text(msg)
        await callback.answer()
        await state.clear()
        return

    await state.clear()
    await callback.message.edit_text(f"Вы в доме «{membership.household.name}».")
    await callback.message.answer("Главное меню:", reply_markup=main_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "invite:cancel")
async def invite_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("Вступление отменено.")
    await callback.message.answer(
        "Можно создать свой дом или открыть новую ссылку.",
        reply_markup=start_kb(),
    )
    await callback.answer()


@router.message(Command("delete_me"))
async def cmd_delete_me(message: Message, session: AsyncSession, state: FSMContext) -> None:
    await state.clear()
    await message.answer(
        "Будут удалены ваши настройки и выход из дома. "
        "В истории оставшегося участника автор старых выполнений станет «Бывший участник». "
        "Чтобы подтвердить, отправьте: УДАЛИТЬ МЕНЯ"
    )
    await state.set_state(InviteStates.wait_token)
    await state.update_data(delete_confirm=True)


@router.message(InviteStates.wait_token, F.text == "УДАЛИТЬ МЕНЯ")
async def confirm_delete_me(message: Message, session: AsyncSession, state: FSMContext) -> None:
    data = await state.get_data()
    if not data.get("delete_confirm"):
        return
    user = await get_or_create_user(
        session,
        message.from_user.id,
        message.from_user.full_name or "Участник",
    )
    from doma.services.membership import delete_user_account

    await delete_user_account(session, user=user)
    await state.clear()
    await message.answer("Данные удалены. Чтобы начать снова — /start", reply_markup=start_kb())
