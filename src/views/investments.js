// @ts-check
/**
 * Investasi (investments) — Phase 7 (Req 19).
 * Portfolio total value + overall gain/loss (Rupiah + %, colored), per-holding
 * gain/loss, and add/edit/delete with grouped amount inputs.
 * @typedef {import('../types.js').Investment} Investment
 * @typedef {import('../types.js').InvestmentType} InvestmentType
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money, parseAmount, groupDigits } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

const INV_TYPES = /** @type {InvestmentType[]} */ (['saham', 'reksadana', 'kripto', 'lainnya']);

/**
 * Render the Investasi view.
 * @param {HTMLElement} container
 */
export function renderInvestments(container) {
  const hidden = store.isHidden('investasi');
  const totals = store.investTotals();
  const list = store.investmentsSorted();

  container.append(
    totalsCard(totals, hidden),
    el('div', { style: 'margin:14px 0' },
      el('button', { class: 'btn primary full', onClick: () => openInvestForm() }, '+ ' + t.investasi.addButton)
    ),
    el('div', { class: 'section-title' }, t.investasi.yourInvestments),
    list.length === 0
      ? el('div', { class: 'empty' }, [
          el('div', {}, t.investasi.emptyTitle),
          el('div', { style: 'font-size:0.85rem;margin-top:4px' }, t.investasi.emptyHint),
        ])
      : el('div', { class: 'debt-list' }, list.map((v) => investRow(v, hidden)))
  );
}

/** Total value + overall gain/loss card. */
function totalsCard(totals, hidden) {
  const gainClass = totals.gain > 0 ? 'positive' : totals.gain < 0 ? 'negative' : '';
  return el('div', { class: 'saldo-card' }, [
    el('div', { class: 'saldo-head' }, [
      el('span', { class: 'saldo-label' }, t.investasi.totalValue),
      el(
        'button',
        {
          class: 'saldo-lock',
          'aria-label': hidden ? t.wallet.showBalance : t.wallet.hideBalance,
          'aria-pressed': hidden ? 'true' : 'false',
          onClick: () => store.toggleHidden('investasi'),
        },
        icon(hidden ? 'lock' : 'unlock', { size: 18 })
      ),
    ]),
    el('div', { class: 'saldo-value' }, hidden ? t.wallet.hidden : money(totals.current)),
    el('div', { class: 'invest-total-gain ' + gainClass },
      hidden ? t.wallet.hidden : `${signedMoney(totals.gain)} · ${signedPct(totals.gainPct)}`
    ),
  ]);
}

/** @param {Investment} v @param {boolean} hidden */
function investRow(v, hidden) {
  const { gain, gainPct } = store.investmentGainLoss(v);
  const gainClass = gain > 0 ? 'positive' : gain < 0 ? 'negative' : '';
  return el('div', { class: 'debt-item' }, [
    el('div', { class: 'debt-head' }, [
      el('div', { class: 'debt-name-row' }, [
        el('span', { class: 'debt-name' }, v.name),
        el('span', { class: 'badge' }, t.investasi.types[v.invType] || ''),
      ]),
      el('div', { class: 'debt-actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': t.app.edit, onClick: () => openInvestForm(v) }, icon('edit', { size: 18 })),
        el('button', { class: 'icon-btn', 'aria-label': t.app.delete, onClick: () => confirmDeleteInvest(v) }, icon('trash', { size: 18 })),
      ]),
    ]),
    el('div', { class: 'invest-values' }, [
      el('span', { class: 'invest-value-item' }, `${t.investasi.currentLabel}: ${hidden ? t.wallet.hidden : money(v.currentValue)}`),
      el('span', { class: 'invest-value-item muted' }, `${t.investasi.investedLabel}: ${hidden ? t.wallet.hidden : money(v.invested)}`),
    ]),
    el('div', { class: 'invest-gain ' + gainClass },
      hidden ? t.wallet.hidden : `${signedMoney(gain)} · ${signedPct(gainPct)}`
    ),
    el('div', { style: 'margin-top:10px' },
      el('button', { class: 'btn ghost full', onClick: () => openAddFundsForm(v) }, '+ ' + t.investasi.addFunds)
    ),
  ]);
}

