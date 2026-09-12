// SysInfo Fetcher Dashboard Logic
const HISTORY_LIMIT = 45;
let pollTimer = null;
let pollInterval = 3000;
let lastSnapshot = null;
const perfHistory = [];

// DOM Elements
const el = {
  clock: document.querySelector('[data-clock]'),
  hostnamePill: document.querySelector('[data-hostname-pill]'),
  uptimePill: document.querySelector('[data-uptime-pill]'),
  hostStatus: document.querySelector('[data-host-status]'),
  pollRate: document.querySelector('[data-poll-rate]'),
  refreshBtn: document.querySelector('[data-action="refresh"]'),
  copyCliBtns: document.querySelectorAll('[data-action="copy-cli"]'),
  copyCurlBtn: document.querySelector('[data-action="copy-curl"]'),
  exportJsonBtn: document.querySelector('[data-action="export-json"]'),
  toast: document.querySelector('[data-toast]'),
  
  // Terminal
  termTitleHost: document.querySelector('[data-term-title-host]'),
  asciiLogo: document.querySelector('[data-ascii-logo]'),
  specsTitle: document.querySelector('[data-specs-title]'),
  specsDivider: document.querySelector('[data-specs-divider]'),
  specOs: document.querySelector('[data-spec-os]'),
  specHost: document.querySelector('[data-spec-host]'),
  specKernel: document.querySelector('[data-spec-kernel]'),
  specUptime: document.querySelector('[data-spec-uptime]'),
  specArch: document.querySelector('[data-spec-arch]'),
  specNode: document.querySelector('[data-spec-node]'),
  specCpu: document.querySelector('[data-spec-cpu]'),
  specGpu: document.querySelector('[data-spec-gpu]'),
  specMem: document.querySelector('[data-spec-mem]'),
  specDisk: document.querySelector('[data-spec-disk]'),
  specIp: document.querySelector('[data-spec-ip]'),
  specBat: document.querySelector('[data-spec-bat]'),
  specBatRow: document.querySelector('[data-spec-bat-row]'),
  
  // Gauges
  valCpu: document.querySelector('[data-val-cpu]'),
  barCpu: document.querySelector('[data-bar-cpu]'),
  metaCpu: document.querySelector('[data-meta-cpu]'),
  valMem: document.querySelector('[data-val-mem]'),
  barMem: document.querySelector('[data-bar-mem]'),
  metaMem: document.querySelector('[data-meta-mem]'),
  valDisk: document.querySelector('[data-val-disk]'),
  barDisk: document.querySelector('[data-bar-disk]'),
  metaDisk: document.querySelector('[data-meta-disk]'),
  valTemp: document.querySelector('[data-val-temp]'),
  barTemp: document.querySelector('[data-bar-temp]'),
  metaTemp: document.querySelector('[data-meta-temp]'),
  valLoad: document.querySelector('[data-val-load]'),
  barLoad: document.querySelector('[data-bar-load]'),
  metaLoad: document.querySelector('[data-meta-load]'),
  valBat: document.querySelector('[data-val-bat]'),
  barBat: document.querySelector('[data-bar-bat]'),
  metaBat: document.querySelector('[data-meta-bat]'),
  
  // Charts & Cores
  perfChart: document.getElementById('perfChart'),
  coresGrid: document.querySelector('[data-cores-grid]'),
  coreCountBadge: document.querySelector('[data-core-count-badge]'),
  
  // Tables & Details
  storageTbody: document.querySelector('[data-storage-tbody]'),
  volumeCount: document.querySelector('[data-volume-count]'),
  networkList: document.querySelector('[data-network-list]'),
  processTbody: document.querySelector('[data-process-tbody]'),
  processSearch: document.querySelector('[data-process-search]'),
  footerSampled: document.querySelector('[data-footer-sampled]'),
};

// Utilities
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (!parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

function showToast(message) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.add('show');
  setTimeout(() => el.toast.classList.remove('show'), 2500);
}

// Clock loop
function updateClock() {
  const now = new Date();
  if (el.clock) {
    el.clock.textContent = now.toTimeString().split(' ')[0];
  }
}
setInterval(updateClock, 1000);
updateClock();

