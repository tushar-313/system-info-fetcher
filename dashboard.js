const express = require('express');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const si = require('systeminformation');
const promClient = require('prom-client');
const { getFetchString } = require('./bin/fetch');

const app = express();
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEFAULT_PORT = 8000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const PAYLOAD_EXTENSIONS = new Set(['.txt', '.md']);
const METRICS_ENDPOINT = process.env.METRICS_ENDPOINT || '/metrics';
const METRICS_PREFIX = process.env.METRICS_PREFIX || 'sysinfo_';
const METRICS_COLLECT_SYSTEM = (process.env.METRICS_COLLECT_SYSTEM || 'true').toLowerCase() === 'true';
const TELEGRAM_ALERTS_ENABLED = (process.env.TELEGRAM_ALERTS_ENABLED || '').toLowerCase() === 'true';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_ALLOWED_CHAT_IDS = process.env.TELEGRAM_ALLOWED_CHAT_IDS || '';
const TELEGRAM_BOT_PUBLIC = (process.env.TELEGRAM_BOT_PUBLIC || 'true').toLowerCase() === 'true';
const TELEGRAM_BOT_COMMANDS = (process.env.TELEGRAM_BOT_COMMANDS || '').toLowerCase() === 'true';

const ALERT_INTERVAL_MS = Math.max(10_000, Number(process.env.ALERT_INTERVAL_MS) || 30_000);
const ALERT_REPEAT_MS = Math.max(60_000, Number(process.env.ALERT_REPEAT_MS) || (60 * 60 * 1000));
const ALERT_CONSECUTIVE_SAMPLES = Math.max(1, Number(process.env.ALERT_CONSECUTIVE_SAMPLES) || 3);

const ALERT_CPU_THRESHOLD = Number(process.env.ALERT_CPU_THRESHOLD || 90);
const ALERT_MEMORY_THRESHOLD = Number(process.env.ALERT_MEMORY_THRESHOLD || 90);
const ALERT_DISK_THRESHOLD = Number(process.env.ALERT_DISK_THRESHOLD || 90);

const register = promClient.register;
register.setDefaultLabels({
    service: 'sysinfo-fetcher',
    env: process.env.NODE_ENV || 'production',
});

const httpRequestsTotal = new promClient.Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'Total number of HTTP requests.',
    labelNames: ['method', 'route', 'status'],
});

const httpRequestDurationSeconds = new promClient.Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const appUp = new promClient.Gauge({
    name: `${METRICS_PREFIX}app_up`,
    help: '1 if the app process is up.',
});

const systemCpuUsagePercent = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_cpu_usage_percent`,
    help: 'CPU usage percent sampled by the app.',
});

const systemMemoryUsagePercent = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_memory_usage_percent`,
    help: 'Memory usage percent sampled by the app.',
});

const systemDiskUsagePercent = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_disk_usage_percent`,
    help: 'Disk usage percent of primary volume sampled by the app.',
});

const systemTemperatureCelsius = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_temperature_celsius`,
    help: 'CPU temperature in Celsius sampled by the app (if available).',
});

