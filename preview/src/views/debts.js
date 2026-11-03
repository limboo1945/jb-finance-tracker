// @ts-check
/**
 * Utang (debt tracking) — Phase 6 (Req 18).
 * Overall total remaining card, debt list (remaining, progress, due date +
 * overdue indicator), and add/edit/delete with grouped amount inputs.
 * @typedef {import('../types.js').Debt} Debt
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money, parseAmount, groupDigits } from '../lib/format.js';
import { formatDateLabel } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

/**
 * Render the Utang view.
 * @param {HTMLElement} container
 */
export function renderDebts(container) {
  const hidden = store.isHidden('utang');
  const total = store.totalDebt();
  const debts = store.debtsSorted();

  container.append(
    totalDebtCard(total, hidden),
    el('div', { style: 'margin:14px 0' },
      el('button', { class: 'btn primary full', onClick: () => openDebtForm() }, '+ ' + t.utang.addButton)
    ),
    el('div', { class: 'section-title' }, t.utang.yourDebts),
    debts.length === 0
      ? el('div', { class: 'empty' }, [
          el('div', {}, t.utang.emptyTitle),
          el('div', { style: 'font-size:0.85rem;margin-top:4px' }, t.utang.emptyHint),
        ])
      : el('div', { class: 'debt-list' }, debts.map((d) => debtRow(d, hidden)))
  );
}

/** Overall total remaining debt card. */
function totalDebtCard(total, hidden) {
  return el('div', { class: 'saldo-card' }, [
    el('div', { class: 'saldo-head' }, [
      el('span', { class: 'saldo-label' }, t.utang.totalDebt),
      el(
        'button',
        {
          class: 'saldo-lock',
          'aria-label': hidden ? t.wallet.showBalance : t.wallet.hideBalance,
          'aria-pressed': hidden ? 'true' : 'false',
          onClick: () => store.toggleHidden('utang'),
        },
        icon(hidden ? 'lock' : 'unlock', { size: 18 })
      ),
    ]),
    el('div', { class: 'saldo-value' + (total > 0 ? ' negative' : '') }, hidden ? t.wallet.hidden : money(total)),
  ]);
}

/** @param {Debt} d @param {boolean} hidden */
function debtRow(d, hidden) {
  const remaining = store.debtRemaining(d);
  const lunas = remaining <= 0;
  const overdue = store.isDebtOverdue(d);
  const pct = d.total > 0 ? Math.min(100, Math.round((d.paid / d.total) * 100)) : 0;

  const badges = [];
  if (lunas) badges.push(el('span', { class: 'badge lunas-badge' }, t.utang.lunas));
  else if (overdue) badges.push(el('span', { class: 'badge overdue-badge' }, t.utang.overdue));

  return el('div', { class: 'debt-item' }, [
    el('div', { class: 'debt-head' }, [
      el('div', { class: 'debt-name-row' }, [
        el('span', { class: 'debt-name' }, d.name),
        ...badges,
      ]),
      el('div', { class: 'debt-actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': t.app.edit, onClick: () => openDebtForm(d) }, icon('edit', { size: 18 })),
        el('button', { class: 'icon-btn', 'aria-label': t.app.delete, onClick: () => confirmDeleteDebt(d) }, icon('trash', { size: 18 })),
      ]),
    ]),
    el('div', { class: 'debt-remaining' + (lunas ? ' lunas' : '') },
      hidden ? t.wallet.hidden : t.utang.remainingOf(money(remaining), money(d.total))
    ),
    el('div', { class: 'progress-track' },
      el('div', { class: 'progress-fill', style: `width:${pct}%` })
    ),
    d.dueDate
      ? el('div', { class: 'debt-due' + (overdue ? ' overdue' : '') }, t.utang.due(formatDateLabel(d.dueDate)))
      : null,
  ]);
}

/**
 * Add/edit debt form modal.
 * @param {Debt} [existing]
 */
function openDebtForm(existing) {
  const isEdit = !!existing;
  const form = {
    name: existing ? existing.name : '',
    total: existing ? groupDigits(String(existing.total)) : '',
    paid: existing ? groupDigits(String(existing.paid)) : '',
    dueDate: existing && existing.dueDate ? existing.dueDate : '',
  };
  /** @type {Record<string,string>} */
  let errors = {};
  const content = el('form', { class: 'stack', novalidate: 'true' });

  function amountInput(key) {
    return el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form[key],
      placeholder: t.tx.amountPlaceholder,
      class: errors[key] ? 'invalid' : '',
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
      placeholder: t.utang.namePlaceholder,
      class: errors.name ? 'invalid' : '',
      onInput: (e) => (form.name = e.target.value),
    });
    const dueInput = el('input', {
      type: 'date',
      value: form.dueDate,
      onInput: (e) => (form.dueDate = e.target.value),
    });
    content.append(
      field(t.utang.name, nameInput, errors.name),
      field(t.utang.total, amountInput('total'), errors.total),
      field(t.utang.paid, amountInput('paid')),
      field(t.utang.dueDate, dueInput),
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

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    errors = {};
    const name = form.name.trim();
    const total = parseAmount(form.total);
    const paid = form.paid.trim() === '' ? 0 : parseAmount(form.paid);
    if (!name) errors.name = t.utang.nameRequired;
    if (Number.isNaN(total) || total <= 0) errors.total = t.utang.totalInvalid;
    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }
    const payload = {
      name,
      total,
      paid: Number.isNaN(paid) ? 0 : paid,
      dueDate: form.dueDate || undefined,
    };
    if (isEdit && existing) await store.editDebt(existing.id, payload);
    else await store.addDebt(payload);
    closeModal();
  });

  rebuild();
  openModal(isEdit ? t.utang.editTitle : t.utang.addTitle, content);
}

/** @param {Debt} d */
function confirmDeleteDebt(d) {
  confirmDialog({
    title: t.utang.deleteTitle,
    message: t.utang.deleteMsg(d.name),
    confirmLabel: t.app.delete,
    onConfirm: () => store.removeDebt(d.id),
  });
}
