# Локальная проверка Drive Calls

## Быстрый старт на компьютере (Chrome / Safari)

```bash
cd drive-calls
npm run install:all    # один раз
cp api/.env.example api/.env   # Bitrix можно не заполнять — включится демо-режим CRM
cp mobile/.env.example mobile/.env
npm run dev
```

Откройте в браузере: **http://localhost:8081**

### Сценарий проверки (5–7 минут)

1. **«Демо-список (3 контакта)»** — загружает тестовую очередь.
2. **«Позвонить»** — на компе это **симуляция** (нет реального `tel:`), экран «на линии» с ФИО.
3. **«Завершил разговор»** → **«Подставить пример расшифровки»** → **«Разобрать AI»** (нужен запущенный API на :8787).
4. **«Отправить в Битрикс»** — без webhook в `.env` API вернёт **демо-ответ** (ничего не уйдёт в CRM).
5. **«К следующему — N сек»** → таймер, **СТОП**, **«Дальше сейчас»** → следующий «звонок».

API health: http://localhost:8787/health

---

## iPhone: Safari (веб-версия, та же Wi‑Fi)

На Mac/PC узнайте IP в LAN (например `192.168.1.10`).

1. В `mobile/.env`:

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.10:8787
   EXPO_PUBLIC_COUNTDOWN_SEC=5
   ```

2. Запуск с доступом по сети:

   ```bash
   cd drive-calls
   npm run dev:lan
   ```

3. На iPhone в **Safari** откройте: **http://192.168.1.10:8081**  
   (порт **8081** — веб-сервер Expo; **8787** — API.)

4. **Реальный звонок:** кнопка «Позвонить» откроет набор iOS (`tel:`). Остальной сценарий как на компе.

Если страница не открывается — проверьте firewall на компе (разрешить 8081 и 8787 в LAN).

### Альтернатива: туннель (не в одной Wi‑Fi)

```bash
npm run dev:tunnel
```

Expo покажет **HTTPS URL** для веба — откройте его на iPhone.  
API для телефона тогда тоже нужен снаружи (ngrok на :8787 или деплой API на VPS) и `EXPO_PUBLIC_API_URL` на этот адрес.

---

## iPhone: Expo Go (ближе к «настоящему» приложению)

```bash
cd drive-calls/mobile
npx expo start
```

Отсканируйте QR в **Expo Go**. В `.env` укажите `EXPO_PUBLIC_API_URL` на IP компа в Wi‑Fi (`http://192.168.x.x:8787`).

Голос «СТОП» на countdown — в Expo Go может работать; в Safari — через Web Speech API (Chrome лучше, Safari ограниченнее).

---

## Битрикс по-настоящему

В `api/.env`:

```
BITRIX_WEBHOOK_URL=https://ваш.bitrix24.ru/rest/1/секрет
BITRIX_LEAD_STAGE_ID=NEW
```

Перезапустите `npm run dev`. Кнопка «Отправить в Битрикс» пойдёт в портал.

---

## Частые проблемы

| Симптом | Решение |
|--------|---------|
| «Analyze failed» / network | API не запущен или неверный `EXPO_PUBLIC_API_URL` |
| С iPhone не видит API | Используйте IP LAN, не `localhost` |
| CORS | API уже с `cors()` — обращайтесь по HTTP к тому же хосту, что прописан в env |