const systemLoadAverage = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_load_average`,
    help: 'OS load average sampled by the app.',
    labelNames: ['window'],
});

const systemHostUptimeSeconds = new promClient.Gauge({
    name: `${METRICS_PREFIX}system_host_uptime_seconds`,
    help: 'Host uptime in seconds sampled by the app.',
});

function normalizeRoute(req) {
    if (req.route && req.route.path) {
        return String(req.route.path);
    }

    // Fallback: avoid high-cardinality labels.
    const pathOnly = String(req.path || '/');
    if (pathOnly.startsWith('/assets/')) return '/assets/:name';
    if (pathOnly.startsWith('/api/files/')) return '/api/files/:name';
    return pathOnly;
}

app.use((req, res, next) => {
    if (req.path === METRICS_ENDPOINT) {
        next();
        return;
    }

    const end = httpRequestDurationSeconds.startTimer();
    res.on('finish', () => {
        const route = normalizeRoute(req);
        const status = String(res.statusCode);
        httpRequestsTotal.inc({ method: req.method, route, status }, 1);
        end({ method: req.method, route, status });
    });
    next();
});

function getPayloadFiles() {
    return fs
        .readdirSync(ROOT_DIR)
        .filter((fileName) => PAYLOAD_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort((left, right) => left.localeCompare(right));
}

function isSafePayloadName(fileName) {
    return fileName === path.basename(fileName) && PAYLOAD_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isSafeAssetName(fileName) {
    return fileName === path.basename(fileName) && path.extname(fileName).toLowerCase() === '.pdf';
}

function getIndexFilePath() {
    return path.join(PUBLIC_DIR, 'index.html');
}

function getServerFilePath() {
    return path.join(PUBLIC_DIR, 'server.html');
}

function getPreferredHostIp() {
    let interfaces;
    try {
        interfaces = os.networkInterfaces();
    } catch {
        return '127.0.0.1';
    }

    for (const entries of Object.values(interfaces)) {
        for (const entry of entries || []) {
            if (entry && entry.family === 'IPv4' && !entry.internal) {
                return entry.address;
            }
        }
    }

    return '127.0.0.1';
}

function roundNumber(value, digits = 1) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return null;
    }

    const factor = 10 ** digits;
    return Math.round(numericValue * factor) / factor;
}

function safeOsUptimeSeconds() {
    try {
        const value = os.uptime();
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

function safeProcessUptimeSeconds() {
    try {
        const value = process.uptime();
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

function pickPrimaryVolume(volumes) {
    if (!Array.isArray(volumes) || !volumes.length) {
        return null;
    }

    return volumes.find((volume) => volume.mount === '/')
        || volumes.find((volume) => volume.mount === '/System/Volumes/Data')
        || volumes.find((volume) => volume.mount && volume.mount !== 'tmpfs')
        || volumes[0];
}

function pickPrimaryInterface(interfaces) {
    if (!Array.isArray(interfaces) || !interfaces.length) {
        return null;
    }

    return interfaces.find((network) => network.ip4 && network.ip4 !== '127.0.0.1' && !network.internal)
        || interfaces.find((network) => network.ip4)
        || interfaces[0];
}

function pickTemperature(temperature) {
    if (!temperature) {
        return null;
    }

    if (Number.isFinite(temperature.main) && temperature.main > 0) {
        return roundNumber(temperature.main, 1);
    }

    if (Array.isArray(temperature.cores)) {
        const values = temperature.cores.filter((value) => Number.isFinite(value) && value > 0);
        if (values.length) {
            return roundNumber(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
        }
    }

    return null;
}

async function safeCollect(task, fallback) {
    try {
        return await task();
    } catch {
        return fallback;
    }
}

async function collectSystemSnapshot() {
    const [cpu, load, memory, volumes, temperature, osInfo, timeInfo, battery, graphics, systemInfo, processes, networkInterfaces, networkStats] = await Promise.all([
        safeCollect(() => si.cpu(), {}),
        safeCollect(() => si.currentLoad(), {}),
        safeCollect(() => si.mem(), {}),
        safeCollect(() => si.fsSize(), []),
        safeCollect(() => si.cpuTemperature(), {}),
        safeCollect(() => si.osInfo(), {}),
        safeCollect(() => si.time(), {}),
        safeCollect(() => si.battery(), {}),
        safeCollect(() => si.graphics(), {}),
        safeCollect(() => si.system(), {}),
        safeCollect(() => si.processes(), {}),
        safeCollect(() => si.networkInterfaces(), []),
        safeCollect(() => si.networkStats(), []),
    ]);

    const primaryVolume = pickPrimaryVolume(volumes);
    const primaryInterface = pickPrimaryInterface(networkInterfaces);
    const primaryInterfaceStats = primaryInterface
        ? networkStats.find((network) => network.iface === primaryInterface.iface)
        : null;

    const loadAverages = os.loadavg().map((value) => roundNumber(value, 2));
    const temperatureValue = pickTemperature(temperature);
    const memoryUsage = Number.isFinite(memory.total) && memory.total > 0
        ? roundNumber((memory.used / memory.total) * 100, 1)
        : null;

    const perCoreCpu = Array.isArray(load.cpus)
        ? load.cpus.map((c, i) => ({ core: i, load: roundNumber(c.load, 1) }))
        : [];

    const topProcesses = Array.isArray(processes.list)
        ? processes.list.slice(0, 25).map((p) => ({
            pid: p.pid,
            name: p.name,
            cpu: roundNumber(p.cpu, 1),
            mem: roundNumber(p.mem, 1),
            user: p.user || 'system',
            state: p.state || 'running',
        }))
        : [];

    return {
        sampledAt: new Date().toISOString(),
        host: {
            hostname: os.hostname(),
            fqdn: osInfo.fqdn || os.hostname(),
            platform: os.platform(),
            type: os.type(),
            release: os.release(),
            architecture: os.arch(),
            kernel: osInfo.kernel || os.release(),
            distro: osInfo.distro || osInfo.platform || 'n/a',
            uptimeSeconds: safeOsUptimeSeconds(),
        },
        cpu: {
            manufacturer: cpu.manufacturer || 'n/a',
            brand: cpu.brand || 'n/a',
            vendor: cpu.vendor || 'n/a',
            family: cpu.family || 'n/a',
            physicalCores: cpu.physicalCores || cpu.cores || null,
            logicalCores: cpu.cores || null,
            speedGHz: roundNumber(load.currentLoadSpeed || cpu.speed || cpu.speedmax || cpu.speedmin || null, 2),
            usagePercent: roundNumber(load.currentLoad, 1),
            userPercent: roundNumber(load.currentLoadUser, 1),
            systemPercent: roundNumber(load.currentLoadSystem, 1),
            idlePercent: roundNumber(load.currentLoadIdle, 1),
            loadPercent: roundNumber(load.currentLoad, 1),
            averages: loadAverages,
        },
        perCoreCpu,
        battery: {
            hasBattery: Boolean(battery.hasBattery),
            isCharging: Boolean(battery.isCharging),
            percent: Number.isFinite(battery.percent) ? battery.percent : null,
            timeRemaining: Number.isFinite(battery.timeRemaining) ? battery.timeRemaining : null,
        },
        graphics: {
            controllers: Array.isArray(graphics.controllers)
                ? graphics.controllers.map((g) => ({
                    model: g.model || 'n/a',
                    vendor: g.vendor || 'n/a',
                    vram: g.vram || null,
                }))
                : [],
        },
        hardware: {
            manufacturer: systemInfo.manufacturer || 'n/a',
            model: systemInfo.model || 'n/a',
            version: systemInfo.version || 'n/a',
            serial: (systemInfo.serial && systemInfo.serial !== '-') ? systemInfo.serial : 'n/a',
        },
        processes: topProcesses,
        memory: {
            total: memory.total || null,
            used: memory.used || null,
            free: memory.free || null,
            available: memory.available || null,
            active: memory.active || null,
            swapTotal: memory.swaptotal || null,
            swapUsed: memory.swapused || null,
            usagePercent: memoryUsage,
        },
        storage: {
            primary: primaryVolume ? {
                mount: primaryVolume.mount || 'n/a',
                fileSystem: primaryVolume.fs || 'n/a',
                type: primaryVolume.type || 'n/a',
                size: primaryVolume.size || null,
                used: primaryVolume.used || null,
                available: primaryVolume.available || null,
                usagePercent: Number.isFinite(primaryVolume.use) ? roundNumber(primaryVolume.use, 1) : null,
            } : null,
            volumes: volumes.slice(0, 8).map((volume) => ({
                mount: volume.mount || 'n/a',
                fileSystem: volume.fs || 'n/a',
                type: volume.type || 'n/a',
                size: volume.size || null,
                used: volume.used || null,
                available: volume.available || null,
                usagePercent: Number.isFinite(volume.use) ? roundNumber(volume.use, 1) : null,
            })),
        },
        temperature: {
            current: temperatureValue,
            max: Number.isFinite(temperature.max) ? roundNumber(temperature.max, 1) : null,
            cores: Array.isArray(temperature.cores)
                ? temperature.cores.filter((value) => Number.isFinite(value)).map((value) => roundNumber(value, 1))
                : [],
            sockets: Array.isArray(temperature.sockets)
                ? temperature.sockets.filter((value) => Number.isFinite(value)).map((value) => roundNumber(value, 1))
                : [],
        },
        network: {
            primary: primaryInterface ? {
                iface: primaryInterface.iface || 'n/a',
                ip4: primaryInterface.ip4 || 'n/a',
                ip6: primaryInterface.ip6 || 'n/a',
                mac: primaryInterface.mac || 'n/a',
                type: primaryInterface.type || 'n/a',
                speed: primaryInterface.speed || null,
                operstate: primaryInterface.operstate || 'n/a',
                internal: Boolean(primaryInterface.internal),
            } : null,
            primaryStats: primaryInterfaceStats ? {
                rxBytes: primaryInterfaceStats.rx_bytes || 0,
                txBytes: primaryInterfaceStats.tx_bytes || 0,
                rxPackets: primaryInterfaceStats.rx_packets || 0,
                txPackets: primaryInterfaceStats.tx_packets || 0,
                rxErrors: primaryInterfaceStats.rx_errors || 0,
                txErrors: primaryInterfaceStats.tx_errors || 0,
            } : null,
            interfaces: networkInterfaces.slice(0, 8).map((network) => ({
                iface: network.iface || 'n/a',
                type: network.type || 'n/a',
                ip4: network.ip4 || 'n/a',
                ip6: network.ip6 || 'n/a',
                mac: network.mac || 'n/a',
                speed: network.speed || null,
                operstate: network.operstate || 'n/a',
                internal: Boolean(network.internal),
            })),
        },
        process: {
            pid: process.pid,
            nodeVersion: process.version,
            uptimeSeconds: safeProcessUptimeSeconds(),
            rss: process.memoryUsage().rss,
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            cwd: process.cwd(),
        },
        time: {
            current: timeInfo.current || new Date().toISOString(),
            uptimeSeconds: Number.isFinite(timeInfo.uptime) ? timeInfo.uptime : safeOsUptimeSeconds(),
            timezone: timeInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'n/a',
            bootTime: timeInfo.bootTime || null,
        },
    };
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a';
}

function sendTelegram(message) {
    if (!TELEGRAM_ALERTS_ENABLED || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return Promise.resolve({ ok: false, skipped: true });
    }

    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: String(message).slice(0, 3900),
            disable_web_page_preview: true,
        });

        const req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            timeout: 8000,
        }, (res) => {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
        });

        req.on('error', (error) => {
            resolve({ ok: false, error: error.message });
        });

        req.on('timeout', () => {
            req.abort();
            resolve({ ok: false, error: 'timeout' });
        });

        req.write(data);
        req.end();
    });
}

function createAlertState() {
    return {
        consecutive: 0,
        firing: false,
        lastSentAt: 0,
    };
}

const alertStates = {
    highCpu: createAlertState(),
    highMemory: createAlertState(),
    highDisk: createAlertState(),
};

async function evaluateAlert({ key, state, condition, title, detail }) {
    if (condition) {
        state.consecutive += 1;
    } else {
        state.consecutive = 0;
    }

    const shouldFire = state.consecutive >= ALERT_CONSECUTIVE_SAMPLES;
    const now = Date.now();

    if (shouldFire && !state.firing) {
        state.firing = true;
        state.lastSentAt = now;
        await sendTelegram(`FIRING: ${title}\n${detail}`);
        return;
    }

    if (shouldFire && state.firing && (now - state.lastSentAt) >= ALERT_REPEAT_MS) {
        state.lastSentAt = now;
        await sendTelegram(`REMINDER: ${title}\n${detail}`);
        return;
    }

    if (!shouldFire && state.firing) {
        state.firing = false;
        state.lastSentAt = now;
        await sendTelegram(`RESOLVED: ${title}\n${detail}`);
    }
}

let alertsLoopRunning = false;
function startTelegramAlertsLoop() {
    if (alertsLoopRunning) return;
    if (!TELEGRAM_ALERTS_ENABLED) return;
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

    alertsLoopRunning = true;

    const tick = async () => {
        try {
            const snapshot = await collectSystemSnapshot();

            const cpu = (snapshot && snapshot.cpu && snapshot.cpu.usagePercent);
            const mem = (snapshot && snapshot.memory && snapshot.memory.usagePercent);
            const disk = (snapshot && snapshot.storage && snapshot.storage.primary && snapshot.storage.primary.usagePercent);

            await Promise.all([
                evaluateAlert({
                    key: 'highCpu',
                    state: alertStates.highCpu,
                    condition: Number.isFinite(cpu) && cpu >= ALERT_CPU_THRESHOLD,
                    title: `High CPU (>= ${ALERT_CPU_THRESHOLD}%)`,
                    detail: `CPU: ${formatPercent(cpu)}\nHost: ${(snapshot && snapshot.host && snapshot.host.hostname) || 'n/a'}\nTime: ${(snapshot && snapshot.sampledAt) || 'n/a'}`,
                }),
                evaluateAlert({
                    key: 'highMemory',
                    state: alertStates.highMemory,
                    condition: Number.isFinite(mem) && mem >= ALERT_MEMORY_THRESHOLD,
                    title: `High Memory (>= ${ALERT_MEMORY_THRESHOLD}%)`,
                    detail: `Memory: ${formatPercent(mem)}\nHost: ${(snapshot && snapshot.host && snapshot.host.hostname) || 'n/a'}\nTime: ${(snapshot && snapshot.sampledAt) || 'n/a'}`,
                }),
                evaluateAlert({
                    key: 'highDisk',
                    state: alertStates.highDisk,
                    condition: Number.isFinite(disk) && disk >= ALERT_DISK_THRESHOLD,
                    title: `High Disk (>= ${ALERT_DISK_THRESHOLD}%)`,
                    detail: `Disk: ${formatPercent(disk)}\nMount: ${(snapshot && snapshot.storage && snapshot.storage.primary && snapshot.storage.primary.mount) || 'n/a'}\nHost: ${(snapshot && snapshot.host && snapshot.host.hostname) || 'n/a'}\nTime: ${(snapshot && snapshot.sampledAt) || 'n/a'}`,
                }),
            ]);
        } catch {
            // Swallow alert loop failures: alerts should never crash the server.
        }
    };

    // Run once after boot, then on interval.
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), ALERT_INTERVAL_MS);
}

// ──────────────────────────────────────────────────────────────────────────────
// Telegram Bot: Interactive Command Handler (long-polling, no extra ports)
// ──────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return 'n/a';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return 'n/a';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

function parseAllowedChatIds() {
    const values = [TELEGRAM_CHAT_ID, TELEGRAM_ALLOWED_CHAT_IDS]
        .filter(Boolean)
        .join(',')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    return new Set(values);
}

const ALLOWED_CHAT_IDS = parseAllowedChatIds();

function isAuthorizedChatId(chatId) {
    if (TELEGRAM_BOT_PUBLIC) return true;
    if (!chatId) return false;
    return ALLOWED_CHAT_IDS.has(String(chatId).trim());
}

async function handleBotCommand(command) {
    const cmd = command.trim().toLowerCase().split(/\s+/)[0];

    switch (cmd) {
        case '/start':
        case '/help': {
            return [
                '⚡ *SysInfo Fetcher Bot*',
                '',
                'Available commands:',
                '  /status  — Full server snapshot',
                '  /health  — Quick health check',
                '  /uptime  — Host & process uptime',
                '  /disk    — Storage volumes',
                '  /alerts  — Current alert states',
                '  /help    — This message',
            ].join('\n');
        }

        case '/status': {
            try {
                const snap = await collectSystemSnapshot();
                const cpu = (snap && snap.cpu && snap.cpu.usagePercent);
                const mem = (snap && snap.memory && snap.memory.usagePercent);
                const disk = (snap && snap.storage && snap.storage.primary && snap.storage.primary.usagePercent);
                const temp = (snap && snap.temperature && snap.temperature.current);
                const load = (snap && snap.cpu && snap.cpu.averages);

                return [
                    '📊 *Server Status*',
                    '',
                    `🖥  Host: \`${(snap && snap.host && snap.host.hostname) || 'n/a'}\``,
                    `🐧  OS: ${(snap && snap.host && snap.host.distro) || 'n/a'} (${(snap && snap.host && snap.host.architecture) || 'n/a'})`,
                    `⚙️  CPU: ${(snap && snap.cpu && snap.cpu.brand) || 'n/a'}`,
                    '',
                    `💻  CPU Usage: *${formatPercent(cpu)}*`,
                    `🧠  Memory: *${formatPercent(mem)}* (${formatBytes((snap && snap.memory && snap.memory.used))} / ${formatBytes((snap && snap.memory && snap.memory.total))})`,
                    `💾  Disk: *${formatPercent(disk)}* (${formatBytes((snap && snap.storage && snap.storage.primary && snap.storage.primary.used))} / ${formatBytes((snap && snap.storage && snap.storage.primary && snap.storage.primary.size))})`,
                    `🌡  Temp: ${temp != null ? `${temp}°C` : 'n/a'}`,
                    `📈  Load: ${Array.isArray(load) ? load.join(' / ') : 'n/a'}`,
                    `⏱  Uptime: ${formatDuration((snap && snap.host && snap.host.uptimeSeconds))}`,
                    '',
                    `🕐  Sampled: ${(snap && snap.sampledAt) || 'n/a'}`,
                ].join('\n');
            } catch (err) {
                return `❌ Failed to collect status: ${err.message}`;
            }
        }

        case '/health': {
            try {
                const snap = await collectSystemSnapshot();
                const cpu = (snap && snap.cpu && snap.cpu.usagePercent) || 0;
                const mem = (snap && snap.memory && snap.memory.usagePercent) || 0;
                const disk = (snap && snap.storage && snap.storage.primary && snap.storage.primary.usagePercent) || 0;

                const cpuOk = cpu < ALERT_CPU_THRESHOLD;
                const memOk = mem < ALERT_MEMORY_THRESHOLD;
                const diskOk = disk < ALERT_DISK_THRESHOLD;
                const allOk = cpuOk && memOk && diskOk;

                return [
                    allOk ? '✅ *All Systems Healthy*' : '⚠️ *Issues Detected*',
                    '',
                    `${cpuOk ? '🟢' : '🔴'} CPU: ${formatPercent(cpu)} (threshold: ${ALERT_CPU_THRESHOLD}%)`,
                    `${memOk ? '🟢' : '🔴'} Memory: ${formatPercent(mem)} (threshold: ${ALERT_MEMORY_THRESHOLD}%)`,
                    `${diskOk ? '🟢' : '🔴'} Disk: ${formatPercent(disk)} (threshold: ${ALERT_DISK_THRESHOLD}%)`,
                ].join('\n');
            } catch (err) {
                return `❌ Health check failed: ${err.message}`;
            }
        }

        case '/uptime': {
            try {
                const snap = await collectSystemSnapshot();
                return [
                    '⏱ *Uptime Report*',
                    '',
                    `🖥  Host: ${formatDuration((snap && snap.host && snap.host.uptimeSeconds))}`,
                    `🟢  Process: ${formatDuration((snap && snap.process && snap.process.uptimeSeconds))}`,
                    `📦  Node: ${(snap && snap.process && snap.process.nodeVersion) || 'n/a'}`,
                    `🧠  Heap: ${formatBytes((snap && snap.process && snap.process.heapUsed))} / ${formatBytes((snap && snap.process && snap.process.heapTotal))}`,
                    `📍  RSS: ${formatBytes((snap && snap.process && snap.process.rss))}`,
                ].join('\n');
            } catch (err) {
                return `❌ Failed: ${err.message}`;
            }
        }

        case '/disk': {
            try {
                const snap = await collectSystemSnapshot();
                const vols = (snap && snap.storage && snap.storage.volumes) || [];
                if (!vols.length) return '💾 No storage volumes found.';

                const lines = ['💾 *Storage Volumes*', ''];
                for (const v of vols) {
                    lines.push(`\`${v.mount}\` — ${formatPercent(v.usagePercent)} used (${formatBytes(v.used)} / ${formatBytes(v.size)})`);
                }
                return lines.join('\n');
            } catch (err) {
                return `❌ Failed: ${err.message}`;
            }
        }

        case '/alerts': {
            const lines = ['🔔 *Alert States*', ''];
            for (const [key, state] of Object.entries(alertStates)) {
                const icon = state.firing ? '🔴 FIRING' : '🟢 OK';
                lines.push(`${icon}  \`${key}\` — consecutive: ${state.consecutive}`);
            }
            lines.push('');
            lines.push(`Thresholds: CPU ${ALERT_CPU_THRESHOLD}% | Mem ${ALERT_MEMORY_THRESHOLD}% | Disk ${ALERT_DISK_THRESHOLD}%`);
            return lines.join('\n');
        }

        default:
            return `❓ Unknown command: \`${cmd}\`\nSend /help for available commands.`;
    }
}

