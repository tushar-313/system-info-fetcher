# SysInfo Fetcher

> Modern real-time System Information Fetcher & Hardware Telemetry Platform.

SysInfo Fetcher collects and displays deep hardware, OS, and process telemetry from the host machine running it. It features a futuristic, responsive Web Dashboard, interactive Fastfetch-style terminal UI, terminal `curl` support, and a standalone CLI tool.

---

## ⚡ Features

- **Interactive Fastfetch Terminal Hero**: Dynamic ASCII art tailored to your OS (macOS, Linux, Windows), with formatted specs and ANSI color palette blocks.
- **Real-Time Telemetry Gauges**: Live CPU utilization %, Memory pressure %, Disk usage %, CPU Temperature, Load Averages, and Battery status.
- **Multi-Core CPU Inspector**: Per-core utilization meters tracking each logical CPU thread in real time.
- **Memory & Storage Breakdown**: Visual distribution of active, cached, and free RAM, along with mounted disk volumes.
- **Live Process Explorer**: Top resource-consuming processes sorted by CPU and memory with live search filtering.
- **CLI Mode & curl Support**: Run `npm run fetch` or `curl http://localhost:8000/` to fetch formatted system specs directly in your terminal.
- **Production Monitoring**: Built-in Prometheus metrics at `/metrics`, Grafana dashboards, Alertmanager configs, and optional Telegram alerts.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url> sysinfo-fetcher
cd sysinfo-fetcher

# Install dependencies
npm install
```

### 1. Terminal CLI Fetcher

To inspect your system specs immediately in the terminal:

```bash
npm run fetch
```

Or run via the binary:

```bash
node bin/fetch.js
```

### 2. Run the Web Server

```bash
npm start
```

Once started, the server outputs your system specs in the console and becomes live at:
- **Web Dashboard**: `http://localhost:8000/`
- **CLI curl Endpoint**: `curl http://localhost:8000/` or `curl http://localhost:8000/cli`
- **System Telemetry API**: `http://localhost:8000/api/system`
- **Health Check**: `http://localhost:8000/healthz`
- **Prometheus Metrics**: `http://localhost:8000/metrics`

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Main System Info Web Dashboard (or ANSI fastfetch if accessed with `curl`) |
| `/cli` or `/api/system/cli` | `GET` | Plain text ANSI colored Neofetch-style system summary |
| `/api/system` | `GET` | Full JSON telemetry snapshot (Host, CPU, GPU, Memory, Disks, Battery, Net, Processes) |
| `/api/system/quick` | `GET` | High-frequency lightweight snapshot for rapid polling |
| `/api/files` | `GET` | Payload and project documentation file registry |
| `/healthz` | `GET` | Service health status check |
| `/metrics` | `GET` | Prometheus formatted application & system metrics |

---

## 🚀 Deploying to Render

This project is pre-configured for **Render** (via `render.yaml` Blueprint or Web Service).

### Option 1: Automatic Blueprint (Easiest)
1. Push this repository to your **GitHub** account.
2. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint**.
3. Select your repository. Render will automatically read `render.yaml`, install dependencies, and launch your live service!

### Option 2: Manual Web Service
1. In Render, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Click **Deploy Web Service**! Render sets the `PORT` environment variable automatically, and SysInfo Fetcher will immediately start monitoring the Render instance.

---

## 📄 License
MIT License. Built for personal system monitoring and developer portfolios.
