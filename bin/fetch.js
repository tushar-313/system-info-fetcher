#!/usr/bin/env node
const os = require('os');
const si = require('systeminformation');

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function bytesLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function uptimeLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(' ');
}

function getAsciiLogo(platform) {
  if (platform === 'darwin') {
    return [
      `${c.brightGreen}                    'c.          `,
      `${c.brightGreen}                 ,xNMM.          `,
      `${c.brightGreen}               .OMMMMo           `,
      `${c.brightGreen}               lMM\"              `,
      `${c.brightGreen}     .;loddo:.  .olloddol;.      `,
      `${c.brightGreen}   cKMMMMMMMMMMNWMMMMMMMMMM0:    `,
      `${c.yellow} .KMMMMMMMMMMMMMMMMMMMMMMMWd.   `,
      `${c.yellow} XMMMMMMMMMMMMMMMMMMMMMMMX.     `,
      `${c.red};MMMMMMMMMMMMMMMMMMMMMMMM:     `,
      `${c.red}:MMMMMMMMMMMMMMMMMMMMMMMM:     `,
      `${c.magenta}.MMMMMMMMMMMMMMMMMMMMMMMMX.    `,
      `${c.magenta} kMMMMMMMMMMMMMMMMMMMMMMMMWd.  `,
      `${c.blue}  .XMMMMMMMMMMMMMMMMMMMMMMMMk   `,
      `${c.blue}   .XMMMMMMMMMMMMMMMMMMMMMMK.   `,
      `${c.cyan}     kMMMMMMMMMMMMMMMMMMMMd     `,
      `${c.cyan}      ;KMMMMMMMWXXWMMMMMMk.     `,
      `${c.cyan}        .cooc,.    .,coo:.      `,
    ];
  } else if (platform === 'linux') {
    return [
      `${c.yellow}         .---.        `,
      `${c.yellow}        /     \\       `,
      `${c.white}       | () () |      `,
      `${c.yellow}        \\  -  /       `,
      `${c.yellow}       __\`===\`__      `,
      `${c.cyan}      /         \\     `,
      `${c.cyan}     | |       | |    `,
      `${c.cyan}     | |       | |    `,
      `${c.yellow}     \\  \\     /  /    `,
      `${c.yellow}   ___\`--'---'--'___  `,
      `${c.yellow}  /                 \\ `,
      `${c.yellow} /  /\\           /\\  \\`,
      `${c.yellow} \\__) \\_________/ (__/`,
    ];
  } else if (platform === 'win32') {
    return [
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      ``,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
      `${c.brightCyan}  ████████████   ████████████`,
    ];
  }

  return [
    `${c.brightCyan}     /\\_____/\\     `,
    `${c.brightCyan}    /  o   o  \\    `,
    `${c.brightCyan}   ( ==  ^  == )   `,
    `${c.brightCyan}    )         (    `,
    `${c.brightCyan}   (           )   `,
    `${c.brightCyan}  ( (  )   (  ) )  `,
    `${c.brightCyan} (__(__)___(__)__) `,
  ];
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function getFetchString() {
  const [cpu, mem, osInfo, load, time, fsSize, bat, gfx, net] = await Promise.all([
    safe(() => si.cpu(), {}),
    safe(() => si.mem(), {}),
    safe(() => si.osInfo(), {}),
    safe(() => si.currentLoad(), {}),
    safe(() => si.time(), {}),
    safe(() => si.fsSize(), []),
    safe(() => si.battery(), {}),
    safe(() => si.graphics(), {}),
    safe(() => si.networkInterfaces(), []),
  ]);

  const username = os.userInfo().username || 'user';
  const hostname = os.hostname();
  const platform = os.platform();
  const title = `${c.bold}${c.brightCyan}${username}${c.white}@${c.brightGreen}${hostname}${c.reset}`;
  const separator = `${c.dim}${'─'.repeat(username.length + hostname.length + 1)}${c.reset}`;

  const primaryDisk = (Array.isArray(fsSize) && fsSize.find(f => f.mount === '/' || f.mount === '/System/Volumes/Data')) || fsSize[0] || {};
  const diskUsed = primaryDisk.used ? bytesLabel(primaryDisk.used) : 'N/A';
  const diskTotal = primaryDisk.size ? bytesLabel(primaryDisk.size) : 'N/A';
  const diskPct = primaryDisk.use ? `${primaryDisk.use.toFixed(1)}%` : 'N/A';

  const effectiveMemUsed = (Number.isFinite(mem.available) && mem.available > 0)
    ? (mem.total - mem.available)
    : (mem.active || mem.used || 0);
  const memUsed = effectiveMemUsed ? bytesLabel(effectiveMemUsed) : 'N/A';
  const memTotal = mem.total ? bytesLabel(mem.total) : 'N/A';
  const memPct = mem.total ? ((effectiveMemUsed / mem.total) * 100).toFixed(1) : '0';

  const primaryNet = Array.isArray(net) ? net.find(n => n.ip4 && n.ip4 !== '127.0.0.1' && !n.internal) || net[0] : null;
  const ipAddress = primaryNet ? primaryNet.ip4 : '127.0.0.1';

  const gpuName = (gfx && gfx.controllers && gfx.controllers[0] && gfx.controllers[0].model) || 'Integrated Graphics';

  const infoLines = [
    title,
    separator,
    `${c.bold}${c.brightCyan}OS${c.reset}:        ${osInfo.distro || os.type()} ${osInfo.release || os.release()} (${os.arch()})`,
    `${c.bold}${c.brightCyan}Host${c.reset}:      ${osInfo.fqdn || hostname}`,
    `${c.bold}${c.brightCyan}Kernel${c.reset}:    ${osInfo.kernel || os.release()}`,
    `${c.bold}${c.brightCyan}Uptime${c.reset}:    ${uptimeLabel(os.uptime())}`,
    `${c.bold}${c.brightCyan}Shell${c.reset}:     ${process.env.SHELL || 'zsh'}`,
    `${c.bold}${c.brightCyan}Node.js${c.reset}:   ${process.version}`,
    `${c.bold}${c.brightCyan}CPU${c.reset}:       ${cpu.manufacturer || ''} ${cpu.brand || 'Processor'} (${cpu.physicalCores || cpu.cores || 'N/A'} cores @ ${cpu.speed || 'N/A'} GHz)`,
    `${c.bold}${c.brightCyan}CPU Load${c.reset}:  ${load.currentLoad ? load.currentLoad.toFixed(1) : '0.0'}% [${load.cpus ? load.cpus.length : 'N/A'} threads]`,
    `${c.bold}${c.brightCyan}GPU${c.reset}:       ${gpuName}`,
    `${c.bold}${c.brightCyan}Memory${c.reset}:    ${memUsed} / ${memTotal} (${memPct}%)`,
    `${c.bold}${c.brightCyan}Disk (/)${c.reset}:   ${diskUsed} / ${diskTotal} (${diskPct})`,
    `${c.bold}${c.brightCyan}Local IP${c.reset}:   ${ipAddress} (${primaryNet ? primaryNet.iface : 'lo0'})`,
  ];

  if (bat && bat.hasBattery) {
    const batState = bat.isCharging ? '⚡ Charging' : '🔋 Discharging';
    infoLines.push(`${c.bold}${c.brightCyan}Battery${c.reset}:   ${bat.percent}% [${batState}]`);
  }

  // Add ANSI Color palette blocks
  const colorsRow1 = [c.red, c.green, c.yellow, c.blue, c.magenta, c.cyan, c.white]
    .map(color => `${color}███${c.reset}`)
    .join(' ');
  const colorsRow2 = [c.red, c.green, c.yellow, c.blue, c.magenta, c.cyan, c.white]
    .map(color => `${c.dim}${color}███${c.reset}`)
    .join(' ');

  infoLines.push('');
  infoLines.push(colorsRow1);
  infoLines.push(colorsRow2);

  const logoLines = getAsciiLogo(platform);
  const maxLines = Math.max(logoLines.length, infoLines.length);

  const lines = [''];
  for (let i = 0; i < maxLines; i++) {
    const left = logoLines[i] || ' '.repeat(34);
    const right = infoLines[i] || '';
    lines.push(`${left.padEnd(34)}  ${right}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function run() {
  const output = await getFetchString();
  console.log(output);
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { run, getFetchString };
