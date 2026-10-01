from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    bot_token: str = Field(default="", alias="BOT_TOKEN")
    database_url: str = Field(
        default="postgresql+asyncpg://doma:doma@localhost:5432/doma",
        alias="DATABASE_URL",
    )
    default_timezone: str = Field(default="Europe/Astrakhan", alias="DEFAULT_TIMEZONE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    ai_enabled: bool = Field(default=False, alias="AI_ENABLED")
    ai_provider: str = Field(default="fake", alias="AI_PROVIDER")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://api.openai.com/v1", alias="AI_BASE_URL")
    ai_model: str = Field(default="", alias="AI_MODEL")
    ai_timeout_seconds: int = Field(default=30, alias="AI_TIMEOUT_SECONDS")
    ai_max_requests_per_household_per_day: int = Field(
        default=3, alias="AI_MAX_REQUESTS_PER_HOUSEHOLD_PER_DAY"
    )

    # Лимиты MVP
    max_active_chores_per_household: int = 20
    invitation_ttl_hours: int = 48
    transfer_offer_ttl_hours: int = 24
    reminder_catchup_hours: int = 2
    history_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