function sendTelegramReply(chatId, text) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: chatId,
            text: String(text).slice(0, 3900),
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
        });

        const req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            timeout: 10000,
        }, () => {
            resolve();
        });

        req.on('error', (error) => {
            console.error('[telegram-bot] Failed to send reply: ' + error.message);
            resolve();
        });

        req.on('timeout', () => {
            req.abort();
            console.error('[telegram-bot] Failed to send reply: timeout');
            resolve();
        });

        req.write(data);
        req.end();
    });
}

let botPollingRunning = false;
let lastUpdateId = 0;

function pollTelegramUpdates() {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + TELEGRAM_BOT_TOKEN + '/getUpdates?offset=' + (lastUpdateId + 1) + '&timeout=30&allowed_updates=%5B%22message%22%5D',
            method: 'GET',
            timeout: 35000,
        }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return resolve();
            }

            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (!data.ok || !Array.isArray(data.result)) return resolve();

                    for (const update of data.result) {
                        lastUpdateId = Math.max(lastUpdateId, update.update_id);
                        const msg = update.message;
                        if (!msg || !msg.text) continue;

                        const chatId = String((msg.chat && msg.chat.id) || '').trim();
                        if (!isAuthorizedChatId(chatId)) {
                            await sendTelegramReply(msg.chat.id, '🔒 Unauthorized. This bot only responds to its owner.');
                            continue;
                        }

                        if (msg.text.startsWith('/')) {
                            const reply = await handleBotCommand(msg.text);
                            await sendTelegramReply(msg.chat.id, reply);
                        }
                    }
                } catch (e) {
                    console.error('[telegram-bot] Polling parse error: ' + e.message);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error('[telegram-bot] Polling error: ' + error.message);
            resolve();
        });

        req.on('timeout', () => {
            req.abort();
            resolve();
        });

        req.end();
    });
}