// ASCII Logos for OS
const ASCII_LOGOS = {
  darwin: `
                    'c.          
                 ,xNMM.          
               .OMMMMo           
               lMM"              
     .;loddo:.  .olloddol;.      
   cKMMMMMMMMMMNWMMMMMMMMMM0:    
 .KMMMMMMMMMMMMMMMMMMMMMMMWd.   
 XMMMMMMMMMMMMMMMMMMMMMMMX.     
;MMMMMMMMMMMMMMMMMMMMMMMM:     
:MMMMMMMMMMMMMMMMMMMMMMMM:     
.MMMMMMMMMMMMMMMMMMMMMMMMX.    
 kMMMMMMMMMMMMMMMMMMMMMMMMWd.  
  .XMMMMMMMMMMMMMMMMMMMMMMMMk   
   .XMMMMMMMMMMMMMMMMMMMMMMK.   
     kMMMMMMMMMMMMMMMMMMMMd     
      ;KMMMMMMMWXXWMMMMMMk.     
        .cooc,.    .,coo:.      `,
  linux: `
         .---.        
        /     \\       
       | () () |      
        \\  -  /       
       __\`===\`__      
      /         \\     
     | |       | |    
     | |       | |    
     \\  \\     /  /    
   ___\`--'---'--'___  
  /                 \\ 
 /  /\\           /\\  \\
 \\__) \\_________/ (__/`,
  win32: `
  .----------------.  .----------------. 
  | .--------------. || .--------------. |
  | | _____  _____ | || | _____  _____ | |
  | ||_   _||_   _|| || ||_   _||_   _|| |
  | |  | | /\\  | |  | || |  | | /\\  | |  | |
  | |  | |/  \\| |  | || |  | |/  \\| |  | |
  | |  |   /\\   |  | || |  |   /\\   |  | |
  | |  |__/  \\__|  | || |  |__/  \\__|  | |
  '----------------'  '----------------' `,
  fallback: `
     /\\_____/\\     
    /  o   o  \\    
   ( ==  ^  == )   
    )         (    
   (           )   
  ( (  )   (  ) )  
 (__(__)___(__)__) `,
};

// Update Fastfetch Terminal Card
function updateFastfetch(data) {
  const host = data.host || {};
  const cpu = data.cpu || {};
  const mem = data.memory || {};
  const primaryStorage = (data.storage && data.storage.primary) || {};
  const bat = data.battery || {};
  const gfx = data.graphics || {};
  const net = (data.network && data.network.primary) || {};
  const platform = host.platform || 'darwin';

  if (el.asciiLogo) {
    el.asciiLogo.textContent = (ASCII_LOGOS[platform] || ASCII_LOGOS.fallback).trim();
    if (platform === 'darwin') {
      el.asciiLogo.style.color = '#34d399';
    } else if (platform === 'linux') {
      el.asciiLogo.style.color = '#fbbf24';
    } else {
      el.asciiLogo.style.color = '#22d3ee';
    }
  }

  const hostname = host.hostname || 'system';
  if (el.termTitleHost) el.termTitleHost.textContent = hostname;
  if (el.hostnamePill) el.hostnamePill.textContent = hostname;
  if (el.specsTitle) el.specsTitle.textContent = `admin@${hostname}`;
  if (el.specsDivider) el.specsDivider.textContent = '─'.repeat(Math.max(20, hostname.length + 7));

  if (el.specOs) el.specOs.textContent = `${host.distro || host.type || 'OS'} ${host.release || ''}`;
  if (el.specHost) el.specHost.textContent = host.fqdn || hostname;
  if (el.specKernel) el.specKernel.textContent = host.kernel || '--';
  if (el.specUptime) el.specUptime.textContent = formatUptime(host.uptimeSeconds);
  if (el.specArch) el.specArch.textContent = host.architecture || '--';
  if (el.specNode) el.specNode.textContent = (data.process && data.process.nodeVersion) || '--';

  const cpuBrand = `${cpu.manufacturer || ''} ${cpu.brand || 'Processor'}`.trim();
  const cpuCores = cpu.physicalCores ? `${cpu.physicalCores}c/${cpu.logicalCores || cpu.physicalCores}t` : `${cpu.logicalCores || '--'} cores`;
  const cpuSpeed = cpu.speedGHz ? `@ ${cpu.speedGHz} GHz` : '';
  if (el.specCpu) el.specCpu.textContent = `${cpuBrand} (${cpuCores} ${cpuSpeed})`.trim();

  const gpuName = (gfx.controllers && gfx.controllers[0] && gfx.controllers[0].model) || 'Integrated Graphics';
  if (el.specGpu) el.specGpu.textContent = gpuName;

  const memUsed = formatBytes(mem.used);
  const memTotal = formatBytes(mem.total);
  const memPct = mem.usagePercent != null ? `${mem.usagePercent.toFixed(1)}%` : '--';
  if (el.specMem) el.specMem.textContent = `${memUsed} / ${memTotal} (${memPct})`;

  const diskUsed = formatBytes(primaryStorage.used);
  const diskTotal = formatBytes(primaryStorage.size);
  const diskPct = primaryStorage.usagePercent != null ? `${primaryStorage.usagePercent.toFixed(1)}%` : '--';
  if (el.specDisk) el.specDisk.textContent = `${diskUsed} / ${diskTotal} (${diskPct})`;

  const ipStr = net.ip4 ? `${net.ip4} (${net.iface || 'eth0'})` : '127.0.0.1';
  if (el.specIp) el.specIp.textContent = ipStr;

  if (bat.hasBattery) {
    if (el.specBatRow) el.specBatRow.style.display = 'flex';
    const state = bat.isCharging ? '⚡ Charging' : '🔋 Discharging';
    if (el.specBat) el.specBat.textContent = `${bat.percent}% [${state}]`;
  } else if (el.specBatRow) {
    el.specBatRow.style.display = 'none';
  }

  if (el.uptimePill) el.uptimePill.textContent = formatUptime(host.uptimeSeconds);
}

