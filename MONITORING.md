# Monitoring Stack (Prometheus + Grafana + Alerts)

This project exposes a Prometheus metrics endpoint at `GET /metrics` and includes a Docker-based monitoring stack under `deploy/monitoring/`:

- Prometheus (scrapes metrics + evaluates alert rules)
- Grafana (dashboards)
- Alertmanager (routes alerts)
- Notifier (forwards alerts to Discord/Telegram)

## 1) Start the app

Run the dashboard (metrics will be on the same port):

```bash
npm install
npm start
```

Verify:

```bash
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/metrics | head
```

## 2) Start Prometheus + Grafana + Alerting

From the repo root:

```bash
cd deploy/monitoring
cp .env.example .env
docker compose up -d --build
```

Open:

- Grafana: `http://localhost:3000` (admin/admin)
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`

## 3) Discord / Telegram alerts (optional)

Edit `deploy/monitoring/.env`:

- `DISCORD_WEBHOOK_URL`: Discord channel webhook URL
- `TELEGRAM_BOT_TOKEN`: token from BotFather
- `TELEGRAM_CHAT_ID`: your chat/channel id

Then restart the notifier:

```bash
cd deploy/monitoring
docker compose up -d --build notifier
```

## Notes

- Prometheus is configured to scrape `host.docker.internal:8000` by default (works on macOS/Windows when the app runs on your host).
- On Linux, replace that in `deploy/monitoring/prometheus/prometheus.yml` with your server’s reachable address (often the host IP or `localhost` if Prometheus runs on-host).

## Non-Docker server setup (only port 8000 exposed)

If your environment only exposes port 8000 externally (no extra ports for Grafana/Prometheus), you can still get **Telegram alerts** without running Docker at all.

### 1) Create a bot + chat id

- Create bot: talk to `@BotFather` → `/newbot` → copy token.
- Get chat id:
  - Open your bot chat → press Start → send `hi`
  - Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
  - Copy `message.chat.id`

### 2) Start the server with Telegram alerts enabled

Run on the required port:

```bash
PORT=8000 \
TELEGRAM_ALERTS_ENABLED=true \
TELEGRAM_BOT_TOKEN="<token>" \
TELEGRAM_CHAT_ID="<chat_id>" \
npm start
```

### 3) Optional tuning (env vars)

- `ALERT_INTERVAL_MS` (default 30000): how often we sample system telemetry
- `ALERT_CONSECUTIVE_SAMPLES` (default 3): samples above threshold before firing
- `ALERT_REPEAT_MS` (default 3600000): reminder interval while firing
- `ALERT_CPU_THRESHOLD` (default 90)
- `ALERT_MEMORY_THRESHOLD` (default 90)
- `ALERT_DISK_THRESHOLD` (default 90)
