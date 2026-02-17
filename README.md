# Servaster

Загружает конфигурацию VoIP диалплана (dialplan) с Cloudflare Workers/KV и конвертирует в формат Asterisk.

## Архитектура

```
┌──────────────┐        HTTP         ┌──────────────────┐       ┌──────────────┐
│  Client      │  ─── GET/PUT ────►  │ Cloudflare Worker │ ◄──► │ Cloudflare   │
│  (Node.js)   │                     │                  │       │ KV Store     │
└──────────────┘                     └──────────────────┘       └──────────────┘
```

- **Cloudflare Worker** (`worker/index.ts`) — API для хранения и раздачи диалпланов через KV
- **Client** (`src/`) — Node.js сервис, который периодически загружает диалплан и генерирует Asterisk-конфиг
- **Типы** (`src/types/`) — общие TypeScript-интерфейсы

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Отредактируйте .env при необходимости
```

### 3. Запустить Worker локально

```bash
npm run worker:dev
```

### 4. Загрузить тестовый диалплан

```bash
npm run worker:kv:seed
```

### 5. Запустить клиент

```bash
npm run dev
```

## API Worker'а

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/dialplan/:serverId` | Получить диалплан сервера |
| `PUT` | `/dialplan/:serverId` | Обновить диалплан (требует auth) |
| `GET` | `/health` | Проверка состояния |

### Пример ответа

```json
{
  "success": true,
  "data": {
    "id": "server-1",
    "name": "Main Office Dialplan",
    "version": 1,
    "updatedAt": "2026-02-17T12:00:00.000Z",
    "contexts": [
      {
        "name": "internal",
        "extensions": [
          { "pattern": "100", "priority": 1, "application": "Dial", "args": "SIP/100,30" }
        ]
      }
    ]
  }
}
```

## Деплой на Cloudflare

1. Создайте KV namespace:
   ```bash
   npx wrangler kv namespace create DIALPLAN_KV
   ```

2. Обновите `wrangler.toml` с полученным KV namespace ID

3. Задеплойте Worker:
   ```bash
   npm run worker:deploy
   ```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run build` | Скомпилировать TypeScript |
| `npm run dev` | Запустить клиент в dev-режиме |
| `npm start` | Запустить скомпилированный клиент |
| `npm run worker:dev` | Запустить Worker локально |
| `npm run worker:deploy` | Задеплоить Worker на Cloudflare |
| `npm run worker:kv:seed` | Загрузить тестовый диалплан |

## Структура проекта

```
servaster/
├── src/
│   ├── index.ts              # Точка входа клиента
│   ├── client/
│   │   └── dialplan-client.ts # HTTP клиент для Worker API
│   ├── types/
│   │   ├── index.ts           # Реэкспорт типов
│   │   └── dialplan.ts        # Интерфейсы Dialplan, Context, Extension
│   └── utils/
│       └── formatter.ts       # Конвертация в Asterisk-формат
├── worker/
│   └── index.ts               # Cloudflare Worker
├── scripts/
│   └── seed-kv.ts             # Скрипт загрузки тестовых данных
├── wrangler.toml               # Конфигурация Wrangler
├── tsconfig.json               # TypeScript для клиента
├── tsconfig.worker.json        # TypeScript для Worker
└── package.json
```
