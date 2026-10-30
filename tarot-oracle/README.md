# tarot-oracle

Telegram-бот таролог на [Agent SDK](https://cursor.com/docs/bdk): расклады на реальных картах, память истории, freemium и оплата (Telegram Stars, ₽, USDT).

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Токен @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token для webhook (рекомендуется) |
| `PAYMENT_WEBHOOK_SECRET` | Bearer для `POST .../channels/payments/confirm` |
| `YOOKASSA_SHOP_ID` | Опционально: ссылка на оплату в рублях |
| `CRYPTO_USDT_WALLET` | Адрес USDT TRC20 для криpto-заказов |

## Telegram webhook

После деплоя:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-agent>/tarot-oracle/v1/channels/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Локально

```bash
cd tarot-oracle
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk dev
```

## Тарифы (по умолчанию)

- 2 мини-расклада в неделю бесплатно
- Подписка «Оракул» — безлимит стандартных/глубоких раскладов
- Полный астро-таро — расклад `astro_houses`
- Квартальное сопровождение — все опции + коучинг-тон в инструкциях
