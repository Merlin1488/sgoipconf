# Servaster

Централизованное управление конфигами Asterisk через Cloudflare.  
Конфиги хранятся в Cloudflare KV, раздаются через Worker API, серверы забирают их автоматически.

**Продакшн:** `https://config.sgoip.com`

## Как это работает

```
┌─────────────────┐                    ┌──────────────────────┐
│  Asterisk       │   poll каждые 30s  │  Cloudflare Worker   │
│  сервер         │ ◄──── GET ───────  │  config.sgoip.com    │
│                 │                    │         │            │
│  servaster.js   │                    │         ▼            │
│  ─────────────  │                    │  ┌────────────────┐  │
│  пишет .conf    │                    │  │  Cloudflare KV │  │
│  файлы на диск  │                    │  └────────────────┘  │
└─────────────────┘                    └──────────────────────┘
        ▲
        │ При обновлении:
        │ extensions.conf
        │ sip.conf
        │ voicemail.conf
        │ ...любые .conf
```

1. Ты заливаешь конфиги в Cloudflare (через API или скрипт)
2. Назначаешь какому серверу какие конфиги отдавать
3. Бинарник на сервере тихо поллит и пишет обновления на диск
4. Нет обновлений — молчит

---

## Быстрый старт

### 1. Залить конфиги с существующего сервера

```bash
# Все .conf файлы из /etc/asterisk → Cloudflare
./scripts/upload-configs.sh pbx-01 ТОКЕН /etc/asterisk https://config.sgoip.com
```

Скрипт автоматически:
- Читает все `*.conf` из указанной директории
- Загружает каждый как отдельный конфиг
- Назначает все загруженные конфиги серверу

### 2. Запустить бинарник на сервере

```bash
# Собрать
npm run bundle

# Скопировать dist/servaster.js на сервер и запустить
AUTH_TOKEN=ТОКЕН \
WORKER_URL=https://config.sgoip.com \
SERVER_ID=pbx-01 \
OUTPUT_DIR=/etc/asterisk \
POLL_INTERVAL=30 \
node servaster.js
```

---

## API

Все эндпоинты (кроме `/health`) требуют заголовок `Authorization: Bearer ТОКЕН`.

### Конфиги

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/config/:serverId` | Все назначенные конфиги сервера (bundle) |
| `GET` | `/config/:serverId/:type` | Один конфиг |
| `PUT` | `/config/:serverId/:type` | Создать/обновить конфиг |

### Назначения

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/assignment/:serverId` | Какие конфиги назначены серверу |
| `PUT` | `/assignment/:serverId` | Назначить конфиги серверу |

### Сервис

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/health` | Health check (без авторизации) |

### Примеры

**Залить конфиг:**
```bash
curl -X PUT https://config.sgoip.com/config/pbx-01/extensions \
  -H "Authorization: Bearer ТОКЕН" \
  -H "Content-Type: application/json" \
  -d '{"content": "[internal]\nexten => 100,1,Dial(SIP/100,30)\n"}'
```

**Назначить конфиги серверу:**
```bash
curl -X PUT https://config.sgoip.com/assignment/pbx-01 \
  -H "Authorization: Bearer ТОКЕН" \
  -H "Content-Type: application/json" \
  -d '{"configs": ["extensions", "sip", "voicemail", "queues"]}'
```

**Получить все конфиги сервера:**
```bash
curl https://config.sgoip.com/config/pbx-01 \
  -H "Authorization: Bearer ТОКЕН"
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "serverId": "pbx-01",
    "configs": [
      {
        "type": "extensions",
        "version": 3,
        "updatedAt": "2026-02-17T12:00:00.000Z",
        "content": "[internal]\nexten => 100,1,Dial(SIP/100,30)\n"
      },
      {
        "type": "sip",
        "version": 1,
        "updatedAt": "2026-02-17T11:30:00.000Z",
        "content": "[general]\ncontext=internal\n..."
      }
    ]
  }
}
```

---

## Переменные окружения (клиент)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `AUTH_TOKEN` | *обязательно* | Токен авторизации |
| `WORKER_URL` | `http://localhost:8787` | URL Worker'а |
| `SERVER_ID` | `server-1` | ID сервера |
| `POLL_INTERVAL` | `30` | Интервал опроса (секунды) |
| `OUTPUT_DIR` | `/etc/asterisk` | Куда писать .conf файлы |

---

## Установка на сервер

### Требования

