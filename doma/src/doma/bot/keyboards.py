from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)


def main_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Мои дела"), KeyboardButton(text="Все дела дома")],
            [KeyboardButton(text="Добавить дело"), KeyboardButton(text="История")],
            [KeyboardButton(text="Настройки")],
        ],
        resize_keyboard=True,
    )


def start_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Создать дом", callback_data="home:create")],
            [InlineKeyboardButton(text="У меня есть приглашение", callback_data="home:invite_code")],
        ]
    )


def confirm_kb(yes: str, no: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Да", callback_data=yes),
                InlineKeyboardButton(text="Отмена", callback_data=no),
            ]
        ]
    )


def timezone_kb(default: str) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"{default} (предложение)", callback_data=f"tz:{default}")],
        [InlineKeyboardButton(text="Europe/Moscow", callback_data="tz:Europe/Moscow")],
        [InlineKeyboardButton(text="Asia/Yekaterinburg", callback_data="tz:Asia/Yekaterinburg")],
        [InlineKeyboardButton(text="Другой…", callback_data="tz:other")],
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def notify_time_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="09:00 (предложение)", callback_data="ntime:09:00")],
            [InlineKeyboardButton(text="08:00", callback_data="ntime:08:00")],
            [InlineKeyboardButton(text="10:00", callback_data="ntime:10:00")],
            [InlineKeyboardButton(text="Другое…", callback_data="ntime:other")],
        ]
    )


def starter_templates_kb(selected: set[int]) -> InlineKeyboardMarkup:
    from doma.services.templates import STARTER_TEMPLATES

    rows = []
    for i, t in enumerate(STARTER_TEMPLATES):
        mark = "✓ " if i in selected else ""
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"{mark}{t.title} ({t.interval_days}д / {t.duration_minutes}м)",
                    callback_data=f"seed:toggle:{i}",
                )
            ]
        )
    rows.append([InlineKeyboardButton(text="Готово", callback_data="seed:done")])
    rows.append([InlineKeyboardButton(text="Пропустить шаблоны", callback_data="seed:skip")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def occurrence_actions_kb(occurrence_id: int, *, is_assignee: bool) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="Сделано", callback_data=f"occ:done:{occurrence_id}")],
    ]
    if is_assignee:
        rows.append(
            [
                InlineKeyboardButton(text="На завтра", callback_data=f"occ:tomorrow:{occurrence_id}"),
                InlineKeyboardButton(text="Другая дата", callback_data=f"occ:date:{occurrence_id}"),
            ]
        )
        rows.append(
            [
                InlineKeyboardButton(
                    text="Предложить другому", callback_data=f"occ:transfer:{occurrence_id}"
                )
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def offer_kb(offer_id: int, prefix: str = "offer") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Возьму", callback_data=f"{prefix}:yes:{offer_id}"),
                InlineKeyboardButton(text="Не могу", callback_data=f"{prefix}:no:{offer_id}"),
            ]
        ]
    )


def join_invite_kb(token: str) -> InlineKeyboardMarkup:
    # token в callback ограничен ~64 байтами; используем короткий маркер в FSM/памяти
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Присоединиться", callback_data="invite:join")],
            [InlineKeyboardButton(text="Отмена", callback_data="invite:cancel")],
        ]
    )


def settings_kb(*, notifications_on: bool) -> InlineKeyboardMarkup:
    toggle = "Выключить уведомления" if notifications_on else "Включить уведомления"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=toggle, callback_data="settings:notify_toggle")],
            [InlineKeyboardButton(text="Время уведомления", callback_data="settings:notify_time")],
            [InlineKeyboardButton(text="Пригласить / ссылка", callback_data="settings:invite")],
            [InlineKeyboardButton(text="Отозвать приглашения", callback_data="settings:revoke")],
            [InlineKeyboardButton(text="Помоги составить список", callback_data="settings:ai")],
            [InlineKeyboardButton(text="Покинуть дом", callback_data="settings:leave")],
            [InlineKeyboardButton(text="Удалить дом", callback_data="settings:delete_home")],
        ]
    )


def interval_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Ежедневно", callback_data="interval:1")],
            [InlineKeyboardButton(text="Каждые 3 дня", callback_data="interval:3")],
            [InlineKeyboardButton(text="Раз в 7 дней", callback_data="interval:7")],
            [InlineKeyboardButton(text="Раз в 14 дней", callback_data="interval:14")],
            [InlineKeyboardButton(text="Свой интервал", callback_data="interval:custom")],
        ]
    )


def assignee_kb(*, has_partner: bool) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text="Себе", callback_data="assignee:self")]]
    if has_partner:
        rows.append([InlineKeyboardButton(text="Партнёру", callback_data="assignee:partner")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def my_list_nav_kb(*, show_future: bool, offset: int) -> InlineKeyboardMarkup:
    rows = []
    nav = []
    if offset > 0:
        nav.append(InlineKeyboardButton(text="←", callback_data=f"mylist:page:{offset - 10}"))
    nav.append(InlineKeyboardButton(text="→", callback_data=f"mylist:page:{offset + 10}"))
    rows.append(nav)
    if not show_future:
        rows.append(
            [InlineKeyboardButton(text="Будущие дела", callback_data="mylist:future")]
        )
    else:
        rows.append(
            [InlineKeyboardButton(text="Сегодня / просроченные", callback_data="mylist:today")]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def declined_chore_kb(template_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Взять на себя", callback_data=f"declined:take:{template_id}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="Отменить создание", callback_data=f"declined:cancel:{template_id}"
                )
            ],
        ]
    )
