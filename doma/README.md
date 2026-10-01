# «Дома» — семейный Telegram-бот для домашних дел (MVP 0.1)

Рабочее название продукта: **Дома**. Идея: Sweepy-mini.  
Проект лежит в каталоге `doma/`, потому что корень репозитория занят другим приложением (конструктор юрдокументов) — его мы не перезаписывали.

Полное ТЗ: [`TZ.md`](./TZ.md).

## Что реализовано

Основная цепочка: **приглашение → дело → напоминание → выполнение → следующий срок**.

1. Создание дома, часовой пояс (предложение `Europe/Astrakhan` без молчаливого применения), время уведомлений.
2. Приглашение второго человека по одноразовой ссылке `t.me/<bot>?start=<token>` (в БД хранится хеш, TTL 48 ч).
3. Стартовые шаблоны дел и ручное добавление (лимит 20 активных на дом).
4. Согласование назначения второму участнику; передача текущего выполнения с согласием.
5. Выполнение / перенос; следующий срок = локальная дата выполнения + N дней.
6. Ежедневное напоминание (очередь в PostgreSQL, catch-up ≤ 2 часа).
7. История за 7 дней, настройки, выход / удаление дома, `/delete_me`.
8. ИИ-подбор списка (опционально): интерфейс `ChoreSuggestionProvider`, fake-адаптер и openai-compatible HTTP. По умолчанию выключен.
9. CLI-отчёт `doma-report <household_id>` и события аналитики без текстов сообщений.

**Вне MVP (намеренно нет):** биллинг / Telegram Stars, Mini App, несколько домов, «справедливое» автораспределение.

## Стек

- Python 3.12, aiogram 3, SQLAlchemy 2 async + asyncpg, Alembic, Pydantic Settings
- PostgreSQL 17 в Docker Compose (локально для тестов допустим PostgreSQL 16+)
- Зависимости: `uv` + `uv.lock`

## Быстрый старт (локально)

```bash
cd doma
cp .env.example .env
# Укажите BOT_TOKEN от @BotFather
# DATABASE_URL=postgresql+asyncpg://doma:doma@127.0.0.1:5432/doma

uv sync
export DATABASE_URL=postgresql+asyncpg://doma:doma@127.0.0.1:5432/doma
uv run alembic upgrade head
uv run doma
```

Бот работает через **long polling**. Публичный HTTPS-адрес не нужен, нужен исходящий доступ к `api.telegram.org`.

### Конфликт с webhook

Если у токена уже установлен webhook, процесс **не** снимает его сам и завершится с ошибкой в логе. Снимите webhook вручную (Bot API `deleteWebhook`) и перезапустите. Не запускайте два long-polling процесса на один токен.

## Docker Compose (VPS)

```bash
cd doma
cp .env.example .env
# BOT_TOKEN=...  и при желании POSTGRES_PASSWORD=...

docker compose up -d --build
# Миграции — отдельной командой до/при обновлении:
docker compose run --rm bot alembic upgrade head
docker compose up -d bot
```

Порт PostgreSQL **не** публикуется наружу. Данные в volume `doma_pgdata`.

### Обновление версии

1. Снять бэкап (`scripts/backup.sh`).
2. `docker compose build`
3. `docker compose run --rm bot alembic upgrade head`
4. `docker compose up -d bot`

### Резервное копирование

```bash
./scripts/backup.sh ./backups
./scripts/restore.sh ./backups/doma-YYYYMMDD….sql.gz
```

Скрипты готовы; **ежедневное расписание и вывоз копии с сервера владелец настраивает сам** (cron + rsync/S3). Пока cron не настроен — копирование не считается внедрённым.

## ИИ

| Переменная | Смысл |
|---|---|
| `AI_ENABLED` | `false` по умолчанию — шаблоны без имитации «ИИ проанализировал» |
| `AI_PROVIDER` | `fake` или `openai_compatible` |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | задаёт владелец по документации выбранного провайдера |

Модель в код не зашита. Лимит: 3 запроса на дом в сутки, вход ≤ 1000 символов.

## Тесты

Нужен PostgreSQL (не SQLite):

```bash
export TEST_DATABASE_URL=postgresql+asyncpg://doma:doma@127.0.0.1:5432/doma_test
uv run pytest
uv run ruff check src tests
```

Покрыто: даты повторения, приглашения, согласие назначения, complete/postpone/transfer, уникальность открытого выполнения, доступ между домами, очередь уведомлений, отключённый ИИ.

Живой прогон с двумя Telegram-аккаунтами и восстановление бэкапа — по ручному чек-листу, когда есть `BOT_TOKEN` и окружение владельца.

## Аналитика пилота

```bash
uv run doma-report <internal_household_id>
```

События: `house_created`, `invite_created`, `member_joined`, `chore_created`, `assignment_accepted`, `task_completed`, `task_postponed`, `transfer_accepted`, `reminder_sent`, `reminder_failed`, `ai_suggestion_accepted`.

Ориентир пилота (5 семей × 7 дней) и гипотеза 100–150 ₽/мес — вне кода. Оплата Stars — следующий этап, без фиктивного курса.

## Допущения MVP

- Один дом на пользователя, максимум двое взрослых.
- Повтор только «дата выполнения + N дней».
- FSM диалогов в памяти: после рестарта пользователя просят повторить незавершённый ввод; подтверждённые данные — в БД.
- Редкий дубль ежедневного сообщения возможен при обрыве после sendMessage до записи статуса (ограничение Telegram API).
- Поддерживаемые TZ: см. `SUPPORTED_TIMEZONES` в `src/doma/services/timeutil.py`.

## Что должен добавить владелец

1. `BOT_TOKEN`
2. При необходимости — `AI_*` после выбора провайдера
3. Секреты в `.env` / окружении VPS (не в git)
4. Cron бэкапов и хранение вне сервера
5. Ручной чек-лист с двумя аккаунтами