function startTelegramBotPolling() {
    if (botPollingRunning) return;
    if (!TELEGRAM_BOT_COMMANDS) return;
    if (!TELEGRAM_BOT_TOKEN) return;
    if (!TELEGRAM_BOT_PUBLIC && !TELEGRAM_CHAT_ID) return;

    botPollingRunning = true;
    console.log('[telegram-bot] Command bot started (long-polling)');

    const loop = async () => {
        while (botPollingRunning) {
            await pollTelegramUpdates();
            // Small delay to avoid hammering on errors
            await new Promise(r => setTimeout(r, 500));
        }
    };

    loop().catch((err) => {
        const detail = err && err.stack ? err.stack : String(err);
        console.error(`[telegram-bot] Loop crashed:\n${detail}`);
        botPollingRunning = false;
    });
}

app.use(async (req, res, next) => {
    if (req.method === 'GET' && req.path === '/') {
        const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
        if (userAgent.includes('curl') || userAgent.includes('wget') || userAgent.includes('httpie')) {
            try {
                const text = await getFetchString();
                return res.type('text/plain').send(text);
            } catch {
                // fall through
            }
        }
    }
    next();
});

app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: 0,
}));

app.get('/api/files', (req, res) => {
    const files = getPayloadFiles().map((fileName) => {
        const filePath = path.join(ROOT_DIR, fileName);
        const stats = fs.statSync(filePath);

        return {
            name: fileName,
            extension: path.extname(fileName).slice(1).toLowerCase(),
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
        };
    });

    res.json({
        count: files.length,
        files,
    });
});