- Node.js 20+ (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`)

### 1. Скопировать бинарник

```bash
sudo mkdir -p /opt/servaster
# скопировать dist/servaster.js на сервер:
scp dist/servaster.js root@ваш-сервер:/opt/servaster/servaster.js
```

### 2. Создать systemd сервис

```bash
sudo cat > /etc/systemd/system/servaster.service << 'EOF'
[Unit]
Description=Servaster — Asterisk config puller
After=network.target

[Service]
Type=simple
Environment=AUTH_TOKEN=ваш-токен
Environment=WORKER_URL=https://config.sgoip.com
Environment=SERVER_ID=pbx-01
Environment=OUTPUT_DIR=/etc/asterisk
Environment=POLL_INTERVAL=30
ExecStart=/usr/bin/node /opt/servaster/servaster.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

> **SERVER_ID** — уникальное имя сервера (например `pbx-01`, `pbx-moscow`, `sip-backup`)  
> **AUTH_TOKEN** — токен, который задан в Cloudflare Worker

### 3. Запустить

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now servaster
```

### 4. Проверить

```bash
# Статус
sudo systemctl status servaster

# Логи в реалтайме
sudo journalctl -u servaster -f
```

Если конфиги назначены — увидишь:
```
[servaster] polling https://config.sgoip.com every 30s (server: pbx-01)
[servaster] output dir: /etc/asterisk
[servaster] extensions v1 -> /etc/asterisk/extensions.conf
[servaster] sip v1 -> /etc/asterisk/sip.conf
```

Если ничего не обновилось — тишина (так и должно быть).

### 5. Обновить бинарник

```bash
scp dist/servaster.js root@ваш-сервер:/opt/servaster/servaster.js
ssh root@ваш-сервер systemctl restart servaster
```

---

## Установка одной командой

Скопируй и запусти на сервере (замени переменные):

```bash
SERVER_ID="pbx-01"
AUTH_TOKEN="ваш-токен"

sudo mkdir -p /opt/servaster
curl -sL https://raw.githubusercontent.com/Merlin1488/sgoipconf/main/dist/servaster.js -o /opt/servaster/servaster.js

sudo tee /etc/systemd/system/servaster.service > /dev/null << EOF
[Unit]
Description=Servaster
After=network.target
[Service]
Type=simple
Environment=AUTH_TOKEN=$AUTH_TOKEN
Environment=WORKER_URL=https://config.sgoip.com
Environment=SERVER_ID=$SERVER_ID
Environment=OUTPUT_DIR=/etc/asterisk
Environment=POLL_INTERVAL=30
ExecStart=/usr/bin/node /opt/servaster/servaster.js
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now servaster
sudo journalctl -u servaster -f
```

---

## Деплой Worker'а

### Автоматически (GitHub Actions)

При пуше в `main` (если изменились `worker/`, `src/types/` или `wrangler.toml`) — Worker автоматически деплоится.

**Секреты GitHub** (`Settings → Secrets → Actions`):
- `CLOUDFLARE_API_TOKEN` — API токен Cloudflare
- `CLOUDFLARE_ACCOUNT_ID` — ID аккаунта Cloudflare

### Вручную

```bash
npm run worker:deploy
npx wrangler secret put AUTH_TOKEN
```

---

## Разработка

```bash
npm install                  # зависимости
npm run worker:dev           # Worker локально на :8787
npm run worker:kv:seed       # тестовые данные
npm run dev                  # клиент в dev-режиме
npm run build                # TypeScript компиляция
npm run bundle               # сборка бинарника dist/servaster.js
```

---

## Структура проекта

```
servaster/
├── src/
│   ├── index.ts                # Точка входа клиента (поллинг + запись на диск)
│   ├── client/
│   │   └── dialplan-client.ts  # HTTP клиент для Worker API
│   ├── types/
│   │   ├── index.ts            # Реэкспорт типов
│   │   └── dialplan.ts         # ConfigEntry, ServerAssignment, ServerBundle
│   └── utils/
│       └── formatter.ts        # Утилиты форматирования
├── worker/
│   └── index.ts                # Cloudflare Worker (API)
├── scripts/
│   ├── upload-configs.sh       # Заливка всех .conf файлов в Cloudflare
│   └── seed-kv.ts              # Тестовые данные
├── dist/
│   └── servaster.js            # Собранный бинарник (esbuild)
├── .github/
│   └── workflows/
│       └── deploy-worker.yml   # CI/CD деплой Worker'а
├── wrangler.toml               # Конфигурация Cloudflare Worker
├── tsconfig.json               # TypeScript (клиент)
├── tsconfig.worker.json        # TypeScript (Worker)
└── package.json
```