// Update Telemetry Gauges
function updateGauges(data) {
  const cpu = data.cpu || {};
  const mem = data.memory || {};
  const storage = (data.storage && data.storage.primary) || {};
  const temp = data.temperature || {};
  const bat = data.battery || {};

  // CPU
  const cpuPct = cpu.usagePercent != null ? cpu.usagePercent : 0;
  if (el.valCpu) el.valCpu.textContent = `${cpuPct.toFixed(1)}%`;
  if (el.barCpu) {
    el.barCpu.style.width = `${Math.min(100, Math.max(0, cpuPct))}%`;
    if (cpuPct > 85) el.barCpu.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    else el.barCpu.style.background = '';
  }
  if (el.metaCpu) el.metaCpu.textContent = `User: ${cpu.userPercent || 0}% • System: ${cpu.systemPercent || 0}%`;

  // Memory
  const memPct = mem.usagePercent != null ? mem.usagePercent : 0;
  if (el.valMem) el.valMem.textContent = `${memPct.toFixed(1)}%`;
  if (el.barMem) {
    el.barMem.style.width = `${Math.min(100, Math.max(0, memPct))}%`;
    if (memPct > 85) el.barMem.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    else el.barMem.style.background = '';
  }
  if (el.metaMem) el.metaMem.textContent = `${formatBytes(mem.used)} used of ${formatBytes(mem.total)}`;

  // Disk
  const diskPct = storage.usagePercent != null ? storage.usagePercent : 0;
  if (el.valDisk) el.valDisk.textContent = `${diskPct.toFixed(1)}%`;
  if (el.barDisk) el.barDisk.style.width = `${Math.min(100, Math.max(0, diskPct))}%`;
  if (el.metaDisk) el.metaDisk.textContent = `${storage.mount || '/'}: ${formatBytes(storage.used)} / ${formatBytes(storage.size)}`;

  // Temp
  if (temp.current != null) {
    if (el.valTemp) el.valTemp.textContent = `${temp.current.toFixed(1)}°C`;
    const tempPct = Math.min(100, Math.max(0, (temp.current / 100) * 100));
    if (el.barTemp) el.barTemp.style.width = `${tempPct}%`;
    if (el.metaTemp) el.metaTemp.textContent = temp.current > 75 ? '🔥 High Thermal Load' : 'Normal Operating Temp';
  } else {
    if (el.valTemp) el.valTemp.textContent = 'N/A';
    if (el.barTemp) el.barTemp.style.width = '0%';
    if (el.metaTemp) el.metaTemp.textContent = 'No sensor probe';
  }

  // Load
  if (Array.isArray(cpu.averages) && cpu.averages.length) {
    const [one, five, fifteen] = cpu.averages;
    if (el.valLoad) el.valLoad.textContent = `${one.toFixed(2)}`;
    const loadPct = Math.min(100, Math.max(0, (one / (cpu.logicalCores || 4)) * 100));
    if (el.barLoad) el.barLoad.style.width = `${loadPct}%`;
    if (el.metaLoad) el.metaLoad.textContent = `1m: ${one.toFixed(2)} • 5m: ${five.toFixed(2)} • 15m: ${fifteen.toFixed(2)}`;
  }

  // Battery
  if (bat.hasBattery && bat.percent != null) {
    if (el.valBat) el.valBat.textContent = `${bat.percent}%`;
    if (el.barBat) el.barBat.style.width = `${bat.percent}%`;
    if (el.metaBat) el.metaBat.textContent = bat.isCharging ? '⚡ Connected to AC' : '🔋 Running on Battery';
  } else {
    if (el.valBat) el.valBat.textContent = 'AC Power';
    if (el.barBat) el.barBat.style.width = '100%';
    if (el.metaBat) el.metaBat.textContent = 'Desktop / AC Adapter';
  }
}

