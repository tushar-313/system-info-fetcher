# SysInfo Fetcher

> Modern real-time System Information Fetcher & Hardware Telemetry Platform.

SysInfo Fetcher runs directly on your computer (macOS, Windows, or Linux) to collect and display deep bare-metal hardware, operating system, and live process telemetry. It provides a futuristic, responsive Web Dashboard, interactive Fastfetch-style terminal UI, terminal `curl` support, and a standalone CLI tool.

---

## ⚡ Key Highlights

- **Direct Hardware Access**: Runs natively on your machine to extract authentic hardware telemetry (real CPU models, dedicated GPUs, full RAM capacity, physical SSD storage, and battery state) without browser sandbox restrictions.
- **Dynamic Fastfetch Terminal Hero**: Tailored ASCII art and color themes for every operating system:
  - **Windows (11 / 10)**: Iconic 4-quadrant Microsoft Windows block logo in Electric Cyan (`#00adef`).
  - **macOS**: Apple silhouette logo in Emerald Green (`#34d399`).
  - **Linux**: Tux Penguin logo in Golden Yellow (`#fbbf24`).
- **Real-Time Telemetry Gauges**: Live CPU utilization %, Memory pressure %, Disk usage %, CPU Temperature, Load Averages, and Battery status.
- **Multi-Core Topology**: Live per-core utilization meters tracking each logical CPU core in real time.
- **Memory & Storage Breakdown**: Visual breakdown of active, cached, and available RAM, along with all mounted disk volumes.
- **Live Process Explorer**: Top resource-consuming processes sorted by CPU and memory with live instant-search filtering.
- **Dual Terminal & Web Experience**: Access the rich web dashboard in your browser or run `npm run fetch` / `curl http://localhost:8000/` directly inside your terminal.
- **Local Network (LAN) Monitoring**: Binds to `0.0.0.0` so you can monitor your computer from your phone, tablet, or another laptop on the same Wi-Fi network.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node.js 20+ or 22+ recommended)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/tushar-313/system-info-fetcher.git
cd system-info-fetcher

# Install dependencies
npm install
```

### 1. Standalone Terminal CLI Fetcher

Inspect your hardware specs immediately inside your terminal (Fastfetch style):

```bash
npm run fetch
```

Or execute directly via Node:

```bash
node bin/fetch.js
```

---

### 2. Start the Live Web Dashboard

Launch the live telemetry server:

```bash
npm start
```

*(or `npm run dev` for development)*

Once started, the server outputs your system specs in the console and becomes live at:

- **Local Machine**: [http://localhost:8000/](http://localhost:8000/)
- **CLI curl Endpoint**: `curl http://localhost:8000/` or `curl http://localhost:8000/cli`
- **Telemetry JSON API**: [http://localhost:8000/api/system](http://localhost:8000/api/system)
- **Health Check**: [http://localhost:8000/healthz](http://localhost:8000/healthz)
- **Prometheus Metrics**: [http://localhost:8000/metrics](http://localhost:8000/metrics)

---

## 📱 Monitoring from Phone or Another Device on Wi-Fi

Because the server binds to `0.0.0.0`, you can monitor your PC or Mac from your phone, tablet, or another computer on the same local Wi-Fi:

1. When the server starts, check the console output for your local IP (e.g. `http://192.168.1.50:8000/`).
2. Open that URL on your phone's browser or tablet.
3. You will see your computer's real-time hardware gauges, CPU loads, and thermals live on your phone!

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Web Dashboard (or ANSI fastfetch text if requested with `curl`) |
| `/cli` or `/api/system/cli` | `GET` | Plain text ANSI colored Neofetch/Fastfetch summary |
| `/api/system` | `GET` | Full JSON telemetry snapshot (Host, CPU, GPU, Memory, Storage, Battery, Net, Processes) |
| `/api/system/quick` | `GET` | Lightweight telemetry snapshot for rapid polling |
| `/api/client-info` | `GET` | Client connection IP and metadata |
| `/healthz` | `GET` | Service health status |
| `/metrics` | `GET` | Prometheus-compatible application & system metrics |

---

## 🖥️ Operating System Support

| OS | ASCII Logo | GPU & Hardware Features |
| :--- | :--- | :--- |
| **Windows 11 / 10** | 4-Quadrant Cyan Logo | Direct3D, NVIDIA GeForce, AMD Radeon, Intel Iris Xe, WMI hardware telemetry |
| **macOS (Apple Silicon & Intel)** | Emerald Apple Logo | Apple M-Series (M1/M2/M3/M4) & Intel Macs, unified memory, thermal sensors, battery |
| **Linux (Ubuntu, Debian, Arch, Fedora)** | Golden Tux Penguin | Kernel telemetry, per-core CPU load, system memory, disk volumes |

---

## 📄 License
MIT License. Built for personal system monitoring and hardware telemetry.
