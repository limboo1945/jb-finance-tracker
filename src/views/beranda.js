// @ts-check
/**
 * Beranda — the full Dashboard (Phase 9, Req 22). A thin aggregation layer over
 * the store selectors built in earlier phases: greeting, at-a-glance daily
 * budget, quick totals, a monthly calendar heatmap of daily net spend, recent
 * transactions, period comparison, top expenses tagged by budget group, and a
 * quick-access menu to the secondary sections.
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money, moneyShort } from '../lib/format.js';
import { formatMonthLabel, formatDateLabel, isToday, isYesterday } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { monthSelect } from './monthSelect.js';

/**
 * Render the Beranda dashboard.
 * @param {HTMLElement} container
 * @param {(view: string) => void} [navigate] - router callback for quick access
 */
export function renderBeranda(container, navigate) {
  const month = store.getState().selectedMonth;
  // Beranda excludes money-move ("Pindah") categories so moving money between
  // your own places doesn't show up as income/expense here.
  const summary = store.berandaMonthlySummary(month);
  // Independent per-section privacy locks.
  const sekilasHidden = store.isHidden('sekilas');
  const ringkasanHidden = store.isHidden('ringkasan');

  container.append(
    glanceCard(summary, sekilasHidden),
    el('div', { class: 'card-head' }, [
      el('div', { class: 'section-title', style: 'margin:0' }, t.beranda.ringkasanBulan),
      lockButton('ringkasan', ringkasanHidden),
    ]),
    el('label', { class: 'field', style: 'margin-bottom:16px' }, [
      el('span', { class: 'field-label' }, t.dashboard.month),
      monthSelect(),
    ]),
    monthSummaryGrid(month, summary, ringkasanHidden),
    comparisonCard(month),
    calendarCard(month, ringkasanHidden),
    quickAccess(navigate),
    recentCard(navigate),
    topExpensesCard(month, ringkasanHidden)
  );
}

/**
 * A privacy lock toggle button for a given section key.
 * @param {string} key @param {boolean} hidden
 */
function lockButton(key, hidden) {
  return el(
    'button',
    {
      class: 'saldo-lock',
      'aria-label': hidden ? t.wallet.showBalance : t.wallet.hideBalance,
      'aria-pressed': hidden ? 'true' : 'false',
      onClick: () => store.toggleHidden(key),
    },
    icon(hidden ? 'lock' : 'unlock', { size: 18 })
  );
}

/**
 * "Sekilas Hari Ini" glance card.
 * @param {import('../types.js').MonthlySummary} summary @param {boolean} hidden
 * @returns {HTMLElement}
 */
function glanceCard(summary, hidden) {
  const dailyRemaining = store.berandaDailyBudgetRemaining ? store.berandaDailyBudgetRemaining() : null;
  const hasBudget = dailyRemaining != null && Number.isFinite(dailyRemaining);

  // Progress: today's expenses relative to the daily allowance (0–100%).
  const allowance = store.dailyAllowance ? store.dailyAllowance() : null;
  const todaySpent = store.berandaTodayExpenses();
  const ratio =
    allowance && allowance > 0
      ? Math.min(1, todaySpent / allowance)
      : todaySpent > 0
      ? 1
      : 0;
  const over = allowance != null && allowance > 0 && todaySpent > allowance;

  const amountText = !hasBudget
    ? t.beranda.budgetBelumDiatur
    : hidden
    ? t.wallet.hidden
    : money(dailyRemaining);

  return el('div', { class: 'glance-card' }, [
    el('div', { class: 'glance-amount-row' }, [
      el(
        'span',
        {
          class:
            'glance-amount' +
            (hasBudget && !hidden ? '' : ' muted') +
            (hasBudget && !hidden && dailyRemaining < 0 ? ' negative' : ''),
        },
        amountText
      ),
      lockButton('sekilas', hidden),
    ]),
    el('div', { class: 'glance-caption' }, [el('span', {}, t.beranda.budgetHarianTersisa)]),
    // Today's income / expenses (daily), WIB.
    el('div', { class: 'glance-io' }, [
      el('div', { class: 'glance-io-col' }, [
        el('div', { class: 'glance-io-label' }, t.beranda.pemasukan),
        el('div', { class: 'glance-io-val income' }, hidden ? t.wallet.hidden : money(store.berandaTodayIncome())),
      ]),
      el('div', { class: 'glance-io-col' }, [
        el('div', { class: 'glance-io-label' }, t.beranda.pengeluaran),
        el('div', { class: 'glance-io-val expense' }, hidden ? t.wallet.hidden : money(store.berandaTodayExpenses())),
      ]),
    ]),
    el(
      'div',
      { class: 'glance-progress', role: 'progressbar' },
      el('div', { class: 'glance-progress-fill' + (over ? ' over' : ''), style: `width:${Math.round(ratio * 100)}%` })
    ),
  ]);
}

