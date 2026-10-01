import enum
from datetime import date, datetime, time

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from doma.db.base import Base, TimestampMixin


class ChoreStatus(enum.StrEnum):
    pending_acceptance = "pending_acceptance"
    active = "active"
    archived = "archived"


class OccurrenceStatus(enum.StrEnum):
    open = "open"
    completed = "completed"
    cancelled = "cancelled"


class OfferType(enum.StrEnum):
    chore_assignment = "chore_assignment"
    task_transfer = "task_transfer"


class OfferStatus(enum.StrEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    expired = "expired"
    cancelled = "cancelled"


class NotificationType(enum.StrEnum):
    daily_summary = "daily_summary"


class NotificationStatus(enum.StrEnum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_time: Mapped[time] = mapped_column(Time, default=time(9, 0), nullable=False)
    notifications_paused_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    bot_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    membership: Mapped["Membership | None"] = relationship(
        back_populates="user", uselist=False
    )


class Household(Base, TimestampMixin):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    memberships: Mapped[list["Membership"]] = relationship(back_populates="household")
    chores: Mapped[list["ChoreTemplate"]] = relationship(back_populates="household")


class Membership(Base, TimestampMixin):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_memberships_user_id"),
        UniqueConstraint("household_id", "user_id", name="uq_memberships_household_user"),
        Index("ix_memberships_household_id", "household_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    household: Mapped[Household] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="membership")


class Invitation(Base, TimestampMixin):
    __tablename__ = "invitations"
    __table_args__ = (Index("ix_invitations_token_hash", "token_hash", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    redeemed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class ChoreTemplate(Base, TimestampMixin):
    __tablename__ = "chore_templates"
    __table_args__ = (Index("ix_chore_templates_household_id", "household_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    assignee_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[ChoreStatus] = mapped_column(
        Enum(ChoreStatus, name="chore_status"),
        nullable=False,
        default=ChoreStatus.active,
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    first_due_date: Mapped[date] = mapped_column(Date, nullable=False)

    household: Mapped[Household] = relationship(back_populates="chores")
    occurrences: Mapped[list["TaskOccurrence"]] = relationship(back_populates="template")


class TaskOccurrence(Base, TimestampMixin):
    __tablename__ = "task_occurrences"
    __table_args__ = (
        Index("ix_task_occurrences_template_id", "template_id"),
        Index("ix_task_occurrences_assignee_due", "assignee_user_id", "due_date"),
        # Одно открытое выполнение на шаблон
        Index(
            "uq_task_occurrences_one_open",
            "template_id",
            unique=True,
            postgresql_where=text("status = 'open'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("chore_templates.id", ondelete="CASCADE"), nullable=False
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    assignee_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[OccurrenceStatus] = mapped_column(
        Enum(OccurrenceStatus, name="occurrence_status"),
        nullable=False,
        default=OccurrenceStatus.open,
    )
    completed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    template: Mapped[ChoreTemplate] = relationship(back_populates="occurrences")


class AssignmentOffer(Base, TimestampMixin):
    __tablename__ = "assignment_offers"
    __table_args__ = (
        Index("ix_assignment_offers_recipient", "recipient_user_id", "status"),
        # Одно открытое предложение на выполнение (для transfer)
        Index(
            "uq_assignment_offers_one_pending_occurrence",
            "occurrence_id",
            unique=True,
            postgresql_where=text(
                "status = 'pending' AND offer_type = 'task_transfer' AND occurrence_id IS NOT NULL"
            ),
        ),
        Index(
            "uq_assignment_offers_one_pending_template",
            "template_id",
            unique=True,
            postgresql_where=text(
                "status = 'pending' AND offer_type = 'chore_assignment' "
                "AND template_id IS NOT NULL"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    offer_type: Mapped[OfferType] = mapped_column(
        Enum(OfferType, name="offer_type"), nullable=False
    )
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("chore_templates.id", ondelete="CASCADE"), nullable=True
    )
    occurrence_id: Mapped[int | None] = mapped_column(
        ForeignKey("task_occurrences.id", ondelete="CASCADE"), nullable=True
    )
    initiator_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[OfferStatus] = mapped_column(
        Enum(OfferStatus, name="offer_status"),
        nullable=False,
        default=OfferStatus.pending,
    )


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("unique_key", name="uq_notifications_unique_key"),
        Index("ix_notifications_status_scheduled", "status", "scheduled_for"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    household_id: Mapped[int | None] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"), nullable=False
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unique_key: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notification_status"),
        nullable=False,
        default=NotificationStatus.pending,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload_summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_household_created", "household_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    household_id: Mapped[int | None] = mapped_column(
        ForeignKey("households.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )


class AiUsage(Base):
    """Счётчик ИИ-запросов по дому и локальной дате."""

    __tablename__ = "ai_usage"
    __table_args__ = (
        UniqueConstraint("household_id", "local_date", name="uq_ai_usage_household_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
