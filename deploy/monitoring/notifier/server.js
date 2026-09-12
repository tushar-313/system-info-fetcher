const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT) || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function formatAlert(alert) {
  const status = alert.status || 'unknown';
  const labels = alert.labels || {};
  const annotations = alert.annotations || {};

  const name = labels.alertname || 'Alert';
  const severity = labels.severity || 'n/a';
  const summary = annotations.summary || '';
  const description = annotations.description || '';
  const instance = labels.instance || labels.job || '';

  const lines = [
    `${status.toUpperCase()}: ${name} (severity: ${severity})`,
    instance ? `Target: ${instance}` : null,
    summary ? `Summary: ${summary}` : null,
    description ? `Details: ${description}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

async function postDiscord(message) {
  if (!DISCORD_WEBHOOK_URL) return;
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message.slice(0, 1900) }),
  });
}

async function postTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message.slice(0, 3900),
      disable_web_page_preview: true,
    }),
  });
}

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'sysinfo-notifier' });
});

app.post('/alertmanager', async (req, res) => {
  try {
    const payload = req.body || {};
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

    if (!alerts.length) {
      res.status(204).end();
      return;
    }

    const messages = alerts.map(formatAlert);
    const message = messages.join('\n\n---\n\n');

    await Promise.allSettled([postDiscord(message), postTelegram(message)]);
    res.json({ ok: true, forwarded: true, alerts: alerts.length });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`notifier listening on 0.0.0.0:${PORT}`);
});