app.get('/api/files/:name', (req, res) => {
    const fileName = req.params.name;

    if (!isSafePayloadName(fileName)) {
        res.status(400).json({ error: 'invalid file name' });
        return;
    }

    const files = getPayloadFiles();
    if (!files.includes(fileName)) {
        res.status(404).json({ error: 'file not found' });
        return;
    }

    const filePath = path.join(ROOT_DIR, fileName);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    res.json({
        name: fileName,
        extension: path.extname(fileName).slice(1).toLowerCase(),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        content,
    });
});

app.get('/assets/:name', (req, res) => {
    const fileName = req.params.name;

    if (!isSafeAssetName(fileName)) {
        res.status(400).json({ error: 'invalid asset name' });
        return;
    }

    const filePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'asset not found' });
        return;
    }

    res.sendFile(filePath);
});

app.get(['/healthz', '/api/healthz'], (req, res) => {
    res.json({ ok: true, service: 'sysinfo-fetcher' });
});

app.get(['/cli', '/api/system/cli'], async (req, res) => {
    try {
        const text = await getFetchString();
        res.type('text/plain').send(text);
    } catch (err) {
        res.status(500).type('text/plain').send('Failed to generate system info output.');
    }
});

app.get('/api/system/quick', async (req, res) => {
    try {
        const [load, mem] = await Promise.all([
            safeCollect(() => si.currentLoad(), {}),
            safeCollect(() => si.mem(), {}),
        ]);
        res.json({
            sampledAt: new Date().toISOString(),
            cpuUsagePercent: roundNumber(load.currentLoad, 1),
            memoryUsagePercent: (mem.total > 0) ? roundNumber((mem.used / mem.total) * 100, 1) : null,
            loadAverages: os.loadavg().map(v => roundNumber(v, 2)),
            uptimeSeconds: safeOsUptimeSeconds(),
        });
    } catch (err) {
        res.status(500).json({ error: 'failed to collect quick stats' });
    }
});

