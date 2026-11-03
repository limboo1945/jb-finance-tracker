// @ts-check
/**
 * Transaksi list view (Req 15): search bar + advanced filter sheet
 * (date range, wallet, category, type), and a date-grouped list
 * (Hari Ini / Kemarin / dated). Edit/delete row actions.
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { signedMoney } from '../lib/format.js';
import { t, typeLabel } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { openTransactionForm } from './transactionForm.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { openPhotoViewer } from './photoViewer.js';

/**
 * Render the Transaksi view into the given container.
 * @param {HTMLElement} container
 */
export function renderTransactions(container) {
  const filters = store.getState().txFilters;

  // ---- Search + filter row ----
  // The search input is created ONCE and never re-created while typing, so it
  // keeps focus and the mobile keyboard stays open. Typing updates the filter
  // silently (no global re-render) and only the results area below refreshes.
  const searchInput = el('input', {
    type: 'search',
    value: filters.search,
    placeholder: t.tx.searchPlaceholder,
    'aria-label': t.tx.searchAria,
    onInput: (e) => {
      store.setTxSearchSilent(e.target.value);
      refreshResults();
    },
  });

  const filterBtn = el(
    'button',
    {
      class: 'filter-btn',
      'aria-label': t.tx.filterButton,
      onClick: () => openFilterSheet(),
    },
    [
      icon('more', { size: 18 }),
      el('span', {}, t.tx.filterButton),
    ]
  );

  const controls = el('div', { class: 'tx-controls' }, [
    el('div', { class: 'search-wrap' }, searchInput),
    filterBtn,
  ]);

  // Results area (summary + list) is the only part that rebuilds on each
  // keystroke. Keeping it a stable wrapper means the search input above is
  // untouched and retains focus.
  const results = el('div', { class: 'tx-results' });

  /** Rebuild just the summary + grouped list from the current filters. */
  function refreshResults() {
    const list = store.selectTransactionsAdvanced();
    const groups = store.groupByDate(list);
    const activeCount = store.activeFilterCount();
    const curFilters = store.getState().txFilters;

    // Keep the filter button's active state in sync.
    filterBtn.classList.toggle('active', activeCount > 0);
    let countBadge = filterBtn.querySelector('.filter-count');
    if (activeCount > 0) {
      if (!countBadge) {
        countBadge = el('span', { class: 'filter-count' });
        filterBtn.append(countBadge);
      }
      countBadge.textContent = String(activeCount);
    } else if (countBadge) {
      countBadge.remove();
    }

    // Summary / clear row.
    const summaryRow =
      activeCount > 0 || curFilters.search
        ? el('div', { class: 'tx-filter-summary' }, [
            el('span', {}, t.tx.resultCount(list.length)),
            el('button', { class: 'link-btn', onClick: () => store.clearTxFilters() }, t.app.clear),
          ])
        : el('div', { class: 'section-title' }, t.tx.resultCount(list.length));

    // Grouped list / empty state.
    let body;
    if (list.length === 0) {
      body = el('div', { class: 'empty' }, [
        el('div', {}, t.tx.emptyTitle),
        el('div', { style: 'font-size:0.85rem;margin-top:4px' }, t.tx.emptyHint),
      ]);
    } else {
      body = el(
        'div',
        { class: 'tx-groups' },
        groups.map((g) =>
          el('section', { class: 'tx-group' }, [
            el('div', { class: 'tx-group-head' }, g.label),
            el('ul', { class: 'tx-list' }, g.items.map((tx) => transactionRow(tx))),
          ])
        )
      );
    }

    results.textContent = '';
    results.append(summaryRow, body);
  }

  refreshResults();
  container.append(controls, results);
}

/**
 * @param {import('../types.js').Transaction} tx
 * @returns {HTMLElement}
 */