/**
 * @param {string} month @param {import('../types.js').MonthlySummary} summary
 * @returns {HTMLElement}
 */
function monthSummaryGrid(month, summary, hidden) {
  // Pemasukan = actual income transactions for the month (starts at 0, grows
  // as income is added). Saldo Bersih = actual income − expenses.
  const income = summary.totalIncome;
  const net = income - summary.totalExpenses;
  const netClass = net < 0 ? 'negative' : net > 0 ? 'positive' : '';
  return el('div', { class: 'summary-grid' }, [
    summaryCard(t.dashboard.income, hidden ? t.wallet.hidden : money(income), 'income'),
    summaryCard(t.dashboard.expenses, hidden ? t.wallet.hidden : money(summary.totalExpenses), 'expense'),
    el('div', { class: 'summary-card net' }, [
      el('div', { class: 'label' }, t.dashboard.netForMonth(formatMonthLabel(month))),
      el('div', { class: 'value ' + netClass }, hidden ? t.wallet.hidden : money(net)),
    ]),
  ]);
}

function summaryCard(label, value, valueClass) {
  return el('div', { class: 'summary-card' }, [
    el('div', { class: 'label' }, label),
    el('div', { class: 'value ' + valueClass }, value),
  ]);
}

/** Period comparison stats (income & expense vs last month). */
function comparisonCard(month) {
  const cmp = store.berandaPreviousMonthComparison(month);
  const row = (label, pct, kind) => {
    let text = t.beranda.vsLastMonth;
    let cls = 'flat';
    if (pct == null) {
      text = t.laporan.na + ' ' + t.beranda.vsLastMonth;
    } else {
      const up = pct > 0;
      const good = kind === 'income' ? up : !up;
      cls = pct === 0 ? 'flat' : good ? 'good' : 'bad';
      text = `${signedPct(pct)} ${t.beranda.vsLastMonth}`;
    }
    return el('div', { class: 'cmp-row' }, [
      el('span', { class: 'cmp-label' }, label),
      el('span', { class: 'cmp-delta ' + cls }, text),
    ]);
  };
  return el('div', { class: 'card', style: 'margin-top:20px' }, [
    el('div', { class: 'section-title', style: 'margin-top:0' }, t.beranda.comparisonTitle),
    row(t.laporan.income, cmp.incomePct, 'income'),
    row(t.laporan.expenses, cmp.expensePct, 'expense'),
  ]);
}

function signedPct(p) {
  const sign = p > 0 ? '+' : p < 0 ? '-' : '';
  const abs = Math.abs(p);
  const s = (Number.isInteger(abs) ? String(abs) : abs.toFixed(1)).replace('.', ',');
  return `${sign}${s}%`;
}

/**
 * Round an amount so its compact label stays short in a calendar cell:
 * under 1jt → nearest thousand (e.g. 427.500 → "428rb"); 1jt+ → one decimal jt.
 * @param {number} n
 */
function roundForCell(n) {
  if (n >= 1_000_000) return n; // moneyShort already uses 1-decimal jt
  return Math.round(n / 1000) * 1000; // whole-thousand => "NNNrb", no decimal
}

/** Monthly calendar heatmap of daily net spend (Req 22.5). */
function calendarCard(month, hidden) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun

  const cells = [];
  // Weekday headers (Min–Sab).
  const dow = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  for (const d of dow) cells.push(el('div', { class: 'cal-dow' }, d));
  // Leading blanks.
  for (let i = 0; i < firstDow; i++) cells.push(el('div', { class: 'cal-cell empty' }));
  // Day cells: show expense total per day (not net — income doesn't reduce
  // the amount shown on a "pengeluaran" calendar, so today always shows).
  // Money-move ("Pindah") categories are excluded so moving money doesn't
  // paint the calendar.
  const dayExpenseMap = store.berandaDailyExpenseMap(month);
  let maxExpense = 0;
  for (const v of dayExpenseMap.values()) if (v > maxExpense) maxExpense = v;

  for (let day = 1; day <= daysInMonth; day++) {
    const expense = dayExpenseMap.get(day) || 0;
    const intensity = maxExpense > 0 && expense > 0 ? Math.min(1, expense / maxExpense) : 0;
    const bg = intensity > 0
      ? `color-mix(in srgb, var(--expense) ${Math.round(8 + intensity * 34)}%, var(--surface-2))`
      : 'var(--surface-2)';
    const today = isToday(`${month}-${String(day).padStart(2, '0')}`);
    cells.push(
      el(
        'div',
        {
          class: 'cal-cell' + (today ? ' today' : ''),
          style: `background:${bg}`,
          title: expense > 0 && !hidden ? `${day}: ${money(expense)}` : String(day),
        },
        [
          el('span', { class: 'cal-day' }, String(day)),
          expense > 0
            ? el('span', { class: 'cal-amt' }, hidden ? '•••' : '-' + moneyShort(roundForCell(expense)))
            : null,
        ]
      )
    );
  }

  return el('div', { class: 'card', style: 'margin-top:20px' }, [
    el('div', { class: 'section-title', style: 'margin-top:0' }, t.beranda.calendarTitle),
    el('div', { class: 'cal-grid' }, cells),
    el('div', { class: 'field-hint', style: 'margin-top:8px' }, t.beranda.calendarHint),
  ]);
}

