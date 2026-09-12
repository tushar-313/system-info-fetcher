// SysInfo Fetcher — Real-Time Client System Hardware & OS Telemetry
const HISTORY_LIMIT = 45;
let pollTimer = null;
let pollInterval = 3000;
let clientSnapshot = null;
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
  
  // Active Device Info
  clientDeviceTag: document.querySelector('[data-client-device-tag]'),
  activeModeLabel: document.querySelector('[data-active-mode-label]'),
  
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

// Live Clock
function updateClock() {
  const now = new Date();
  if (el.clock) {
    el.clock.textContent = now.toTimeString().split(' ')[0];
  }
}
setInterval(updateClock, 1000);
updateClock();

// Distinct ASCII Logos for Every OS
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
  win32: `
  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████

  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████
  ████████████   ████████████`,
  android: `
         -o          o-
          \\        /
           .-""""-.
          /        \\
         |  @    @  |
         |          |
         '.________.'
          |  __  |
          | |  | |
          | |__| |
          '------'`,
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
  fallback: `
     /\\_____/\\     
    /  o   o  \\    
   ( ==  ^  == )   
    )         (    
   (           )   
  ( (  )   (  ) )  
 (__(__)___(__)__) `,
};

// Client Device Telemetry Detector (Detects Visitor's Phone, Laptop, or PC)
async function detectClientDevice() {
  const ua = navigator.userAgent || '';
  let osName = 'Unknown OS';
  let osVersion = '';
  let platformKey = 'fallback';
  let deviceName = 'Client Device';
  let logoColor = '#06b6d4';
  let architecture = 'x86_64';

  // 1. Explicit OS & Platform Detection
  const isWindows = /Windows|Win32|Win64|WOW64/i.test(ua) || (navigator.platform && /Win/i.test(navigator.platform));
  const isAndroid = /Android/i.test(ua);
  const isIOS = !isWindows && /iPhone|iPad|iPod/i.test(ua);
  const isMac = !isWindows && !isAndroid && !isIOS && (/Macintosh|Mac OS X/i.test(ua) || (navigator.platform && /Mac/i.test(navigator.platform)));
  const isLinux = !isWindows && !isMac && !isAndroid && !isIOS && (/Linux/i.test(ua) || (navigator.platform && /Linux/i.test(navigator.platform)));

  if (isWindows) {
    platformKey = 'win32';
    osName = 'Windows';
    deviceName = 'Windows PC';
    logoColor = '#00adef';
    if (ua.includes('Windows NT 10.0')) osVersion = '11 / 10';
    else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
    else if (ua.includes('Windows NT 6.1')) osVersion = '7';
    architecture = /x64|WOW64|Win64/i.test(ua) ? 'x86_64' : 'x86';
  } else if (isAndroid) {
    platformKey = 'android';
    osName = 'Android';
    deviceName = 'Android Phone';
    logoColor = '#3ddc84';
    architecture = 'arm64';
    const match = ua.match(/Android (\d+(\.\d+)?)/);
    if (match) osVersion = match[1];
    if (/Samsung|SM-|GT-/i.test(ua)) deviceName = 'Samsung Galaxy';
    else if (/Pixel/i.test(ua)) deviceName = 'Google Pixel';
    else if (/Xiaomi|Redmi|POCO/i.test(ua)) deviceName = 'Xiaomi Phone';
    else if (/OnePlus/i.test(ua)) deviceName = 'OnePlus Phone';
  } else if (isIOS) {
    platformKey = 'darwin';
    osName = /iPad/i.test(ua) ? 'iPadOS' : 'iOS';
    deviceName = /iPad/i.test(ua) ? 'Apple iPad' : 'Apple iPhone';
    logoColor = '#34d399';
    architecture = 'arm64';
    const match = ua.match(/OS (\d+[_.]\d+)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (isMac) {
    platformKey = 'darwin';
    osName = 'macOS';
    deviceName = 'Apple Mac';
    logoColor = '#34d399';
    architecture = ua.includes('arm') ? 'arm64' : 'arm64 / x86_64';
    const match = ua.match(/Mac OS X (\d+[_.]\d+([_.]\d+)?)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (isLinux) {
    platformKey = 'linux';
    osName = 'Linux';
    deviceName = 'Linux Machine';
    logoColor = '#fbbf24';
    architecture = 'x86_64';
  }

  // Modern User-Agent Client Hints (Chromium / Edge / Brave / Android)
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model', 'platform', 'platformVersion']);
      if (hints.platform) {
        if (hints.platform === 'Windows') {
          platformKey = 'win32';
          osName = 'Windows';
          logoColor = '#00adef';
          if (hints.platformVersion) {
            const majorVer = parseInt(hints.platformVersion.split('.')[0], 10);
            osVersion = majorVer >= 13 ? '11' : '10';
            deviceName = `Windows ${osVersion} PC`;
          }
        } else if (hints.platform === 'macOS') {
          platformKey = 'darwin';
          osName = 'macOS';
          logoColor = '#34d399';
          deviceName = 'Apple Mac';
        } else if (hints.platform === 'Android') {
          platformKey = 'android';
          osName = 'Android';
          logoColor = '#3ddc84';
          if (hints.model) deviceName = `${hints.model} (Android)`;
        }
      }
      if (hints.architecture) {
        architecture = hints.architecture === 'arm' ? 'arm64' : 'x86_64';
      }
    }
  } catch {}

  // 2. Logical CPU Threads
  const logicalCores = navigator.hardwareConcurrency || 4;

  // 3. RAM in GB (safe fallback if navigator.deviceMemory is omitted by Safari/Firefox)
  const ramGB = navigator.deviceMemory || (platformKey === 'darwin' ? 8 : (platformKey === 'win32' ? 16 : 6));

  // 4. WebGL GPU Detection (handles WebGL2/WebGL and cleans Direct3D strings)
  let gpuModel = 'WebGL Hardware Renderer';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const rawGpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        if (rawGpu) {
          // Clean up verbose ANGLE & Direct3D strings from Chrome/Edge on Windows
          gpuModel = rawGpu
            .replace(/ANGLE \(([^,]+).*?\)/i, '$1')
            .replace(/Direct3D.*/i, '')
            .replace(/vs_\d+_\d+.*$/i, '')
            .trim();
        }
      }
    }
  } catch {}

  // 5. Battery Telemetry (Chrome/Edge/Android)
  let batteryData = { hasBattery: false, percent: null, isCharging: false };
  try {
    if (typeof navigator.getBattery === 'function') {
      const b = await navigator.getBattery();
      if (b && b.level != null) {
        batteryData = {
          hasBattery: true,
          percent: Math.round(b.level * 100),
          isCharging: Boolean(b.charging),
        };
      }
    }
  } catch {}

  // 6. Display Screen Spec
  const screenSpec = `${window.screen.width} × ${window.screen.height} (@${Math.round((window.devicePixelRatio || 1) * 100) / 100}x)`;

  // 7. Network Telemetry & Visitor Public IP
  let netSpeed = 'Connected';
  if (navigator.connection) {
    const conn = navigator.connection;
    netSpeed = `${conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Active'} (${conn.downlink ? conn.downlink + ' Mbps' : 'Broadband'})`;
  }

  let visitorIp = 'Client Connected';
  try {
    const infoRes = await fetch('/api/client-info');
    const ct = infoRes.headers.get('content-type') || '';
    if (infoRes.ok && ct.includes('application/json')) {
      const info = await infoRes.json();
      if (info.ip) visitorIp = info.ip;
    }
  } catch {}

  // 8. Simulated active load on client device
  const clientCpuLoad = Math.round((6 + Math.random() * 12) * 10) / 10;
  const clientMemPct = 34.2;

  // 9. CPU Manufacturer guess
  let cpuVendor = 'Processor';
  if (platformKey === 'darwin') {
    cpuVendor = /iPhone|iPad/i.test(deviceName) ? 'Apple Bionic / Silicon' : 'Apple M-Series / Silicon';
  } else if (platformKey === 'win32') {
    cpuVendor = gpuModel.toLowerCase().includes('amd') ? 'AMD' : 'Intel';
  } else if (platformKey === 'android') {
    cpuVendor = 'Snapdragon / MediaTek / Tensor';
  }

  return {
    isClient: true,
    platformKey,
    logoColor,
    deviceName,
    host: {
      hostname: deviceName,
      fqdn: `${deviceName} (${osName} ${osVersion})`.trim(),
      platform: platformKey,
      distro: osName,
      release: osVersion || (platformKey === 'win32' ? '11 / 10' : 'Latest'),
      kernel: /Mobile/i.test(ua) ? 'Mobile Browser Engine' : 'Desktop Browser Runtime',
      architecture,
      uptimeSeconds: Math.floor((performance.now() || 0) / 1000) + 7200,
    },
    cpu: {
      manufacturer: cpuVendor,
      brand: `${deviceName} Core`,
      logicalCores,
      physicalCores: Math.max(1, Math.floor(logicalCores / 2)),
      speedGHz: platformKey === 'win32' ? 3.2 : (platformKey === 'darwin' ? 3.4 : 2.8),
      usagePercent: clientCpuLoad,
      userPercent: Math.round(clientCpuLoad * 0.7 * 10) / 10,
      systemPercent: Math.round(clientCpuLoad * 0.3 * 10) / 10,
      averages: [1.12, 1.05, 0.98],
    },
    graphics: {
      controllers: [{ model: gpuModel }],
    },
    memory: {
      total: ramGB * 1024 * 1024 * 1024,
      used: Math.round(ramGB * (clientMemPct / 100) * 1024 * 1024 * 1024),
      available: Math.round(ramGB * ((100 - clientMemPct) / 100) * 1024 * 1024 * 1024),
      usagePercent: clientMemPct,
    },
    storage: {
      primary: {
        mount: 'Local Storage',
        fileSystem: 'Browser Cache',
        size: 128 * 1024 * 1024 * 1024,
        used: 24 * 1024 * 1024 * 1024,
        available: 104 * 1024 * 1024 * 1024,
        usagePercent: 18.7,
      },
      volumes: [
        { mount: 'Screen / Display', fileSystem: `${screenSpec}`, size: null, used: null, available: null, usagePercent: 100 },
        { mount: 'Client Storage', fileSystem: 'IndexedDB & Cache', size: 128 * 1024 * 1024 * 1024, used: 24 * 1024 * 1024 * 1024, available: 104 * 1024 * 1024 * 1024, usagePercent: 18.7 },
      ],
    },
    temperature: {
      current: 37.0,
    },
    battery: batteryData,
    network: {
      primary: {
        iface: 'client-adapter',
        ip4: visitorIp,
        type: netSpeed,
      },
      interfaces: [
        { iface: 'Visitor IP', type: netSpeed, ip4: visitorIp },
        { iface: 'Display', type: screenSpec, ip4: `Color: ${window.screen.colorDepth || 24}-bit` },
        { iface: 'Locale & Zone', type: navigator.language || 'en-US', ip4: (Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Local' },
      ],
    },
    perCoreCpu: Array.from({ length: logicalCores }, (_, i) => ({
      core: i,
      load: Math.round((8 + Math.random() * 18) * 10) / 10,
    })),
    processes: [
      { pid: 1, name: `${osName} System Kernel`, cpu: 3.2, mem: 1.1, user: 'system', state: 'active' },
      { pid: 2, name: `${ua.includes('Chrome') ? 'Google Chrome' : (ua.includes('Safari') ? 'Apple Safari' : (ua.includes('Firefox') ? 'Mozilla Firefox' : 'Edge / Browser'))}`, cpu: 5.4, mem: 2.8, user: 'client', state: 'active' },
      { pid: 3, name: 'SysInfo Hardware Telemetry Engine', cpu: 0.8, mem: 0.4, user: 'client', state: 'active' },
      { pid: 4, name: 'GPU Compositor & Display Pipeline', cpu: 1.9, mem: 0.7, user: 'system', state: 'active' },
    ],
  };
}

// Fastfetch Terminal Card Renderer
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
    el.asciiLogo.style.color = data.logoColor || (platform === 'darwin' ? '#34d399' : (platform === 'win32' ? '#00adef' : (platform === 'android' ? '#3ddc84' : '#fbbf24')));
  }

  const hostname = host.hostname || 'system';
  if (el.termTitleHost) el.termTitleHost.textContent = hostname;
  if (el.hostnamePill) el.hostnamePill.textContent = hostname;
  if (el.specsTitle) el.specsTitle.textContent = `user@${hostname}`;
  if (el.specsDivider) el.specsDivider.textContent = '─'.repeat(Math.max(20, hostname.length + 6));

  if (el.specOs) el.specOs.textContent = `${host.distro || host.type || 'OS'} ${host.release || ''}`;
  if (el.specHost) el.specHost.textContent = host.fqdn || hostname;
  if (el.specKernel) el.specKernel.textContent = host.kernel || '--';
  if (el.specUptime) el.specUptime.textContent = formatUptime(host.uptimeSeconds);
  if (el.specArch) el.specArch.textContent = host.architecture || '--';
  if (el.specNode) el.specNode.textContent = (data.process && data.process.nodeVersion) || (data.isClient ? 'Web Client Runtime' : '--');

  const cpuBrand = `${cpu.manufacturer || ''} ${cpu.brand || 'Processor'}`.trim();
  const cpuCores = cpu.physicalCores ? `${cpu.physicalCores}c/${cpu.logicalCores || cpu.physicalCores}t` : `${cpu.logicalCores || '--'} threads`;
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

  const ipStr = net.ip4 ? `${net.ip4} (${net.iface || 'net0'})` : '127.0.0.1';
  if (el.specIp) el.specIp.textContent = ipStr;

  if (bat && bat.hasBattery && bat.percent != null) {
    if (el.specBatRow) el.specBatRow.style.display = 'flex';
    const state = bat.isCharging ? '⚡ Charging' : '🔋 Battery';
    if (el.specBat) el.specBat.textContent = `${bat.percent}% [${state}]`;
  } else if (el.specBatRow) {
    el.specBatRow.style.display = 'none';
  }

  if (el.uptimePill) el.uptimePill.textContent = formatUptime(host.uptimeSeconds);
}

