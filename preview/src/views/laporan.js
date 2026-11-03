// @ts-check
/**
 * Laporan (reports) — Phase 8 (Req 20).
 * Month selector; income / expenses / net savings; % change vs last month;
 * spending-by-category chart (reused); Top Pengeluaran list.
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money } from '../lib/format.js';
import { formatMonthLabel, formatDateLabel, isToday, isYesterday } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { monthSelect } from './monthSelect.js';
import { spendingChart } from './chart.js';

/**
 * Render the Laporan view.
 * @param {HTMLElement} container
 */
export function renderLaporan(container) {
  const month = store.getState().selectedMonth;
  // Laporan excludes categories flagged "excluded" (money-move / "Pindah"),
  // matching Beranda, so moving money doesn't skew the report or chart.
  const report = store.monthlyReportExcluded(month);
  const cmp = store.berandaPreviousMonthComparison(month);
  const spending = store.selectSpendingByCategoryExcluded(month);
  const top = store.berandaTopExpenses(month, 5);

  // Month selector
  const monthRow = el('label', { class: 'field', style: 'margin-bottom:16px' }, [
    el('span', { class: 'field-label' }, t.laporan.month),
    monthSelect(),
  ]);

  // Summary cards with % vs last month
  const netClass = report.netSavings < 0 ? 'negative' : report.netSavings > 0 ? 'positive' : '';
  const summaryGrid = el('div', { class: 'summary-grid' }, [
    reportCard(t.laporan.income, money(report.income), 'income', cmp.incomePct, 'income'),
    reportCard(t.laporan.expenses, money(report.expenses), 'expense', cmp.expensePct, 'expense'),
    el('div', { class: 'summary-card net' }, [
      el('div', { class: 'label' }, `${t.laporan.netSavings} — ${formatMonthLabel(month)}`),
      el('div', { class: 'value ' + netClass }, money(report.netSavings)),
    ]),
  ]);

  container.append(
    monthRow,
    summaryGrid,
    el('div', { class: 'section-title' }, t.laporan.spendingByCategory),
    el('div', { class: 'card' }, spendingChart(spending)),
    el('div', { class: 'section-title' }, t.laporan.topExpenses),
    topExpensesNode(top)
  );
}

/**
 * A summary card with an optional "+X% vs bulan lalu" comparison.
 * @param {string} label @param {string} value @param {string} valueClass
 * @param {number|null} pct @param {'income'|'expense'} kind
 */
function reportCard(label, value, valueClass, pct, kind) {
  const children = [
    el('div', { class: 'label' }, label),
    el('div', { class: 'value ' + valueClass }, value),
  ];
  if (pct != null) {
    // For income, up is good (green); for expenses, up is bad (red).
    const up = pct > 0;
    const good = kind === 'income' ? up : !up;
    const cls = pct === 0 ? 'flat' : good ? 'good' : 'bad';
    children.push(
      el('div', { class: 'report-delta ' + cls }, `${signedPct(pct)} ${t.laporan.vsLastMonth}`)
    );
  }
  return el('div', { class: 'summary-card' }, children);
}

/** Format a signed percentage with Indonesian comma decimal, e.g. +12,5%. */
function signedPct(p) {
  const sign = p > 0 ? '+' : p < 0 ? '-' : '';
  const abs = Math.abs(p);
  const s = (Number.isInteger(abs) ? String(abs) : abs.toFixed(1)).replace('.', ',');
  return `${sign}${s}%`;
}

/** Top expenses list. */
function topExpensesNode(top) {
  if (top.length === 0) {
    return el('div', { class: 'empty' }, el('div', {}, t.laporan.noExpenses));
  }
  return el(
    'ul',
    { class: 'tx-list' },
    top.map((tx) => {
      const dayLabel = isToday(tx.date)
        ? t.tx.today
        : isYesterday(tx.date)
        ? t.tx.yesterday
        : formatDateLabel(tx.date);
      const walletLabel = tx.walletId ? store.walletName(tx.walletId) : '';
      const title = tx.note ? tx.note : store.categoryName(tx.categoryId);
      const meta = [store.categoryName(tx.categoryId), dayLabel, walletLabel].filter(Boolean).join(' · ');
      return el('li', { class: 'tx-item' }, [
        el('div', { class: 'tx-main' }, [
          el('div', { class: 'tx-cat' }, title),
          el('div', { class: 'tx-meta' }, meta),
        ]),
        el('div', { class: 'tx-amount expense' }, money(tx.amount)),
      ]);
    })
  );
}