// Update Multi-Core CPU Breakdown
function updateCores(perCoreCpu) {
  if (!el.coresGrid) return;
  if (!Array.isArray(perCoreCpu) || !perCoreCpu.length) {
    el.coresGrid.innerHTML = '<div class="empty-hint">No per-core data available</div>';
    return;
  }

  if (el.coreCountBadge) {
    el.coreCountBadge.textContent = `${perCoreCpu.length} Threads`;
  }

  const html = perCoreCpu.map((c) => {
    const load = c.load != null ? c.load : 0;
    const colorClass = load > 85 ? '#ef4444' : load > 60 ? '#f59e0b' : '#06b6d4';
    return `
      <div class="core-item">
        <div class="core-label-row">
          <span class="core-name">Core ${c.core}</span>
          <span class="core-load">${load.toFixed(1)}%</span>
        </div>
        <div class="core-track">
          <div class="core-fill" style="width: ${Math.min(100, Math.max(0, load))}%; background: ${colorClass};"></div>
        </div>
      </div>
    `;
  }).join('');

  el.coresGrid.innerHTML = html;
}

// Update Storage Volumes
function updateStorageTable(volumes) {
  if (!el.storageTbody) return;
  if (!Array.isArray(volumes) || !volumes.length) {
    el.storageTbody.innerHTML = '<tr><td colspan="6" class="loading-row">No volumes detected</td></tr>';
    return;
  }

  if (el.volumeCount) {
    el.volumeCount.textContent = `${volumes.length} Volumes`;
  }

  const rows = volumes.map((v) => {
    const use = v.usagePercent != null ? v.usagePercent : 0;
    const barColor = use > 90 ? '#ef4444' : use > 75 ? '#f59e0b' : '#8b5cf6';
    return `
      <tr>
        <td><strong>${v.mount}</strong></td>
        <td>${v.fileSystem || v.type || '--'}</td>
        <td>${formatBytes(v.used)}</td>
        <td>${formatBytes(v.available)}</td>
        <td>${formatBytes(v.size)}</td>
        <td>
          <div class="cell-usage">
            <div class="mini-track">
              <div class="mini-fill" style="width: ${Math.min(100, Math.max(0, use))}%; background: ${barColor};"></div>
            </div>
            <span>${use.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  el.storageTbody.innerHTML = rows;
}

// Update Network Adapters
function updateNetwork(network) {
  if (!el.networkList) return;
  const interfaces = (network && network.interfaces) || [];
  if (!interfaces.length && network && network.primary) {
    interfaces.push(network.primary);
  }

  if (!interfaces.length) {
    el.networkList.innerHTML = '<div class="empty-hint">No active network adapters</div>';
    return;
  }

  const html = interfaces.map((net) => {
    const isUp = net.operstate === 'up' || Boolean(net.ip4);
    const statusClass = isUp ? 'status-up' : 'status-down';
    const statusText = isUp ? 'ACTIVE' : 'INACTIVE';
    return `
      <div class="net-adapter">
        <div class="net-adapter-header">
          <span class="net-iface">${net.iface}</span>
          <span class="net-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="net-specs">
          <div>IPv4: <span>${net.ip4 || '--'}</span></div>
          <div>Type: <span>${net.type || 'ethernet'}</span></div>
          <div>MAC: <span>${net.mac || '--'}</span></div>
          <div>Speed: <span>${net.speed ? net.speed + ' Mbps' : 'Auto'}</span></div>
        </div>
      </div>
    `;
  }).join('');

  el.networkList.innerHTML = html;
}

// Update Process Explorer
function updateProcessTable(processes, query = '') {
  if (!el.processTbody) return;
  if (!Array.isArray(processes) || !processes.length) {
    el.processTbody.innerHTML = '<tr><td colspan="6" class="loading-row">No process telemetry available</td></tr>';
    return;
  }

  let filtered = processes;
  if (query) {
    const q = query.toLowerCase();
    filtered = processes.filter((p) => p.name && p.name.toLowerCase().includes(q));
  }

  if (!filtered.length) {
    el.processTbody.innerHTML = '<tr><td colspan="6" class="loading-row">No matching processes found</td></tr>';
    return;
  }

  const rows = filtered.map((p) => {
    const cpu = p.cpu != null ? p.cpu.toFixed(1) : '0.0';
    const mem = p.mem != null ? p.mem.toFixed(1) : '0.0';
    return `
      <tr>
        <td><code>${p.pid}</code></td>
        <td>${p.name}</td>
        <td><strong>${cpu}%</strong></td>
        <td>${mem}%</td>
        <td>${p.user || 'system'}</td>
        <td><span class="net-status-badge status-up">${p.state || 'running'}</span></td>
      </tr>
    `;
  }).join('');

  el.processTbody.innerHTML = rows;
}

// Draw Performance Chart on Canvas
function drawPerfChart() {
  const canvas = el.perfChart;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Background grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (perfHistory.length < 2) {
    ctx.restore();
    return;
  }

  const step = w / (HISTORY_LIMIT - 1);
  const startX = w - (perfHistory.length - 1) * step;

  // Helper to draw a line
  function drawLine(key, strokeStyle, fillStyle) {
    ctx.beginPath();
    perfHistory.forEach((pt, i) => {
      const val = pt[key] != null ? pt[key] : 0;
      const x = startX + i * step;
      const y = h - (val / 100) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (fillStyle) {
      ctx.lineTo(w, h);
      ctx.lineTo(startX, h);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  // Memory (green)
  drawLine('mem', '#10b981', 'rgba(16, 185, 129, 0.08)');
  // CPU (cyan)
  drawLine('cpu', '#06b6d4', 'rgba(6, 182, 212, 0.12)');

  ctx.restore();
}

// Fetch Main System Telemetry
async function fetchSystemData() {
  try {
    const res = await fetch('/api/system');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastSnapshot = data;

    updateFastfetch(data);
    updateGauges(data);
    updateCores(data.perCoreCpu);
    updateStorageTable(data.storage && data.storage.volumes);
    updateNetwork(data.network);

    const query = el.processSearch ? el.processSearch.value : '';
    updateProcessTable(data.processes, query);

    // Push into chart history
    const cpuVal = (data.cpu && data.cpu.usagePercent) || 0;
    const memVal = (data.memory && data.memory.usagePercent) || 0;
    perfHistory.push({ cpu: cpuVal, mem: memVal, time: Date.now() });
    if (perfHistory.length > HISTORY_LIMIT) perfHistory.shift();
    drawPerfChart();

    if (el.footerSampled) {
      el.footerSampled.textContent = `Last Sample: ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.error('Failed to fetch system telemetry:', err);
    if (el.hostStatus) el.hostStatus.textContent = 'RECONNECTING...';
  }
}

// Polling manager
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (pollInterval > 0) {
    pollTimer = setInterval(fetchSystemData, pollInterval);
  }
}

