# Axis Black — Cosmic Intelligence & Financial Analytics Front End

> Premium SME Business Intelligence & Financial Telemetry Platform built with **React.js**, **TypeScript**, **Vite**, and **Chart.js**.

---

## 🌌 Aesthetic Theme: "Cosmic Intelligence & Luminous Glassmorphism"

Axis Black is designed to deliver a high-contrast obsidian canvas (`#0a0a0a`) with semi-transparent glass containers (`backdrop-filter: blur(16px)`), neon lilac (`#cebdff`) and cyan (`#00d4ff`) accents, monospaced data indicators, and an interactive particle starfield.

---

## 🚀 Key Features

1. **Overview Command Center Dashboard**:
   - Live KPI Metrics Ribbon: ARR, Net Liquidity Reserve, Monthly Burn Rate, Cosmic Risk Index.
   - Financial Constellation Trajectory Chart (glowing dual-axis revenue vs expenses telemetry).
   - Asset Allocation Spectrum Donut Chart.
   - Galactic Copilot Live Stream & AI Quick Query Input.
   - Recent Verified Ledger Transactions with CSV export simulation.

2. **Celestial Telemetry Analytics**:
   - Multi-quarter expenditure telemetry across Engineering, Growth, and Cloud Infrastructure.
   - Financial Health Radar Matrix assessing Liquidity, Efficiency, Growth Velocity, and Risk.

3. **Ledger & Cash Flow Stream**:
   - Searchable, filterable double-entry ledger.
   - Filter by Counterparty, Category (Infrastructure, Payroll, Subscription, Marketing, Treasury), and Status (Cleared, Pending).
   - Dynamic modal for recording new ledger entries with real-time audit toast notifications.

4. **Galactic AI Copilot Workspace**:
   - Fully interactive AI assistant with pre-loaded SME strategy templates.
   - Real-time conversation thread with quick prompt chips.

5. **Runway & Scenario Simulator**:
   - Stress-test net runway months against hiring expansion, revenue growth %, and marketing budgets.

6. **Settings & Telemetry Tokens**:
   - Inspect design system tokens, colors, and connected API keys (Plaid, Stripe).

---

## 🛠️ Project Structure

```
Axis  Black Front end/
├── index.html                   # HTML entry point with Google Fonts & icons
├── package.json                 # React 18, TypeScript, Chart.js, Vite dependencies
├── tsconfig.json                # TypeScript strict configuration
├── vite.config.ts               # Vite build configuration
├── styles/
│   ├── main.css                 # Cosmic Glassmorphism Design System CSS
│   └── components.css           # Component layouts, tables, cards, AI chat
├── src/
│   ├── main.tsx                 # React DOM root entry
│   ├── App.tsx                  # Application state & routing orchestration
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces for metrics & ledger
│   ├── data/
│   │   └── mockData.ts          # Comprehensive SME telemetry dataset
│   ├── components/
│   │   ├── CosmicCanvas.tsx     # Animated particle starfield background
│   │   ├── Sidebar.tsx          # Navigation drawer & operational status
│   │   ├── Header.tsx           # Global search, timeframe selector, profile
│   │   ├── MetricCard.tsx       # Glowing KPI card
│   │   ├── ConstellationChart.tsx # Glowing line telemetry chart (Chart.js)
│   │   ├── AssetSpectrumChart.tsx # Asset allocation donut chart
│   │   ├── AICopilotWidget.tsx  # Live AI intelligence stream widget
│   │   ├── RecentLedgerTable.tsx# Ledger table component
│   │   ├── EtherealBanner.tsx   # Dismissible insight spotlight banner
│   │   └── NewTransactionModal.tsx # Modal form for new financial entries
│   └── views/
│       ├── OverviewDashboard.tsx
│       ├── CelestialAnalytics.tsx
│       ├── TransactionsLedger.tsx
│       ├── AICopilotWorkspace.tsx
│       ├── RunwaySimulator.tsx
│       └── SettingsView.tsx
```

---

## ⚙️ Running Locally

1. Open your terminal in this directory:
   ```bash
   cd "C:\Users\User\Desktop\Axis  Black Front end"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the Vite development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your web browser.
