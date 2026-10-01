from datetime import date, time

import pytest
from sqlalchemy import select

from doma.db.models import OccurrenceStatus, TaskOccurrence
from doma.services import chore as chore_service
from doma.services import household as household_service
from doma.services import invitation as invitation_service
from doma.services import task as task_service
from doma.services.access import get_or_create_user


async def _two_users(session):
    a = await get_or_create_user(session, 1001, "Алиса")
    b = await get_or_create_user(session, 1002, "Борис")
    return a, b


@pytest.mark.asyncio
async def test_create_house_and_invite_flow(session):
    a, b = await _two_users(session)
    result = await household_service.create_household(
        session, user=a, name="Тест", timezone="Europe/Astrakhan", notification_time=time(9, 0)
    )
    inv = await invitation_service.create_invitation(
        session, household=result.household, created_by=a
    )
    preview = await invitation_service.preview_invitation(session, inv.raw_token)
    assert preview.household_name == "Тест"

    membership = await invitation_service.accept_invitation(
        session, raw_token=inv.raw_token, user=b
    )
    assert membership.household_id == result.household.id

    # Повторное использование
    with pytest.raises(invitation_service.InvitationError) as exc:
        await invitation_service.accept_invitation(session, raw_token=inv.raw_token, user=b)
    assert exc.value.code == "already_used"

    # Третий не вступает: новое приглашение в полный дом нельзя создать
    c = await get_or_create_user(session, 1003, "Кира")
    with pytest.raises(invitation_service.InvitationError) as exc2:
        await invitation_service.create_invitation(
            session, household=result.household, created_by=a
        )
    assert exc2.value.code == "household_full"
    _ = c


@pytest.mark.asyncio
async def test_complete_creates_one_next_cycle(session):
    a, _ = await _two_users(session)
    hh = await household_service.create_household(
        session, user=a, name="Дом", timezone="Europe/Astrakhan"
    )
    created = await chore_service.create_chore(
        session,
        household_id=hh.household.id,
        created_by=a,
        title="Мусор",
        interval_days=7,
        duration_minutes=3,
        first_due_date=date(2026, 10, 1),
        assignee=a,
    )
    assert created.occurrence is not None

    result = await task_service.complete_occurrence(
        session,
        occurrence_id=created.occurrence.id,
        actor=a,
        household_timezone="Europe/Astrakhan",
        completed_local_date=date(2026, 10, 3),
    )
    assert result.completed.status == OccurrenceStatus.completed
    assert result.next_occurrence.due_date == date(2026, 10, 10)

    # Повторный complete того же id
    with pytest.raises(task_service.TaskError) as exc:
        await task_service.complete_occurrence(
            session,
            occurrence_id=created.occurrence.id,
            actor=a,
            household_timezone="Europe/Astrakhan",
            completed_local_date=date(2026, 10, 3),
        )
    assert exc.value.code == "already_closed"

    # Ровно одно открытое
    opens = (
        await session.execute(
            select(TaskOccurrence).where(
                TaskOccurrence.template_id == created.template.id,
                TaskOccurrence.status == OccurrenceStatus.open,
            )
        )
    ).scalars().all()
    assert len(opens) == 1


@pytest.mark.asyncio
async def test_postpone_does_not_count_as_completion(session):
    a, _ = await _two_users(session)
    hh = await household_service.create_household(
        session, user=a, name="Дом", timezone="Europe/Astrakhan"
    )
    created = await chore_service.create_chore(
        session,
        household_id=hh.household.id,
        created_by=a,
        title="Стол",
        interval_days=7,
        duration_minutes=5,
        first_due_date=date(2026, 10, 1),
        assignee=a,
    )
    await task_service.postpone_occurrence(
        session,
        occurrence_id=created.occurrence.id,
        actor=a,
        new_due_date=date(2026, 10, 2),
        household_timezone="Europe/Astrakhan",
    )
    result = await task_service.complete_occurrence(
        session,
        occurrence_id=created.occurrence.id,
        actor=a,
        household_timezone="Europe/Astrakhan",
        completed_local_date=date(2026, 10, 2),
    )
    assert result.next_occurrence.due_date == date(2026, 10, 9)


