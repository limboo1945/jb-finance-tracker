# JB Finance Tracker

A static, installable **PWA** for tracking personal finances — fully client-side, works offline, and stores everything in your browser's `localStorage`.

**Live site:** https://limboo1945.github.io/jb-finance-tracker/

## Features

- **Transactions** — add income or expense entries with amount, description, category, date, and an optional note.
- **Photo receipts** — attach a receipt via **Take Photo** (camera capture) or **Choose File** (gallery). Receipts appear as a thumbnail on each transaction and open in a full-screen viewer. Images are automatically downscaled/compressed to keep storage small.
- **Summary cards** — running balance, total income, and total expense (respecting active filters).
- **Grouped list** — transactions grouped by date (Today / Yesterday / full date).
- **Filters** — by type, category, and month.
- **Charts tab** (Chart.js) — income-vs-expense bar, expenses-by-category doughnut, and a 6-month income/expense trend line.
- **Budget tab** — set per-category monthly spending limits with color-coded progress bars.
- **Dark mode** — toggle in the header; respects your system preference by default.
- **Offline support** — a service worker caches the app shell so it keeps working without a connection.

## Tech

- Vanilla HTML / CSS / JavaScript — no build step.
- [Chart.js](https://www.chartjs.org/) via CDN for the charts.
- PWA: `manifest.json` + `sw.js` service worker.

## Running locally

Because the app registers a service worker, serve it over HTTP (not `file://`):

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

## Data & privacy

All data stays on your device in `localStorage`. Nothing is uploaded to any server. Clearing your browser data will erase your transactions, budgets, and receipts.