/** Recent transactions (last 8) linking into Transaksi. */
function recentCard(navigate) {
  const recent = store.recentTransactions(8);
  const header = el('div', { class: 'card-head' }, [
    el('div', { class: 'section-title', style: 'margin:0' }, t.beranda.recentTitle),
    navigate ? el('button', { class: 'link-btn', onClick: () => navigate('transaksi') }, t.beranda.seeAll) : null,
  ]);
  if (recent.length === 0) {
    return el('div', {}, [header, el('div', { class: 'empty' }, el('div', {}, t.beranda.noRecent))]);
  }
  const list = el('ul', { class: 'tx-list' }, recent.map((tx) => {
    const dayLabel = isToday(tx.date) ? t.tx.today : isYesterday(tx.date) ? t.tx.yesterday : formatDateLabel(tx.date);
    const walletLabel = tx.walletId ? store.walletName(tx.walletId) : '';
    const title = tx.note ? tx.note : store.categoryName(tx.categoryId);
    const meta = [store.categoryName(tx.categoryId), dayLabel, walletLabel].filter(Boolean).join(' · ');
    const sign = tx.type === 'expense' ? '-' : '+';
    return el('li', { class: 'tx-item' }, [
      el('div', { class: 'tx-main' }, [
        el('div', { class: 'tx-cat' }, title),
        el('div', { class: 'tx-meta' }, meta),
      ]),
      el('div', { class: 'tx-amount ' + tx.type }, sign + money(tx.amount)),
    ]);
  }));
  return el('div', {}, [header, list]);
}

/** Top expenses tagged by budget group (Req 22.8). */
function topExpensesCard(month, hidden) {
  const top = store.berandaTopExpenses(month, 5);
  if (top.length === 0) {
    return el('div', {}, [
      el('div', { class: 'section-title' }, t.beranda.topExpensesTitle),
      el('div', { class: 'empty' }, el('div', {}, t.laporan.noExpenses)),
    ]);
  }
  const groupLabel = (g) =>
    g === 'needs' ? t.beranda.groupNeeds : g === 'wants' ? t.beranda.groupWants : g === 'savings' ? t.beranda.groupSavings : '';
  const list = el('ul', { class: 'tx-list' }, top.map((tx) => {
    const cat = store.getState().categories.find((c) => c.id === tx.categoryId);
    const group = cat && cat.budgetGroup;
    const title = tx.note ? tx.note : store.categoryName(tx.categoryId);
    return el('li', { class: 'tx-item' }, [
      el('div', { class: 'tx-main' }, [
        el('div', { class: 'tx-cat' }, title),
        el('div', { class: 'tx-meta' }, [
          store.categoryName(tx.categoryId),
          group ? el('span', { class: 'group-tag ' + group, style: 'margin-left:6px' }, groupLabel(group)) : null,
        ]),
      ]),
      el('div', { class: 'tx-amount expense' }, hidden ? t.wallet.hidden : money(tx.amount)),
    ]);
  }));
  return el('div', {}, [el('div', { class: 'section-title' }, t.beranda.topExpensesTitle), list]);
}

/** Quick-access menu to the secondary sections (Req 22.9). */
function quickAccess(navigate) {
  if (!navigate) return el('div');
  const items = [
    { id: 'budget', icon: 'target', label: t.lainnya.budget },
    { id: 'aset', icon: 'diamond', label: t.lainnya.aset },
    { id: 'utang', icon: 'debt', label: t.lainnya.utang },
    { id: 'investasi', icon: 'chart', label: t.lainnya.investasi },
    { id: 'laporan', icon: 'report', label: t.lainnya.laporan },
  ];
  return el('div', {}, [
    el('div', { class: 'section-title' }, t.beranda.quickAccessTitle),
    el('div', { class: 'quick-grid' }, items.map((it) =>
      el('button', { class: 'quick-item', onClick: () => navigate(it.id) }, [
        el('span', { class: 'quick-icon', 'aria-hidden': 'true' }, icon(/** @type {any} */ (it.icon), { size: 22 })),
        el('span', { class: 'quick-label' }, it.label),
      ])
    )),
  ]);
}
