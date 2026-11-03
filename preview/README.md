# Pelacak Keuangan — Finance Tracker (JB build)

A private, offline-capable personal finance tracker PWA (vanilla JS, no build step).
This build is a faithful recreation of the reference app with three changes:

- **Pink brand/accent** — the logo (icons + favicon) and the app's accent color are pink.
- **Settings section** (Lainnya → Settings / Pengaturan) to choose **currency** (including **IDR**, the default) and switch **light / dark mode**.
- **Optional receipt photo** on each transaction — **Take Photo** (camera) or **Choose File** (gallery); shown as a thumbnail with a full-screen viewer.

## Features
Transactions (income/expense, wallets, categories, notes, optional photo), home dashboard,
wallets, budgets, assets, debts, investments, reports with charts, category manager,
dark/light theme, ID/EN language toggle, and IndexedDB persistence. Fully offline via a service worker.

## Run locally
Serve over HTTP (service worker + ES modules need it):
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Data & privacy
All data stays on your device (IndexedDB + localStorage). Nothing is uploaded anywhere.