let lastMetricsSampleAt = 0;
let lastMetricsSample = null;
const METRICS_SAMPLE_TTL_MS = Math.max(1000, Number(process.env.METRICS_SAMPLE_TTL_MS) || 5000);

async function sampleMetrics() {
    if (!METRICS_COLLECT_SYSTEM) {
        appUp.set(1);
        return;
    }

    const now = Date.now();
    if (lastMetricsSample && (now - lastMetricsSampleAt) < METRICS_SAMPLE_TTL_MS) {
        return;
    }

    const snapshot = await collectSystemSnapshot();
    lastMetricsSample = snapshot;
    lastMetricsSampleAt = now;

    appUp.set(1);

    if (Number.isFinite((snapshot && snapshot.cpu && snapshot.cpu.usagePercent))) systemCpuUsagePercent.set(snapshot.cpu.usagePercent);
    if (Number.isFinite((snapshot && snapshot.memory && snapshot.memory.usagePercent))) systemMemoryUsagePercent.set(snapshot.memory.usagePercent);
    if (Number.isFinite((snapshot && snapshot.storage && snapshot.storage.primary && snapshot.storage.primary.usagePercent))) systemDiskUsagePercent.set(snapshot.storage.primary.usagePercent);
    if (Number.isFinite((snapshot && snapshot.temperature && snapshot.temperature.current))) systemTemperatureCelsius.set(snapshot.temperature.current);
    if (Array.isArray((snapshot && snapshot.cpu && snapshot.cpu.averages))) {
        const [one, five, fifteen] = snapshot.cpu.averages;
        if (Number.isFinite(one)) systemLoadAverage.set({ window: '1m' }, one);
        if (Number.isFinite(five)) systemLoadAverage.set({ window: '5m' }, five);
        if (Number.isFinite(fifteen)) systemLoadAverage.set({ window: '15m' }, fifteen);
    }
    if (Number.isFinite((snapshot && snapshot.host && snapshot.host.uptimeSeconds))) systemHostUptimeSeconds.set(snapshot.host.uptimeSeconds);
}

