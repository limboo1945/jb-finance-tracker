/* ========================================================================
   JB Finance Tracker — app.js
   A static, offline-ready personal finance tracker (vanilla JS).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- Constants & State ---------------- */
  const STORE_KEY = 'jbft.transactions.v1';
  const BUDGET_KEY = 'jbft.budgets.v1';
  const THEME_KEY = 'jbft.theme.v1';

  const CATEGORIES = {
    income: [
      { id: 'salary', label: 'Salary', icon: '💼' },
      { id: 'business', label: 'Business', icon: '🏪' },
      { id: 'gift', label: 'Gift', icon: '🎁' },
      { id: 'investment', label: 'Investment', icon: '📈' },
      { id: 'other-income', label: 'Other', icon: '➕' }
    ],
    expense: [
      { id: 'food', label: 'Food & Drink', icon: '🍔' },
      { id: 'groceries', label: 'Groceries', icon: '🛒' },
      { id: 'transport', label: 'Transport', icon: '🚗' },
      { id: 'shopping', label: 'Shopping', icon: '🛍️' },
      { id: 'bills', label: 'Bills', icon: '🧾' },
      { id: 'housing', label: 'Housing', icon: '🏠' },
      { id: 'health', label: 'Health', icon: '💊' },
      { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
      { id: 'education', label: 'Education', icon: '📚' },
      { id: 'other-expense', label: 'Other', icon: '➖' }
    ]
  };

  let transactions = load(STORE_KEY, []);
  let budgets = load(BUDGET_KEY, {}); // { categoryId: limitNumber }
  let currentReceipt = null;          // data URL of pending receipt in the form
  let charts = {};                    // Chart.js instances

  /* ---------------- Helpers ---------------- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Failed to load', key, e);
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert('Could not save data. Storage may be full (receipts take space).');
      console.error(e);
    }
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function categoryMeta(type, id) {
    const list = CATEGORIES[type] || [];
    return list.find((c) => c.id === id) || { id: id, label: id || 'Other', icon: '•' };
  }
  function allCategoryMeta(id) {
    return categoryMeta('income', id).label !== id
      ? categoryMeta('income', id)
      : categoryMeta('expense', id);
  }
  function monthKey(dateStr) { return (dateStr || '').slice(0, 7); } // YYYY-MM
  function currentMonthKey() { return new Date().toISOString().slice(0, 7); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function formatDateHeading(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatMonthLabel(key) {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const saved = load(THEME_KEY, null);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    save(THEME_KEY, next);
    if ($('#tab-charts').classList.contains('is-active')) renderCharts();
  }

  /* ---------------- Tabs ---------------- */
  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('is-active'));
        $$('.tab-panel').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        const name = tab.dataset.tab;
        $('#tab-' + name).classList.add('is-active');
        if (name === 'charts') renderCharts();
        if (name === 'budget') renderBudget();
      });
    });
  }

  /* ---------------- Category selects ---------------- */
  function populateCategorySelect(type) {
    const sel = $('#txCategory');
    sel.innerHTML = '';
    CATEGORIES[type].forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.icon + '  ' + c.label;
      sel.appendChild(opt);
    });
  }
  function populateFilterCategory() {
    const sel = $('#filterCategory');
    const prev = sel.value;
    sel.innerHTML = '<option value="all">All categories</option>';
    [...CATEGORIES.income, ...CATEGORIES.expense].forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.icon + '  ' + c.label;
      sel.appendChild(opt);
    });
    sel.value = prev || 'all';
  }
  function populateFilterMonth() {
    const sel = $('#filterMonth');
    const prev = sel.value;
    const months = [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse();
    sel.innerHTML = '<option value="all">All months</option>';
    months.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      sel.appendChild(opt);
    });
    sel.value = months.includes(prev) ? prev : 'all';
  }

  /* ---------------- Filtering ---------------- */
  function getFilters() {
    return {
      type: $('#filterType').value,
      category: $('#filterCategory').value,
      month: $('#filterMonth').value
    };
  }
  function applyFilters(list) {
    const f = getFilters();
    return list.filter((t) => {
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.category !== 'all' && t.category !== f.category) return false;
      if (f.month !== 'all' && monthKey(t.date) !== f.month) return false;
      return true;
    });
  }

  /* ---------------- Summary ---------------- */
  function renderSummary(list) {
    let income = 0, expense = 0;
    list.forEach((t) => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    $('#summaryIncome').textContent = fmtMoney(income);
    $('#summaryExpense').textContent = fmtMoney(expense);
    $('#summaryBalance').textContent = fmtMoney(income - expense);
  }

  /* ---------------- Transaction list ---------------- */
  function renderTransactions() {
    populateFilterMonth();
    const filtered = applyFilters(transactions).sort((a, b) =>
      b.date === a.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1)
    );
    renderSummary(filtered);

    const listEl = $('#transactionList');
    listEl.innerHTML = '';

    if (filtered.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = transactions.length === 0
        ? 'No transactions yet. Tap the + button to add one.'
        : 'No transactions match the current filters.';
      listEl.appendChild(p);
      return;
    }

    // Group by date
    const groups = {};
    filtered.forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });

    Object.keys(groups).sort().reverse().forEach((date) => {
      const group = document.createElement('div');
      group.className = 'tx-group';
      const heading = document.createElement('div');
      heading.className = 'tx-group__date';
      heading.textContent = formatDateHeading(date);
      group.appendChild(heading);

      groups[date].forEach((t) => group.appendChild(renderTxItem(t)));
      listEl.appendChild(group);
    });
  }

  function renderTxItem(t) {
    const meta = categoryMeta(t.type, t.category);
    const item = document.createElement('div');
    item.className = 'tx-item';
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('tx-item__thumb')) return; // handled separately
      openTxModal(t);
    });

    if (t.receipt) {
      const thumb = document.createElement('img');
      thumb.className = 'tx-item__thumb';
      thumb.src = t.receipt;
      thumb.alt = 'Receipt';
      thumb.addEventListener('click', (e) => { e.stopPropagation(); openReceiptViewer(t.receipt); });
      item.appendChild(thumb);
    } else {
      const icon = document.createElement('div');
      icon.className = 'tx-item__icon';
      icon.textContent = meta.icon;
      item.appendChild(icon);
    }

    const body = document.createElement('div');
    body.className = 'tx-item__body';
    const desc = document.createElement('div');
    desc.className = 'tx-item__desc';
    desc.textContent = t.description;
    const metaLine = document.createElement('div');
    metaLine.className = 'tx-item__meta';
    metaLine.textContent = meta.icon + ' ' + meta.label;
    body.appendChild(desc);
    body.appendChild(metaLine);
    if (t.note) {
      const note = document.createElement('div');
      note.className = 'tx-item__note';
      note.textContent = t.note;
      body.appendChild(note);
    }
    item.appendChild(body);

    const amount = document.createElement('div');
    amount.className = 'tx-item__amount tx-item__amount--' + t.type;
    amount.textContent = (t.type === 'income' ? '+' : '-') + fmtMoney(t.amount);
    item.appendChild(amount);

    return item;
  }

  /* ---------------- Transaction modal ---------------- */
  function openTxModal(tx) {
    const form = $('#txForm');
    form.reset();
    currentReceipt = null;
    $('#receiptPreview').hidden = true;

    if (tx) {
      $('#txModalTitle').textContent = 'Edit Transaction';
      $('#txId').value = tx.id;
      setType(tx.type);
      $('#txAmount').value = tx.amount;
      $('#txDescription').value = tx.description;
      populateCategorySelect(tx.type);
      $('#txCategory').value = tx.category;
      $('#txDate').value = tx.date;
      $('#txNote').value = tx.note || '';
      if (tx.receipt) {
        currentReceipt = tx.receipt;
        $('#receiptPreviewImg').src = tx.receipt;
        $('#receiptPreview').hidden = false;
      }
      $('#deleteTxBtn').hidden = false;
    } else {
      $('#txModalTitle').textContent = 'Add Transaction';
      $('#txId').value = '';
      setType('expense');
      $('#txDate').value = new Date().toISOString().slice(0, 10);
      $('#deleteTxBtn').hidden = true;
    }
    openModal('#txModal');
  }

  function setType(type) {
    $$('input[name="txType"]').forEach((r) => { r.checked = r.value === type; });
    $$('.type-toggle__option').forEach((o) => o.classList.toggle('is-active', o.dataset.type === type));
    const prevCat = $('#txCategory').value;
    populateCategorySelect(type);
    if ([...CATEGORIES[type]].some((c) => c.id === prevCat)) $('#txCategory').value = prevCat;
  }

  function saveTransaction(e) {
    e.preventDefault();
    const id = $('#txId').value;
    const checkedType = ($$('input[name="txType"]').filter((r) => r.checked)[0] || {}).value || 'expense';
    const amount = parseFloat($('#txAmount').value);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }

    const data = {
      type: checkedType,
      amount: Math.round(amount * 100) / 100,
      description: $('#txDescription').value.trim() || categoryMeta(checkedType, $('#txCategory').value).label,
      category: $('#txCategory').value,
      date: $('#txDate').value,
      note: $('#txNote').value.trim(),
      receipt: currentReceipt || null
    };

    if (id) {
      const idx = transactions.findIndex((t) => t.id === id);
      if (idx > -1) transactions[idx] = Object.assign({}, transactions[idx], data);
    } else {
      transactions.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
    }
    save(STORE_KEY, transactions);
    closeModal('#txModal');
    refreshAll();
  }

  function deleteTransaction() {
    const id = $('#txId').value;
    if (!id) return;
    if (!confirm('Delete this transaction?')) return;
    transactions = transactions.filter((t) => t.id !== id);
    save(STORE_KEY, transactions);
    closeModal('#txModal');
    refreshAll();
  }

  /* ---------------- Receipts ---------------- */
  function handleReceiptFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      resizeImage(reader.result, 1280, 0.72, (dataUrl) => {
        currentReceipt = dataUrl;
        $('#receiptPreviewImg').src = dataUrl;
        $('#receiptPreview').hidden = false;
      });
    };
    reader.readAsDataURL(file);
  }

  // Downscale + compress to keep localStorage usage reasonable.
  function resizeImage(dataUrl, maxDim, quality, cb) {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      try { cb(canvas.toDataURL('image/jpeg', quality)); }
      catch (e) { cb(dataUrl); }
    };
    img.onerror = () => cb(dataUrl);
    img.src = dataUrl;
  }

  function openReceiptViewer(src) {
    $('#receiptViewerImg').src = src;
    const v = $('#receiptViewer');
    v.classList.add('is-open');
    v.setAttribute('aria-hidden', 'false');
  }

  /* ---------------- Charts ---------------- */
  function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue('--text').trim(),
      grid: styles.getPropertyValue('--border').trim(),
      income: styles.getPropertyValue('--income').trim(),
      expense: styles.getPropertyValue('--expense').trim()
    };
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => c && c.destroy());
    charts = {};
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    destroyCharts();
    const c = themeColors();
    Chart.defaults.color = c.text;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    const month = currentMonthKey();
    const monthTx = transactions.filter((t) => monthKey(t.date) === month);
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // 1) Income vs Expense (bar)
    charts.ie = new Chart($('#chartIncomeExpense'), {
      type: 'bar',
      data: {
        labels: ['This Month'],
        datasets: [
          { label: 'Income', data: [income], backgroundColor: c.income, borderRadius: 6 },
          { label: 'Expense', data: [expense], backgroundColor: c.expense, borderRadius: 6 }
        ]
      },
      options: baseOpts(c, true)
    });

    // 2) Expenses by category (doughnut)
    const byCat = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
    const catIds = Object.keys(byCat);
    const palette = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b'];
    charts.cat = new Chart($('#chartByCategory'), {
      type: 'doughnut',
      data: {
        labels: catIds.length ? catIds.map((id) => categoryMeta('expense', id).label) : ['No expenses'],
        datasets: [{
          data: catIds.length ? catIds.map((id) => byCat[id]) : [1],
          backgroundColor: catIds.length ? catIds.map((_, i) => palette[i % palette.length]) : [c.grid],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: c.text, padding: 12 } } }
      }
    });

    // 3) 6-month trend (line)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const incSeries = months.map((m) => transactions.filter((t) => t.type === 'income' && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
    const expSeries = months.map((m) => transactions.filter((t) => t.type === 'expense' && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
    charts.trend = new Chart($('#chartTrend'), {
      type: 'line',
      data: {
        labels: months.map(formatMonthLabel),
        datasets: [
          { label: 'Income', data: incSeries, borderColor: c.income, backgroundColor: c.income + '33', tension: 0.3, fill: true },
          { label: 'Expense', data: expSeries, borderColor: c.expense, backgroundColor: c.expense + '33', tension: 0.3, fill: true }
        ]
      },
      options: baseOpts(c, true)
    });
  }

  function baseOpts(c, legend) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: !!legend, labels: { color: c.text } } },
      scales: {
        x: { ticks: { color: c.text }, grid: { color: c.grid } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true }
      }
    };
  }

  /* ---------------- Budget ---------------- */
  function renderBudget() {
    const listEl = $('#budgetList');
    listEl.innerHTML = '';
    const month = currentMonthKey();
    const spentByCat = {};
    transactions.filter((t) => t.type === 'expense' && monthKey(t.date) === month)
      .forEach((t) => { spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount; });

    CATEGORIES.expense.forEach((cat) => {
      const limit = budgets[cat.id] || 0;
      const spent = spentByCat[cat.id] || 0;
      const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

      const item = document.createElement('div');
      item.className = 'budget-item';
      item.addEventListener('click', () => openBudgetModal(cat));

      const head = document.createElement('div');
      head.className = 'budget-item__head';
      const name = document.createElement('div');
      name.className = 'budget-item__name';
      name.innerHTML = '<span>' + cat.icon + '</span> ' + cat.label;
      const values = document.createElement('div');
      values.className = 'budget-item__values';
      values.innerHTML = limit > 0
        ? '<strong>' + fmtMoney(spent) + '</strong> / ' + fmtMoney(limit)
        : 'No limit set';
      head.appendChild(name);
      head.appendChild(values);

      const progress = document.createElement('div');
      progress.className = 'progress';
      const bar = document.createElement('div');
      bar.className = 'progress__bar';
      if (limit > 0) {
        if (spent > limit) bar.classList.add('is-over');
        else if (spent / limit >= 0.8) bar.classList.add('is-warn');
      }
      bar.style.width = (limit > 0 ? pct : 0) + '%';
      progress.appendChild(bar);

      item.appendChild(head);
      item.appendChild(progress);

      if (limit > 0) {
        const hint = document.createElement('div');
        hint.className = 'budget-item__hint';
        const remaining = limit - spent;
        hint.textContent = remaining >= 0
          ? fmtMoney(remaining) + ' remaining this month'
          : fmtMoney(-remaining) + ' over budget';
        item.appendChild(hint);
      } else {
        const hint = document.createElement('div');
        hint.className = 'budget-item__hint';
        hint.textContent = 'Tap to set a monthly limit';
        item.appendChild(hint);
      }

      listEl.appendChild(item);
    });
  }

  function openBudgetModal(cat) {
    $('#budgetCategory').value = cat.id;
    $('#budgetCategoryName').textContent = cat.label;
    $('#budgetLimit').value = budgets[cat.id] || '';
    openModal('#budgetModal');
  }

  function saveBudget(e) {
    e.preventDefault();
    const catId = $('#budgetCategory').value;
    const val = parseFloat($('#budgetLimit').value);
    if (!val || val <= 0) delete budgets[catId];
    else budgets[catId] = Math.round(val * 100) / 100;
    save(BUDGET_KEY, budgets);
    closeModal('#budgetModal');
    renderBudget();
  }

  /* ---------------- Modal helpers ---------------- */
  function openModal(sel) {
    const m = $(sel);
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
  }
  function closeModal(sel) {
    const m = $(sel);
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
  }

  /* ---------------- Refresh ---------------- */
  function refreshAll() {
    renderTransactions();
    if ($('#tab-charts').classList.contains('is-active')) renderCharts();
    if ($('#tab-budget').classList.contains('is-active')) renderBudget();
  }

  /* ---------------- Event wiring ---------------- */
  function initEvents() {
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#addBtn').addEventListener('click', () => openTxModal(null));

    // Type toggle
    $$('.type-toggle__option').forEach((o) => {
      o.addEventListener('click', () => setType(o.dataset.type));
    });

    // Form
    $('#txForm').addEventListener('submit', saveTransaction);
    $('#deleteTxBtn').addEventListener('click', deleteTransaction);

    // Receipts
    $('#takePhotoBtn').addEventListener('click', () => $('#receiptCamera').click());
    $('#chooseFileBtn').addEventListener('click', () => $('#receiptGallery').click());
    $('#receiptCamera').addEventListener('change', (e) => handleReceiptFile(e.target.files[0]));
    $('#receiptGallery').addEventListener('change', (e) => handleReceiptFile(e.target.files[0]));
    $('#removeReceiptBtn').addEventListener('click', () => {
      currentReceipt = null;
      $('#receiptPreview').hidden = true;
      $('#receiptCamera').value = '';
      $('#receiptGallery').value = '';
    });

    // Filters
    ['#filterType', '#filterCategory', '#filterMonth'].forEach((sel) => {
      $(sel).addEventListener('change', renderTransactions);
    });

    // Budget form
    $('#budgetForm').addEventListener('submit', saveBudget);

    // Close buttons / backdrops
    $$('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const modal = el.closest('.modal');
        const viewer = el.closest('.viewer');
        if (modal) closeModal('#' + modal.id);
        if (viewer) { viewer.classList.remove('is-open'); viewer.setAttribute('aria-hidden', 'true'); }
      });
    });

    // Esc to close
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.modal.is-open').forEach((m) => closeModal('#' + m.id));
      const v = $('#receiptViewer');
      if (v.classList.contains('is-open')) { v.classList.remove('is-open'); v.setAttribute('aria-hidden', 'true'); }
    });
  }

  /* ---------------- Service worker ---------------- */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
      });
    }
  }

  /* ---------------- Init ---------------- */
  function init() {
    initTheme();
    initTabs();
    initEvents();
    populateCategorySelect('expense');
    populateFilterCategory();
    renderTransactions();
    registerSW();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