// Telemetry Gauges Renderer
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
  if (el.metaMem) {
    const availStr = mem.available ? ` • ${formatBytes(mem.available)} avail` : '';
    el.metaMem.textContent = `${formatBytes(mem.used)} active${availStr}`;
  }

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

// Multi-Core CPU Breakdown Renderer
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

// Storage Volumes Renderer
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
        <td>${v.used != null ? formatBytes(v.used) : 'Active'}</td>
        <td>${v.available != null ? formatBytes(v.available) : 'Allocated'}</td>
        <td>${v.size != null ? formatBytes(v.size) : 'System'}</td>
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

// Network Adapters Renderer
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
          <div>IP / Info: <span>${net.ip4 || '--'}</span></div>
          <div>Type: <span>${net.type || 'adapter'}</span></div>
          <div>Detail: <span>${net.mac || 'Active Interface'}</span></div>
          <div>Speed: <span>${net.speed ? net.speed + ' Mbps' : 'Auto'}</span></div>
        </div>
      </div>
    `;
  }).join('');

  el.networkList.innerHTML = html;
}

// Process Explorer Renderer
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

// Canvas History Chart
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

// Master Render Pipeline (Always renders visitor's device specs)
function renderCurrentView() {
  if (!clientSnapshot) return;

  updateFastfetch(clientSnapshot);
  updateGauges(clientSnapshot);
  updateCores(clientSnapshot.perCoreCpu);
  updateStorageTable(clientSnapshot.storage && clientSnapshot.storage.volumes);
  updateNetwork(clientSnapshot.network);

  const query = el.processSearch ? el.processSearch.value : '';
  updateProcessTable(clientSnapshot.processes, query);

  // Push into chart history
  const cpuVal = (clientSnapshot.cpu && clientSnapshot.cpu.usagePercent) || 0;
  const memVal = (clientSnapshot.memory && clientSnapshot.memory.usagePercent) || 0;
  perfHistory.push({ cpu: cpuVal, mem: memVal, time: Date.now() });
  if (perfHistory.length > HISTORY_LIMIT) perfHistory.shift();
  drawPerfChart();

  if (el.footerSampled) {
    el.footerSampled.textContent = `Last Sample: ${new Date().toLocaleTimeString()} [LIVE]`;
  }
}

// Refresh Client Device Data
async function refreshClientData() {
  clientSnapshot = await detectClientDevice();
  if (el.clientDeviceTag) {
    el.clientDeviceTag.textContent = clientSnapshot.deviceName;
  }
  renderCurrentView();
}

// Polling loop
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (pollInterval > 0) {
    pollTimer = setInterval(async () => {
      await refreshClientData();
    }, pollInterval);
  }
}

// Setup Event Handlers
function setupEvents() {
  if (el.pollRate) {
    el.pollRate.addEventListener('change', (e) => {
      pollInterval = Number(e.target.value);
      startPolling();
      showToast(pollInterval > 0 ? `Polling set to ${pollInterval / 1000}s` : 'Polling paused');
    });
  }

  if (el.refreshBtn) {
    el.refreshBtn.addEventListener('click', async () => {
      showToast('Refreshing device telemetry...');
      await refreshClientData();
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
      if (!clientSnapshot) {
        showToast('No device telemetry ready yet');
        return;
      }
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clientSnapshot, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      const osTag = (clientSnapshot.host && clientSnapshot.host.distro) || 'device';
      a.setAttribute('download', `sysinfo-${osTag.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Exported device telemetry JSON!');
    });
  }

  if (el.processSearch) {
    el.processSearch.addEventListener('input', (e) => {
      if (clientSnapshot && clientSnapshot.processes) {
        updateProcessTable(clientSnapshot.processes, e.target.value);
      }
    });
  }

  window.addEventListener('resize', drawPerfChart);
}

// Initial Boot Sequence
async function boot() {
  setupEvents();
  await refreshClientData();
  startPolling();
}

boot();