app.get(METRICS_ENDPOINT, async (req, res) => {
    try {
        await sampleMetrics();
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        res.status(500).json({
            error: 'failed to collect metrics',
            detail: error instanceof Error ? error.message : 'unknown error',
        });
    }
});

app.get('/api/system', async (req, res) => {
    try {
        const snapshot = await collectSystemSnapshot();
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({
            error: 'failed to collect system telemetry',
            detail: error instanceof Error ? error.message : 'unknown error',
        });
    }
});

app.get(['/server', '/server.html'], (req, res) => {
    res.sendFile(getServerFilePath());
});

app.get('*', async (req, res) => {
    const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
    if (req.path === '/' && (userAgent.includes('curl') || userAgent.includes('wget') || userAgent.includes('httpie'))) {
        try {
            const text = await getFetchString();
            return res.type('text/plain').send(text);
        } catch {
            // fall through
        }
    }
    res.sendFile(getIndexFilePath());
});

function startServer(port) {
    const server = app.listen(port, '0.0.0.0', async () => {
        const hostIp = getPreferredHostIp();
        try {
            const banner = await getFetchString();
            console.log(banner);
        } catch {}
        console.log(`\x1b[1m\x1b[32m✔ SysInfo Fetcher Server live on:\x1b[0m http://${hostIp}:${port}/ (or http://localhost:${port}/)`);
        console.log(`\x1b[1m\x1b[36m⚡ CLI fetch command:\x1b[0m curl http://${hostIp}:${port}/`);
        console.log(`\x1b[1m\x1b[35m📊 Metrics live on:\x1b[0m http://${hostIp}:${port}${METRICS_ENDPOINT}`);
        console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && port === DEFAULT_PORT) {
            console.error(`Port ${DEFAULT_PORT} is already in use. Stop the other process and restart.`);
            process.exit(1);
        }

        throw error;
    });
}

startServer(PORT);
startTelegramAlertsLoop();
startTelegramBotPolling();
