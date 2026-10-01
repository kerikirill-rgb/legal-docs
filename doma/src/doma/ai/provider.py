from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel, Field, field_validator


class SuggestedChore(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    interval_days: int = Field(ge=1, le=365)
    duration_minutes: int = Field(ge=1, le=180)
    room: str | None = Field(default=None, max_length=50)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty title")
        return v


class SuggestionResponse(BaseModel):
    chores: list[SuggestedChore] = Field(min_length=1, max_length=10)


@dataclass
class SuggestionRequest:
    description: str


class ChoreSuggestionProvider(ABC):
    @abstractmethod
    async def suggest(self, request: SuggestionRequest) -> SuggestionResponse:
        raise NotImplementedError


class FakeChoreSuggestionProvider(ChoreSuggestionProvider):
    """Детерминированный адаптер для тестов и режима без ключа ИИ."""

    async def suggest(self, request: SuggestionRequest) -> SuggestionResponse:
        _ = request
        return SuggestionResponse(
            chores=[
                SuggestedChore(title="Вынести мусор", interval_days=2, duration_minutes=3),
                SuggestedChore(
                    title="Пропылесосить", interval_days=7, duration_minutes=20, room="Общее"
                ),
                SuggestedChore(title="Протереть поверхности", interval_days=3, duration_minutes=10),
                SuggestedChore(
                    title="Помыть раковину", interval_days=2, duration_minutes=5, room="Кухня"
                ),
                SuggestedChore(title="Полить растения", interval_days=3, duration_minutes=5),
            ]
        )


class OpenAICompatibleProvider(ChoreSuggestionProvider):
    """OpenAI-совместимый HTTP API. Модель и URL задаёт владелец через env."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float = 30,
    ) -> None:
        if not api_key or not model:
            raise ValueError("ai_not_configured")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def suggest(self, request: SuggestionRequest) -> SuggestionResponse:
        import json

        import httpx

        system = (
            "Ты помощник по домашним делам. Верни ТОЛЬКО JSON вида "
            '{"chores":[{"title":"...","interval_days":N,"duration_minutes":M,"room":null|str}]} '
            "от 5 до 10 дел. Без комментариев."
        )
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": request.description[:1000]},
            ],
            "temperature": 0.4,
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        content = data["choices"][0]["message"]["content"]
        # Вырезать возможный markdown fence
        text = content.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        parsed = json.loads(text)
        return SuggestionResponse.model_validate(parsed)


def build_provider(
    *,
    enabled: bool,
    provider: str,
    api_key: str,
    base_url: str,
    model: str,
    timeout_seconds: int,
) -> ChoreSuggestionProvider | None:
    if not enabled:
        return None
    if provider == "fake":
        return FakeChoreSuggestionProvider()
    if provider == "openai_compatible":
        if not api_key or not model:
            return None
        return OpenAICompatibleProvider(
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout_seconds=timeout_seconds,
        )
    return None
