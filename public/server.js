const HISTORY_LIMIT = 48;
const REFRESH_INTERVAL = 5000;
const HIGH_USAGE_THRESHOLD = 95;

const history = {
  cpu: [],
  memory: [],
  storage: [],
  temperature: [],
};

function twoDigits(value) {
  return String(value).padStart(2, '0');
}

function nowStamp() {
  const now = new Date();
  return `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}:${twoDigits(now.getSeconds())}`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bytesLabel(bytes) {
  if (!Number.isFinite(bytes)) {
    return '--';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) {
    return `${megabytes.toFixed(1)} MB`;
  }

  return `${(megabytes / 1024).toFixed(2)} GB`;
}

function percentLabel(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '--';
}

function tempLabel(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} C` : 'N/A';
}

function uptimeLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--';
  }

  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${Math.max(0, Math.round(seconds))}s`;
}

function formatSpeed(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(2)} GHz`;
}

function mountLabel(value) {
  if (!value) {
    return '--';
  }

  return value === '/' ? 'root (/)' : value;
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString();
}

function addLog(message) {
  const log = document.querySelector('[data-activity-log]');
  if (!log) {
    return;
  }

  const entry = document.createElement('article');
  entry.className = 'log-item';
  entry.innerHTML = `<div class="stamp">${nowStamp()}</div><div>${escapeHTML(message)}</div>`;
  log.prepend(entry);

  const items = log.querySelectorAll('.log-item');
  if (items.length > 24) {
    items[items.length - 1].remove();
  }
}

function kvHTML(rows) {
  return rows.map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

function setDangerState(selector, value, threshold = HIGH_USAGE_THRESHOLD) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }

  element.classList.toggle('is-danger', Number.isFinite(value) && value >= threshold);
}

function setMetricDangerState(selector, value, threshold = HIGH_USAGE_THRESHOLD) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }

  const isDanger = Number.isFinite(value) && value >= threshold;
  element.classList.toggle('is-danger', isDanger);

  const card = element.closest('.metric-card');
  if (card) {
    card.classList.toggle('is-danger', isDanger);
  }
}

function setMeter(selector, value) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }

  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  element.style.width = `${safeValue}%`;
}

function setMetricNote(selector, text) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
}

function appendHistory(key, value) {
  if (!Number.isFinite(value)) {
    return;
  }

  const series = history[key];
  if (!series) {
    return;
  }

  series.push(value);
  while (series.length > HISTORY_LIMIT) {
    series.shift();
  }
}

function drawChart(canvas, values, options = {}) {
  if (!canvas) {
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) {
    return;
  }

  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * devicePixelRatio);
  const pixelHeight = Math.round(height * devicePixelRatio);

  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }
  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const background = options.background || 'rgba(255,255,255,0.015)';
  const gridColor = options.gridColor || 'rgba(57,255,20,0.12)';
  const lineColor = options.lineColor || '#39ff14';
  const fillColor = options.fillColor || 'rgba(57,255,20,0.12)';
  const minValue = Number.isFinite(options.minValue) ? options.minValue : 0;
  const maxValue = Number.isFinite(options.maxValue) ? options.maxValue : 100;
  const label = options.label || '';

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = gridColor;
  context.lineWidth = 1;
  context.beginPath();
  for (let index = 1; index < 4; index += 1) {
    const y = (height / 4) * index;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  if (!values.length) {
    context.strokeStyle = 'rgba(237,247,239,0.22)';
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(0, height * 0.7);
    context.lineTo(width, height * 0.7);
    context.stroke();
    context.setLineDash([]);

    if (label) {
      context.fillStyle = 'rgba(237,247,239,0.45)';
      context.font = '11px monospace';
      context.fillText(label, 12, 18);
    }

    return;
  }

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const clamped = Math.max(minValue, Math.min(maxValue, value));
    const normalized = (clamped - minValue) / Math.max(1, maxValue - minValue);
    const y = height - (normalized * (height - 20)) - 10;
    return { x, y, value: clamped };
  });

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  context.lineTo(lastPoint.x, height);
  context.lineTo(firstPoint.x, height);
  context.closePath();
  context.fillStyle = fillColor;
  context.fill();

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  context.shadowColor = lineColor;
  context.shadowBlur = 10;
  context.stroke();
  context.shadowBlur = 0;

  const recent = points[points.length - 1];
  context.fillStyle = lineColor;
  context.beginPath();
  context.arc(recent.x, recent.y, 3.5, 0, Math.PI * 2);
  context.fill();
}

function renderCharts() {
  drawChart(document.querySelector('[data-chart="cpu"]'), history.cpu, {
    lineColor: '#0fff41',
    fillColor: 'rgba(15,255,65,0.22)',
    gridColor: 'rgba(15,255,65,0.18)',
    label: 'CPU',
    maxValue: 100,
  });

  drawChart(document.querySelector('[data-chart="memory"]'), history.memory, {
    lineColor: '#00ffff',
    fillColor: 'rgba(0,255,255,0.22)',
    gridColor: 'rgba(0,255,255,0.18)',
    label: 'MEMORY',
    maxValue: 100,
  });

  drawChart(document.querySelector('[data-chart="storage"]'), history.storage, {
    lineColor: '#ffaa00',
    fillColor: 'rgba(255,170,0,0.22)',
    gridColor: 'rgba(255,170,0,0.18)',
    label: 'STORAGE',
    maxValue: 100,
  });

  drawChart(document.querySelector('[data-chart="temperature"]'), history.temperature, {
    lineColor: '#ff3333',
    fillColor: 'rgba(255,51,51,0.22)',
    gridColor: 'rgba(255,51,51,0.18)',
    label: 'TEMP',
    maxValue: 120,
  });
}

function renderSummary(snapshot) {
  const cpuUsage = snapshot?.cpu?.usagePercent;
  const memoryUsage = snapshot?.memory?.usagePercent;
  const storageUsage = snapshot?.storage?.primary?.usagePercent;
  const temperature = snapshot?.temperature?.current;
  const load = snapshot?.cpu?.loadPercent;
  const uptime = snapshot?.host?.uptimeSeconds;

  setText('[data-cpu-value]', percentLabel(cpuUsage));
  setText('[data-memory-value]', percentLabel(memoryUsage));
  setText('[data-storage-value]', percentLabel(storageUsage));
  setText('[data-temperature-value]', tempLabel(temperature));
  setText('[data-load-value]', Number.isFinite(load) ? load.toFixed(1) : '--');
  setText('[data-uptime-value]', uptimeLabel(uptime));

  setMetricDangerState('[data-cpu-value]', cpuUsage);
  setMetricDangerState('[data-memory-value]', memoryUsage);
  setMetricDangerState('[data-storage-value]', storageUsage);

  setMeter('[data-cpu-meter]', cpuUsage);
  setMeter('[data-memory-meter]', memoryUsage);
  setMeter('[data-storage-meter]', storageUsage);
  setMeter('[data-temperature-meter]', Number.isFinite(temperature) ? Math.min(100, (temperature / 120) * 100) : 0);
  setMeter('[data-load-meter]', load);
  setMeter('[data-uptime-meter]', Number.isFinite(uptime) ? Math.min(100, (uptime / (24 * 60 * 60)) * 100) : 0);

  setDangerState('[data-cpu-meter]', cpuUsage);
  setDangerState('[data-memory-meter]', memoryUsage);
  setDangerState('[data-storage-meter]', storageUsage);

  const cpuNotes = [];
  if (Number.isFinite(snapshot?.cpu?.physicalCores)) {
    cpuNotes.push(`${snapshot.cpu.physicalCores} physical cores`);
  }
  if (Number.isFinite(snapshot?.cpu?.logicalCores)) {
    cpuNotes.push(`${snapshot.cpu.logicalCores} logical cores`);
  }
  if (Number.isFinite(snapshot?.cpu?.speedGHz)) {
    cpuNotes.push(`${formatSpeed(snapshot.cpu.speedGHz)} current`);
  }

  setMetricNote('[data-cpu-note]', cpuNotes.length ? cpuNotes.join(' | ') : 'CPU details unavailable.');
  setMetricNote('[data-memory-note]', Number.isFinite(memoryUsage) ? `${bytesLabel(snapshot.memory.used)} used of ${bytesLabel(snapshot.memory.total)}` : 'Memory details unavailable.');
  setMetricNote('[data-storage-note]', snapshot?.storage?.primary
    ? `${bytesLabel(snapshot.storage.primary.used)} used of ${bytesLabel(snapshot.storage.primary.size)} on ${mountLabel(snapshot.storage.primary.mount)}`
    : 'Primary storage unavailable.');
  setMetricNote('[data-temperature-note]', Number.isFinite(temperature)
    ? `Peak ${Number.isFinite(snapshot?.temperature?.max) ? `${snapshot.temperature.max.toFixed(1)} C` : 'n/a'}`
    : 'No sensor (typical on macOS without sudo)');
  setMetricNote('[data-load-note]', Array.isArray(snapshot?.cpu?.averages)
    ? `1m ${snapshot.cpu.averages[0].toFixed(2)} | 5m ${snapshot.cpu.averages[1].toFixed(2)} | 15m ${snapshot.cpu.averages[2].toFixed(2)}`
    : 'Load average unavailable.');
  setMetricNote('[data-uptime-note]', `Node uptime ${uptimeLabel(snapshot?.process?.uptimeSeconds)} | Host uptime ${uptimeLabel(uptime)}`);

  setText('[data-cpu-chip]', percentLabel(cpuUsage));
  setText('[data-memory-chip]', percentLabel(memoryUsage));
  setText('[data-storage-chip]', percentLabel(storageUsage));
  setText('[data-temperature-chip]', tempLabel(temperature));

  setDangerState('[data-cpu-chip]', cpuUsage);
  setDangerState('[data-memory-chip]', memoryUsage);
  setDangerState('[data-storage-chip]', storageUsage);

  setText('[data-cpu-detail]', Number.isFinite(cpuUsage)
    ? `${percentLabel(snapshot.cpu.userPercent)} user | ${percentLabel(snapshot.cpu.systemPercent)} system | ${percentLabel(snapshot.cpu.idlePercent)} idle`
    : 'CPU detail unavailable.');
  setText('[data-memory-detail]', Number.isFinite(memoryUsage)
    ? `${bytesLabel(snapshot.memory.free)} free | ${bytesLabel(snapshot.memory.available)} available | swap ${bytesLabel(snapshot.memory.swapUsed)} / ${bytesLabel(snapshot.memory.swapTotal)}`
    : 'Memory detail unavailable.');
  setText('[data-storage-detail]', snapshot?.storage?.primary
    ? `${snapshot.storage.primary.fileSystem} on ${mountLabel(snapshot.storage.primary.mount)} | ${bytesLabel(snapshot.storage.primary.available)} free`
    : 'Storage detail unavailable.');
  setText('[data-temperature-detail]', Number.isFinite(temperature)
    ? `Current ${tempLabel(temperature)} | ${Array.isArray(snapshot?.temperature?.cores) && snapshot.temperature.cores.length ? `${snapshot.temperature.cores.length} core sensors` : 'no core sensors'}`
    : 'CPU temp unavailable on this host.');
}

function renderHostDetails(snapshot) {
  const host = snapshot?.host || {};
  const cpu = snapshot?.cpu || {};

  const hostRows = [
    ['Hostname', host.hostname || '--'],
    ['Fully qualified name', host.fqdn || '--'],
    ['Distro', host.distro || '--'],
    ['Platform', host.platform || '--'],
    ['Kernel', host.kernel || '--'],
    ['Architecture', host.architecture || '--'],
    ['Boot uptime', uptimeLabel(host.uptimeSeconds)],
  ];

  const cpuRows = [
    ['Manufacturer', cpu.manufacturer || '--'],
    ['Brand', cpu.brand || '--'],
    ['Vendor', cpu.vendor || '--'],
    ['Family', cpu.family || '--'],
    ['Physical cores', Number.isFinite(cpu.physicalCores) ? String(cpu.physicalCores) : '--'],
    ['Logical cores', Number.isFinite(cpu.logicalCores) ? String(cpu.logicalCores) : '--'],
    ['Speed', formatSpeed(cpu.speedGHz)],
  ];

  const hostTarget = document.querySelector('[data-hardware-details]');
  if (hostTarget) {
    hostTarget.innerHTML = kvHTML(hostRows.concat(cpuRows));
  }
}

function renderNetworkDetails(snapshot) {
  const network = snapshot?.network || {};
  const primary = network.primary || {};
  const stats = network.primaryStats || {};
  const interfaces = Array.isArray(network.interfaces) ? network.interfaces : [];

  const rows = [
    ['Primary interface', primary.iface || '--'],
    ['Address', primary.ip4 || '--'],
    ['IPv6', primary.ip6 || '--'],
    ['MAC', primary.mac || '--'],
    ['Type', primary.type || '--'],
    ['State', primary.operstate || '--'],
    ['Speed', primary.speed ? `${primary.speed} Mbps` : '--'],
    ['RX bytes', bytesLabel(stats.rxBytes)],
    ['TX bytes', bytesLabel(stats.txBytes)],
    ['Interfaces found', String(interfaces.length)],
  ];

  const target = document.querySelector('[data-network-details]');
  if (target) {
    target.innerHTML = kvHTML(rows);
  }
}

function renderProcessDetails(snapshot) {
  const processInfo = snapshot?.process || {};
  const rows = [
    ['PID', processInfo.pid ? String(processInfo.pid) : '--'],
    ['Node version', processInfo.nodeVersion || '--'],
    ['Process uptime', uptimeLabel(processInfo.uptimeSeconds)],
    ['RSS', bytesLabel(processInfo.rss)],
    ['Heap used', bytesLabel(processInfo.heapUsed)],
    ['Heap total', bytesLabel(processInfo.heapTotal)],
    ['Working dir', processInfo.cwd || '--'],
  ];

  const target = document.querySelector('[data-process-details]');
  if (target) {
    target.innerHTML = kvHTML(rows);
  }
}

function renderTimeDetails(snapshot) {
  const timeInfo = snapshot?.time || {};
  const rows = [
    ['Sampled at', formatDateTime(snapshot?.sampledAt)],
    ['Current time', formatDateTime(timeInfo.current)],
    ['Timezone', timeInfo.timezone || '--'],
    ['Boot time', formatDateTime(timeInfo.bootTime)],
    ['Host uptime', uptimeLabel(timeInfo.uptimeSeconds)],
  ];

  const target = document.querySelector('[data-time-details]');
  if (target) {
    target.innerHTML = kvHTML(rows);
  }
}

function renderStorageTable(snapshot) {
  const target = document.querySelector('[data-storage-table]');
  const label = document.querySelector('[data-storage-primary-label]');
  const volumes = Array.isArray(snapshot?.storage?.volumes) ? snapshot.storage.volumes : [];

  if (label) {
    label.textContent = snapshot?.storage?.primary?.mount || 'primary';
  }

  if (!target) {
    return;
  }

  if (!volumes.length) {
    target.innerHTML = '<tr><td colspan="7">No storage volumes found.</td></tr>';
    return;
  }

  target.innerHTML = volumes.map((volume) => {
    return `<tr>
      <td>${escapeHTML(volume.mount)}</td>
      <td>${escapeHTML(volume.fileSystem)}</td>
      <td>${escapeHTML(volume.type)}</td>
      <td>${escapeHTML(bytesLabel(volume.used))}</td>
      <td>${escapeHTML(bytesLabel(volume.available))}</td>
      <td>${escapeHTML(bytesLabel(volume.size))}</td>
      <td>${escapeHTML(percentLabel(volume.usagePercent))}</td>
    </tr>`;
  }).join('');
}

function renderPayloadTable(files) {
  const target = document.querySelector('[data-payload-table]');
  if (!target) {
    return;
  }

  if (!files.length) {
    target.innerHTML = '<tr><td colspan="4">No payload files found.</td></tr>';
    return;
  }

  target.innerHTML = files.map((file) => {
    const type = String(file.extension || '-').toUpperCase();
    const modified = file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : '-';

    return `<tr>
      <td>${escapeHTML(file.name || '-')}</td>
      <td>${escapeHTML(type)}</td>
      <td>${escapeHTML(bytesLabel(file.size || 0))}</td>
      <td>${escapeHTML(modified)}</td>
    </tr>`;
  }).join('');
}

async function fetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function tickNow() {
  const element = document.querySelector('[data-now]');
  if (element) {
    element.textContent = nowStamp();
  }
}

function resizeCharts() {
  renderCharts();
}

let refreshInFlight = false;

async function refresh() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;
  const startedAt = performance.now();
  try {
    addLog('Refreshing telemetry snapshot...');

    const [systemSnapshot, filesSnapshot] = await Promise.all([
      fetchJson('/api/system'),
      fetchJson('/api/files'),
    ]);

    if (systemSnapshot) {
      const cpuUsage = systemSnapshot?.cpu?.usagePercent;
      const memoryUsage = systemSnapshot?.memory?.usagePercent;
      const storageUsage = systemSnapshot?.storage?.primary?.usagePercent;
      const temperature = systemSnapshot?.temperature?.current;

      appendHistory('cpu', cpuUsage);
      appendHistory('memory', memoryUsage);
      appendHistory('storage', storageUsage);
      appendHistory('temperature', temperature);

      renderSummary(systemSnapshot);
      renderHostDetails(systemSnapshot);
      renderNetworkDetails(systemSnapshot);
      renderProcessDetails(systemSnapshot);
      renderTimeDetails(systemSnapshot);
      renderStorageTable(systemSnapshot);
      setText('[data-sampled-at]', `sampled ${formatDateTime(systemSnapshot.sampledAt)}`);
      setText('[data-live-state]', 'online');

      const updateParts = [];
      if (Number.isFinite(cpuUsage)) {
        updateParts.push(`CPU ${percentLabel(cpuUsage)}`);
      }
      if (Number.isFinite(memoryUsage)) {
        updateParts.push(`MEM ${percentLabel(memoryUsage)}`);
      }
      if (Number.isFinite(storageUsage)) {
        updateParts.push(`DSK ${percentLabel(storageUsage)}`);
      }
      addLog(updateParts.length ? `Telemetry sample ready: ${updateParts.join(' | ')}.` : 'Telemetry sample ready.');
      renderCharts();
    } else {
      setText('[data-live-state]', 'offline');
      addLog('System telemetry endpoint returned no data.');
    }

    if (filesSnapshot && Array.isArray(filesSnapshot.files)) {
      renderPayloadTable(filesSnapshot.files);
      const totalSize = filesSnapshot.files.reduce((sum, file) => sum + (file.size || 0), 0);
      addLog(`Payload registry synced: ${filesSnapshot.files.length} files, ${bytesLabel(totalSize)} total.`);
    } else {
      renderPayloadTable([]);
    }

    const duration = Math.round(performance.now() - startedAt);
    setText('[data-sampled-at]', systemSnapshot?.sampledAt ? `sampled ${formatDateTime(systemSnapshot.sampledAt)} in ${duration}ms` : 'sample pending');
  } finally {
    refreshInFlight = false;
  }
}

function wireActions() {
  const refreshButton = document.querySelector('[data-refresh]');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => refresh().catch(() => addLog('Manual refresh failed.')));
  }

  window.addEventListener('resize', resizeCharts);
}

async function init() {
  tickNow();
  setInterval(tickNow, 1000);
  setInterval(() => refresh().catch(() => addLog('Scheduled refresh failed.')), REFRESH_INTERVAL);
  wireActions();
  renderCharts();
  await refresh();
  addLog('Server telemetry page ready.');
}

document.addEventListener('DOMContentLoaded', () => init().catch(() => addLog('Initialization failed.')));