@pytest.mark.asyncio
async def test_assignment_requires_consent(session):
    a, b = await _two_users(session)
    hh = await household_service.create_household(
        session, user=a, name="Дом", timezone="Europe/Astrakhan"
    )
    inv = await invitation_service.create_invitation(
        session, household=hh.household, created_by=a
    )
    await invitation_service.accept_invitation(session, raw_token=inv.raw_token, user=b)

    created = await chore_service.create_chore(
        session,
        household_id=hh.household.id,
        created_by=a,
        title="Полы",
        interval_days=7,
        duration_minutes=25,
        first_due_date=date(2026, 10, 1),
        assignee=b,
    )
    assert created.needs_acceptance
    assert created.occurrence is None
    assert created.template.assignee_user_id is None

    await chore_service.decline_chore_assignment(
        session, offer_id=created.offer.id, user=b
    )
    # Исполнитель не изменился молча
    assert created.template.assignee_user_id is None

    # Автор берёт на себя
    await chore_service.take_declined_chore(
        session, template_id=created.template.id, user=a
    )
    await session.refresh(created.template)
    assert created.template.assignee_user_id == a.id


@pytest.mark.asyncio
async def test_transfer_keeps_template_assignee(session):
    a, b = await _two_users(session)
    hh = await household_service.create_household(
        session, user=a, name="Дом", timezone="Europe/Astrakhan"
    )
    inv = await invitation_service.create_invitation(
        session, household=hh.household, created_by=a
    )
    await invitation_service.accept_invitation(session, raw_token=inv.raw_token, user=b)

    created = await chore_service.create_chore(
        session,
        household_id=hh.household.id,
        created_by=a,
        title="Раковина",
        interval_days=2,
        duration_minutes=5,
        first_due_date=date(2026, 10, 1),
        assignee=a,
    )
    offer = await task_service.propose_transfer(
        session, occurrence_id=created.occurrence.id, actor=a, recipient=b
    )
    occ = await task_service.accept_transfer(session, offer_id=offer.id, user=b)
    assert occ.assignee_user_id == b.id
    await session.refresh(created.template)
    assert created.template.assignee_user_id == a.id  # шаблон не меняется


@pytest.mark.asyncio
async def test_cross_household_access_denied(session):
    from doma.services.access import AccessError, require_occurrence_access

    a, b = await _two_users(session)
    hh1 = await household_service.create_household(
        session, user=a, name="ДомА", timezone="Europe/Astrakhan"
    )
    c = await get_or_create_user(session, 1003, "Кира")
    hh2 = await household_service.create_household(
        session, user=c, name="ДомБ", timezone="Europe/Moscow"
    )
    created = await chore_service.create_chore(
        session,
        household_id=hh1.household.id,
        created_by=a,
        title="Секрет",
        interval_days=1,
        duration_minutes=5,
        first_due_date=date(2026, 10, 1),
        assignee=a,
    )
    # b не в доме — сначала добавим b в другой дом нельзя (один дом), b без дома
    with pytest.raises(AccessError):
        await require_occurrence_access(session, b.id, created.occurrence.id)

    # c в другом доме
    with pytest.raises(AccessError):
        await require_occurrence_access(session, c.id, created.occurrence.id)
    _ = hh2


@pytest.mark.asyncio
async def test_unique_open_occurrence_constraint(session, session_factory):
    a, _ = await _two_users(session)
    hh = await household_service.create_household(
        session, user=a, name="Дом", timezone="Europe/Astrakhan"
    )
    created = await chore_service.create_chore(
        session,
        household_id=hh.household.id,
        created_by=a,
        title="Мусор",
        interval_days=1,
        duration_minutes=3,
        first_due_date=date(2026, 10, 1),
        assignee=a,
    )
    await session.commit()

    # Попытка вставить второе открытое
    from sqlalchemy.exc import IntegrityError

    async with session_factory() as s2:
        s2.add(
            TaskOccurrence(
                template_id=created.template.id,
                due_date=date(2026, 10, 2),
                assignee_user_id=a.id,
                status=OccurrenceStatus.open,
            )
        )
        with pytest.raises(IntegrityError):
            await s2.commit()