// Setup Event Listeners
function setupEvents() {
  if (el.pollRate) {
    el.pollRate.addEventListener('change', (e) => {
      pollInterval = Number(e.target.value);
      startPolling();
      showToast(pollInterval > 0 ? `Polling set to ${pollInterval / 1000}s` : 'Polling paused');
    });
  }

  if (el.refreshBtn) {
    el.refreshBtn.addEventListener('click', () => {
      fetchSystemData();
      showToast('Refreshing telemetry...');
    });
  }

  el.copyCliBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch('/cli');
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        showToast('Fastfetch specs copied to clipboard!');
      } catch (err) {
        showToast('Failed to copy specs');
      }
    });
  });

  if (el.copyCurlBtn) {
    el.copyCurlBtn.addEventListener('click', async () => {
      const curlCmd = `curl ${window.location.origin}/`;
      await navigator.clipboard.writeText(curlCmd);
      showToast('Copied: ' + curlCmd);
    });
  }

  if (el.exportJsonBtn) {
    el.exportJsonBtn.addEventListener('click', () => {
      if (!lastSnapshot) {
        showToast('No snapshot data ready yet');
        return;
      }
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(lastSnapshot, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `sysinfo-snapshot-${Date.now()}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Exported system telemetry JSON!');
    });
  }

  if (el.processSearch) {
    el.processSearch.addEventListener('input', (e) => {
      if (lastSnapshot && lastSnapshot.processes) {
        updateProcessTable(lastSnapshot.processes, e.target.value);
      }
    });
  }

  window.addEventListener('resize', drawPerfChart);
}

// Boot
setupEvents();
fetchSystemData();
startPolling();
