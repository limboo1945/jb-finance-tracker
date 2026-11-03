// @ts-check
/**
 * Aset (assets / net worth) — Phase 5 (Req 17).
 * Net worth header, three-total breakdown (Dompet & Akun / Aset Likuid /
 * Aset Tetap), Total Runway, and manual asset add/edit/delete.
 * @typedef {import('../types.js').Asset} Asset
 * @typedef {import('../types.js').AssetClass} AssetClass
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money, parseAmount, groupDigits } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

/**
 * Render the Aset view.
 * @param {HTMLElement} container
 */
export function renderAssets(container) {
  const hidden = store.isHidden('aset');
  const nw = store.netWorth();
  const b = store.assetsBreakdown();
  const runway = store.runwayMonths();
  const assets = store.getState().assets.slice().sort((a, b2) => (b2.createdAt || 0) - (a.createdAt || 0));

  container.append(
    netWorthCard(nw, hidden),
    breakdownCard(b, runway, hidden),
    el('div', { style: 'margin:14px 0' },
      el('button', { class: 'btn primary full', onClick: () => openAssetForm() }, '+ ' + t.aset.addButton)
    ),
    el('div', { class: 'section-title' }, t.aset.yourAssets),
    assets.length === 0
      ? el('div', { class: 'empty' }, [
          el('div', {}, t.aset.emptyTitle),
          el('div', { style: 'font-size:0.85rem;margin-top:4px' }, t.aset.emptyHint),
        ])
      : el('ul', { class: 'wallet-list' }, assets.map((a) => assetRow(a, hidden)))
  );
}

/** Net worth header card. */
function netWorthCard(nw, hidden) {
  return el('div', { class: 'saldo-card' }, [
    el('div', { class: 'saldo-head' }, [
      el('span', { class: 'saldo-label' }, t.aset.netWorth),
      el(
        'button',
        {
          class: 'saldo-lock',
          'aria-label': hidden ? t.wallet.showBalance : t.wallet.hideBalance,
          'aria-pressed': hidden ? 'true' : 'false',
          onClick: () => store.toggleHidden('aset'),
        },
        icon(hidden ? 'lock' : 'unlock', { size: 18 })
      ),
    ]),
    el('div', { class: 'saldo-value' + (nw < 0 ? ' negative' : '') }, hidden ? t.wallet.hidden : money(nw)),
  ]);
}

/** Three-total breakdown + Total Runway. */
function breakdownCard(b, runway, hidden) {
  const val = (n) => (hidden ? t.wallet.hidden : money(n));
  const line = (label, value) =>
    el('div', { class: 'breakdown-row' }, [
      el('span', { class: 'breakdown-label' }, label),
      el('span', { class: 'breakdown-val' }, value),
    ]);
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-title', style: 'margin-top:0' }, t.aset.breakdown),
    line(t.aset.walletsTotal, val(b.walletsTotal)),
    line(t.aset.liquidTotal, val(b.liquidTotal)),
    line(t.aset.fixedTotal, val(b.fixedTotal)),
    el('div', { class: 'breakdown-divider' }),
    el('div', { class: 'runway-row' }, [
      el('div', {}, [
        el('div', { class: 'runway-label' }, t.aset.runway),
        el('div', { class: 'field-hint', style: 'margin-top:2px' }, t.aset.runwayHint),
      ]),
      el(
        'div',
        { class: 'runway-value' },
        runway == null ? t.aset.runwayNA : t.aset.runwayMonths(formatMonths(runway))
      ),
    ]),
  ]);
}

/** Format runway months with one decimal when not whole. */
function formatMonths(n) {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** @param {Asset} a @param {boolean} hidden */
function assetRow(a, hidden) {
  const clsLabel = a.assetClass === 'liquid' ? t.aset.classLiquid : t.aset.classFixed;
  return el('li', { class: 'wallet-item' }, [
    el('div', { class: 'wallet-row', style: 'cursor:default' }, [
      el('span', { class: 'wallet-icon', 'aria-hidden': 'true' }, icon('diamond', { size: 20 })),
      el('div', { class: 'wallet-main' }, [
        el('div', { class: 'wallet-name' }, a.name),
        el('div', { class: 'wallet-type' }, clsLabel),
      ]),
      el('span', { class: 'wallet-saldo' }, hidden ? t.wallet.hidden : money(a.value)),
      el('span', { class: 'asset-actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': t.app.edit, onClick: () => openAssetForm(a) }, icon('edit', { size: 18 })),
        el('button', { class: 'icon-btn', 'aria-label': t.app.delete, onClick: () => confirmDeleteAsset(a) }, icon('trash', { size: 18 })),
      ]),
    ]),
  ]);
}

/**
 * Add/edit asset form modal.
 * @param {Asset} [existing]
 */
function openAssetForm(existing) {
  const isEdit = !!existing;
  const form = {
    name: existing ? existing.name : '',
    assetClass: /** @type {AssetClass} */ (existing ? existing.assetClass : 'liquid'),
    value: existing ? groupDigits(String(existing.value)) : '',
  };
  /** @type {Record<string,string>} */
  let errors = {};
  const content = el('form', { class: 'stack', novalidate: 'true' });

  function rebuild() {
    content.textContent = '';
    const nameInput = el('input', {
      type: 'text',
      value: form.name,
      placeholder: t.aset.namePlaceholder,
      class: errors.name ? 'invalid' : '',
      onInput: (e) => (form.name = e.target.value),
    });
    const classSelect = el(
      'select',
      { onChange: (e) => (form.assetClass = e.target.value) },
      [
        el('option', { value: 'liquid', selected: form.assetClass === 'liquid' }, t.aset.classLiquid),
        el('option', { value: 'fixed', selected: form.assetClass === 'fixed' }, t.aset.classFixed),
      ]
    );
    const valueInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form.value,
      placeholder: t.tx.amountPlaceholder,
      class: errors.value ? 'invalid' : '',
      onInput: (e) => {
        e.target.value = groupDigits(e.target.value);
        form.value = e.target.value;
      },
    });
    content.append(
      field(t.aset.name, nameInput, errors.name),
      field(t.aset.class, classSelect),
      field(t.aset.value, valueInput, errors.value),
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
    const raw = form.value.trim();
    let value = 0;
    if (raw !== '') {
      value = parseAmount(raw);
      if (Number.isNaN(value)) errors.value = t.aset.valueInvalid;
    }
    if (!name) errors.name = t.aset.nameRequired;
    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }
    const payload = { name, assetClass: form.assetClass, value };
    if (isEdit && existing) await store.editAsset(existing.id, payload);
    else await store.addAsset(payload);
    closeModal();
  });

  rebuild();
  openModal(isEdit ? t.aset.editTitle : t.aset.addTitle, content);
}

/** @param {Asset} a */
function confirmDeleteAsset(a) {
  confirmDialog({
    title: t.aset.deleteTitle,
    message: t.aset.deleteMsg(a.name),
    confirmLabel: t.app.delete,
    onConfirm: () => store.removeAsset(a.id),
  });
}