function transactionRow(tx) {
  const categoryLabel = store.categoryName(tx.categoryId);
  const walletLabel = tx.walletId ? store.walletName(tx.walletId) : '';
  const meta = [categoryLabel, walletLabel].filter(Boolean).join(' · ');
  // The note (Catatan) is the title when present; otherwise the category is.
  const title = tx.note ? tx.note : categoryLabel;
  return el('li', { class: 'tx-item' }, [
    tx.photo
      ? el('img', {
          class: 'tx-thumb',
          src: tx.photo,
          alt: t.tx.viewPhoto,
          'aria-label': t.tx.viewPhoto,
          onClick: (e) => {
            e.stopPropagation();
            openPhotoViewer(tx.photo);
          },
        })
      : null,
    el('div', { class: 'tx-main' }, [
      el('div', { class: 'tx-cat' }, title),
      el('div', { class: 'tx-meta' }, meta),
    ]),
    el('div', { class: 'tx-amount ' + tx.type }, signedMoney(tx.amount, tx.type)),
    el('div', { class: 'tx-actions' }, [
      el(
        'button',
        { class: 'icon-btn', 'aria-label': t.tx.editAria, onClick: () => openTransactionForm(tx) },
        icon('edit', { size: 18 })
      ),
      el(
        'button',
        { class: 'icon-btn', 'aria-label': t.tx.deleteAria, onClick: () => confirmDelete(tx) },
        icon('trash', { size: 18 })
      ),
    ]),
  ]);
}

/** @param {import('../types.js').Transaction} tx */
function confirmDelete(tx) {
  confirmDialog({
    title: t.tx.deleteTitle,
    message: t.tx.deleteMsg(
      typeLabel(tx.type),
      signedMoney(tx.amount, tx.type),
      store.categoryName(tx.categoryId)
    ),
    confirmLabel: t.app.delete,
    onConfirm: () => store.removeTransaction(tx.id),
  });
}

/** Open the advanced filter sheet (date range, wallet, category, type). */
function openFilterSheet() {
  const state = store.getState();
  const f = { ...state.txFilters };

  const content = el('div', { class: 'stack' });

  const fromInput = el('input', {
    type: 'date',
    value: f.from,
    onInput: (e) => (f.from = e.target.value),
  });
  const toInput = el('input', {
    type: 'date',
    value: f.to,
    onInput: (e) => (f.to = e.target.value),
  });

  const walletSelect = el(
    'select',
    { onChange: (e) => (f.walletId = e.target.value) },
    [
      el('option', { value: '', selected: !f.walletId }, t.tx.allWallets),
      ...state.wallets.map((w) =>
        el('option', { value: w.id, selected: w.id === f.walletId }, w.name)
      ),
    ]
  );

  const catSelect = el(
    'select',
    { onChange: (e) => (f.categoryId = e.target.value) },
    [
      el('option', { value: '', selected: !f.categoryId }, t.tx.allCategories),
      ...state.categories.map((c) =>
        el('option', { value: c.id, selected: c.id === f.categoryId }, store.categoryName(c.id))
      ),
    ]
  );

  const typeSelect = el(
    'select',
    { onChange: (e) => (f.type = e.target.value) },
    [
      el('option', { value: '', selected: !f.type }, t.tx.allTypes),
      el('option', { value: 'income', selected: f.type === 'income' }, t.tx.income),
      el('option', { value: 'expense', selected: f.type === 'expense' }, t.tx.expense),
    ]
  );

  function field(labelText, control) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, labelText),
      control,
    ]);
  }

  content.append(
    el('div', { class: 'filter-bar' }, [
      field(t.tx.dateFrom, fromInput),
      field(t.tx.dateTo, toInput),
    ]),
    field(t.tx.filterWallet, walletSelect),
    field(t.tx.filterCategory, catSelect),
    field(t.tx.filterType, typeSelect),
    el('div', { class: 'btn-row' }, [
      el(
        'button',
        {
          class: 'btn ghost',
          onClick: () => {
            store.clearTxFilters();
            closeModal();
          },
        },
        t.tx.resetFilters
      ),
      el(
        'button',
        {
          class: 'btn primary',
          onClick: () => {
            store.setTxFilters({
              from: f.from,
              to: f.to,
              walletId: f.walletId,
              categoryId: f.categoryId,
              type: f.type,
            });
            closeModal();
          },
        },
        t.tx.applyFilters
      ),
    ])
  );

  openModal(t.tx.filterTitle, content);
}