/**
 * "Tambah Dana" modal — add more money to an existing holding, optionally
 * deducting from a chosen dompet.
 * @param {Investment} v
 */
function openAddFundsForm(v) {
  const wallets = store.getState().wallets;
  const form = { amount: '', sourceWalletId: '' };
  /** @type {Record<string,string>} */
  let errors = {};
  const content = el('form', { class: 'stack', novalidate: 'true' });

  function rebuild() {
    content.textContent = '';
    const amountInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form.amount,
      placeholder: t.tx.amountPlaceholder,
      class: errors.amount ? 'invalid' : '',
      onInput: (e) => {
        e.target.value = groupDigits(e.target.value);
        form.amount = e.target.value;
      },
    });

    content.append(
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, t.investasi.addFundsAmount),
        amountInput,
        el('span', { class: 'field-error', role: errors.amount ? 'alert' : undefined }, errors.amount || ''),
      ])
    );

    if (wallets.length > 0) {
      const walletSelect = el(
        'select',
        { onChange: (e) => (form.sourceWalletId = e.target.value) },
        [
          el('option', { value: '', selected: form.sourceWalletId === '' }, t.investasi.sourceWalletNone),
          ...wallets.map((w) =>
            el('option', { value: w.id, selected: w.id === form.sourceWalletId }, w.name)
          ),
        ]
      );
      content.append(
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label' }, t.investasi.sourceWallet),
          walletSelect,
          el('span', { class: 'field-hint' }, t.investasi.sourceWalletHint),
        ])
      );
    }

    content.append(
      el('div', { class: 'btn-row' }, [
        el('button', { type: 'button', class: 'btn ghost', onClick: () => closeModal() }, t.app.cancel),
        el('button', { type: 'submit', class: 'btn primary' }, t.investasi.addFundsSubmit),
      ])
    );
  }

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    errors = {};
    const amount = parseAmount(form.amount);
    if (Number.isNaN(amount) || amount <= 0) errors.amount = t.investasi.addFundsAmountInvalid;
    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }
    await store.addFundsToInvestment(v.id, amount, form.sourceWalletId || undefined);
    closeModal();
  });

  rebuild();
  openModal(t.investasi.addFundsTitle(v.name), content);
}

/** Format a signed Rupiah value, e.g. +Rp100.000 / -Rp50.000. */
function signedMoney(n) {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return sign + money(Math.abs(n));
}

/** Format a signed percentage, e.g. +12,5% / -3,2%. */
function signedPct(p) {
  const sign = p > 0 ? '+' : p < 0 ? '-' : '';
  const abs = Math.abs(p);
  const s = (Number.isInteger(abs) ? String(abs) : abs.toFixed(1)).replace('.', ',');
  return `${sign}${s}%`;
}

/**
 * Add/edit investment form modal.
 * @param {Investment} [existing]
 */
