from aiogram.fsm.state import State, StatesGroup


class CreateHomeStates(StatesGroup):
    name = State()
    timezone_other = State()
    notify_other = State()
    seeds = State()


class InviteStates(StatesGroup):
    wait_token = State()
    confirm = State()


class AddChoreStates(StatesGroup):
    title = State()
    interval = State()
    interval_custom = State()
    duration = State()
    due = State()
    assignee = State()
    room = State()


class PostponeStates(StatesGroup):
    wait_date = State()


class AiStates(StatesGroup):
    confirm_privacy = State()
    wait_description = State()
    review = State()


class SettingsStates(StatesGroup):
    notify_time = State()
    confirm_leave = State()
    confirm_delete = State()