function openInvestForm(existing) {
  const isEdit = !!existing;
  const wallets = store.getState().wallets;
  const primary = store.primaryWallet();
  const form = {
    name: existing ? existing.name : '',
    invType: /** @type {InvestmentType} */ (existing ? existing.invType : 'saham'),
    invested: existing ? groupDigits(String(existing.invested)) : '',
    currentValue: existing ? groupDigits(String(existing.currentValue)) : '',
    // Source wallet only applies when adding a new holding (money goes out now).
    sourceWalletId: '',
  };
  /** @type {Record<string,string>} */
  let errors = {};
  const content = el('form', { class: 'stack', novalidate: 'true' });

  function amountInput(key, invalidKey) {
    return el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form[key],
      placeholder: t.tx.amountPlaceholder,
      class: errors[invalidKey] ? 'invalid' : '',
      onInput: (e) => {
        e.target.value = groupDigits(e.target.value);
        form[key] = e.target.value;
      },
    });
  }

  function rebuild() {
    content.textContent = '';
    const nameInput = el('input', {
      type: 'text',
      value: form.name,
      placeholder: t.investasi.namePlaceholder,
      class: errors.name ? 'invalid' : '',
      onInput: (e) => (form.name = e.target.value),
    });
    const typeSelect = el(
      'select',
      { onChange: (e) => (form.invType = e.target.value) },
      INV_TYPES.map((ty) =>
        el('option', { value: ty, selected: ty === form.invType }, t.investasi.types[ty])
      )
    );

    content.append(
      field(t.investasi.name, nameInput, errors.name),
      field(t.investasi.type, typeSelect),
      field(t.investasi.invested, amountInput('invested', 'invested'), errors.invested),
      fieldWithHint(
        t.investasi.currentValue,
        amountInput('currentValue', 'currentValue'),
        t.investasi.currentValueHint,
        errors.currentValue
      )
    );

    // Source wallet picker — only when adding (deducts the modal from a dompet).
    if (!isEdit && wallets.length > 0) {
      const walletSelect = el(
        'select',
        { onChange: (e) => (form.sourceWalletId = e.target.value) },
        [
          el('option', { value: '', selected: form.sourceWalletId === '' }, t.investasi.sourceWalletNone),
          ...wallets.map((w) =>
            el('option', { value: w.id, selected: w.id === form.sourceWalletId }, w.name)
          ),
        ]
      );
      content.append(
        fieldWithHint(t.investasi.sourceWallet, walletSelect, t.investasi.sourceWalletHint)
      );
    }

    content.append(
      el('div', { class: 'btn-row' }, [
        el('button', { type: 'button', class: 'btn ghost', onClick: () => closeModal() }, t.app.cancel),
        el('button', { type: 'submit', class: 'btn primary' }, isEdit ? t.app.save : t.app.add),
      ])
    );
  }

  function field(labelText, control, error) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, labelText),
      control,
      el('span', { class: 'field-error', role: error ? 'alert' : undefined }, error || ''),
    ]);
  }

  function fieldWithHint(labelText, control, hint, error) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, labelText),
      control,
      hint ? el('span', { class: 'field-hint' }, hint) : null,
      el('span', { class: 'field-error', role: error ? 'alert' : undefined }, error || ''),
    ]);
  }

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    errors = {};
    const name = form.name.trim();
    const invested = parseAmount(form.invested);
    // Nilai sekarang is optional: blank → defaults to the invested amount.
    const currentRaw = form.currentValue.trim();
    const currentValue = currentRaw === '' ? undefined : parseAmount(form.currentValue);
    if (!name) errors.name = t.investasi.nameRequired;
    if (Number.isNaN(invested) || invested < 0) errors.invested = t.investasi.investedInvalid;
    if (currentValue !== undefined && (Number.isNaN(currentValue) || currentValue < 0)) {
      errors.currentValue = t.investasi.currentInvalid;
    }
    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }
    if (isEdit && existing) {
      // Edit keeps the explicit current value (fall back to invested if blank).
      await store.editInvestment(existing.id, {
        name,
        invType: form.invType,
        invested,
        currentValue: currentValue === undefined ? invested : currentValue,
      });
    } else {
      await store.addInvestment({
        name,
        invType: form.invType,
        invested,
        currentValue,
        sourceWalletId: form.sourceWalletId || undefined,
      });
    }
    closeModal();
  });

  rebuild();
  openModal(isEdit ? t.investasi.editTitle : t.investasi.addTitle, content);
}

/** @param {Investment} v */
function confirmDeleteInvest(v) {
  confirmDialog({
    title: t.investasi.deleteTitle,
    message: t.investasi.deleteMsg(v.name),
    confirmLabel: t.app.delete,
    onConfirm: () => store.removeInvestment(v.id),
  });
}
