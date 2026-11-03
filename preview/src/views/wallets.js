// @ts-check
/**
 * Dompet (wallets/accounts) — Phase 2 + polish (Req 14).
 * Wallet list where tapping a row expands an inline panel beneath it with the
 * rekening (+ copy) and actions (set primary / edit / delete). Line-style
 * icons only (no emoji). Credit-card wallets show negative saldo.
 * @typedef {import('../types.js').Wallet} Wallet
 * @typedef {import('../types.js').WalletType} WalletType
 */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { money, parseAmount, groupDigits } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { icon, walletTypeIcon } from '../lib/icons.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

const WALLET_TYPES = /** @type {WalletType[]} */ (['bank', 'ewallet', 'cash', 'credit']);

/** Currently expanded wallet row (wallet id) so only one is open at a time. */
let expandedId = null;

/**
 * Render the Dompet view.
 * @param {HTMLElement} container
 */
export function renderWallets(container) {
  const rows = store.walletsWithSaldo();
  const hidden = store.isHidden('dompet');
  const total = store.totalSaldo();

  let listNode;
  if (rows.length === 0) {
    listNode = el('div', { class: 'empty' }, [
      el('div', {}, t.wallet.emptyTitle),
      el('div', { style: 'font-size:0.85rem;margin-top:4px' }, t.wallet.emptyHint),
    ]);
  } else {
    listNode = el('ul', { class: 'wallet-list' }, rows.map(({ wallet, saldo }) => walletRow(wallet, saldo, hidden)));
    // Enable drag-to-reorder via the grip handle on each row.
    setupWalletDrag(listNode);
  }

  container.append(
    totalSaldoCard(total, hidden),
    el('div', { style: 'margin:14px 0' },
      el('button', { class: 'btn primary full', onClick: () => openWalletForm() }, '+ ' + t.wallet.addButton)
    ),
    el('div', { class: 'section-title' }, t.wallet.yourWallets),
    listNode
  );
}

/**
 * Total saldo across all wallets with a privacy lock toggle (Req 14.3).
 * @param {number} total @param {boolean} hidden
 * @returns {HTMLElement}
 */
function totalSaldoCard(total, hidden) {
  return el('div', { class: 'saldo-card' }, [
    el('div', { class: 'saldo-head' }, [
      el('span', { class: 'saldo-label' }, t.wallet.totalSaldo),
      el(
        'button',
        {
          class: 'saldo-lock',
          'aria-label': hidden ? t.wallet.showBalance : t.wallet.hideBalance,
          'aria-pressed': hidden ? 'true' : 'false',
          onClick: () => store.toggleHidden('dompet'),
        },
        icon(hidden ? 'lock' : 'unlock', { size: 18 })
      ),
    ]),
    el(
      'div',
      { class: 'saldo-value' + (total < 0 ? ' negative' : '') },
      hidden ? t.wallet.hidden : money(total)
    ),
  ]);
}

/**
 * A wallet row: the whole row is a button that toggles an inline dropdown
 * panel expanding beneath it.
 * @param {Wallet} w @param {number} saldo @param {boolean} hidden
 * @returns {HTMLElement}
 */
function walletRow(w, saldo, hidden) {
  const isCredit = w.type === 'credit';
  const negative = saldo < 0;
  const saldoText = hidden
    ? t.wallet.hidden
    : isCredit && negative
    ? `${money(saldo)} · ${t.wallet.owed}`
    : money(saldo);

  const isOpen = expandedId === w.id;

  // Drag handle (grip): press-and-drag to reorder. Kept separate from the
  // row button so tapping the row still expands it.
  const handle = el(
    'span',
    { class: 'wallet-drag', 'aria-label': t.wallet.dragHandle, role: 'button' },
    icon('grip', { size: 18 })
  );

  // The clickable row header (the whole row is the toggle).
  const rowBtn = el(
    'button',
    {
      class: 'wallet-row' + (isOpen ? ' open' : ''),
      'aria-expanded': isOpen ? 'true' : 'false',
      onClick: () => {
        expandedId = isOpen ? null : w.id;
        rerender();
      },
    },
    [
      el('span', { class: 'wallet-icon', 'aria-hidden': 'true' }, icon(walletTypeIcon(w.type), { size: 22 })),
      el('div', { class: 'wallet-main' }, [
        el('div', { class: 'wallet-name-row' }, [
          el('span', { class: 'wallet-name' }, w.name),
          w.isPrimary ? el('span', { class: 'badge primary-badge' }, t.wallet.primaryBadge) : null,
        ]),
        el('div', { class: 'wallet-type' }, t.wallet.types[w.type] || ''),
      ]),
      el('span', { class: 'wallet-saldo ' + (negative ? 'negative' : '') }, saldoText),
      el(
        'span',
        { class: 'wallet-chevron' + (isOpen ? ' open' : ''), 'aria-hidden': 'true' },
        icon('chevronDown', { size: 18 })
      ),
    ]
  );

  const header = el('div', { class: 'wallet-row-wrap' }, [handle, rowBtn]);
  const children = [header];
  if (isOpen) children.push(walletPanel(w));

  return el('li', { class: 'wallet-item' + (isOpen ? ' open' : ''), dataset: { id: w.id } }, children);
}

/**
 * Wire pointer-based drag-to-reorder on the wallet list. Dragging starts from
 * a row's `.wallet-drag` handle; on drop the new order is persisted.
 * @param {HTMLElement} listEl - the <ul class="wallet-list">
 */
function setupWalletDrag(listEl) {
  /** @type {HTMLElement|null} */
  let dragItem = null;
  let startY = 0;
  let moved = false;

  listEl.addEventListener('pointerdown', (e) => {
    const handle = e.target instanceof Element ? e.target.closest('.wallet-drag') : null;
    if (!handle) return;
    const item = handle.closest('.wallet-item');
    if (!item) return;
    e.preventDefault();
    dragItem = /** @type {HTMLElement} */ (item);
    startY = e.clientY;
    moved = false;
    dragItem.classList.add('dragging');
    handle.setPointerCapture?.(e.pointerId);
  });

  listEl.addEventListener('pointermove', (e) => {
    if (!dragItem) return;
    if (Math.abs(e.clientY - startY) > 3) moved = true;

    const others = Array.from(listEl.querySelectorAll('.wallet-item')).filter((n) => n !== dragItem);

    // Decide the target position under the pointer.
    let target = null;
    for (const sib of others) {
      const rect = sib.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        target = sib;
        break;
      }
    }
    const willMove = target
      ? dragItem.nextSibling !== target
      : listEl.lastElementChild !== dragItem;
    if (!willMove) return;

    // FLIP: record positions, move, then animate siblings from old->new.
    const first = new Map();
    for (const n of others) first.set(n, n.getBoundingClientRect().top);

    if (target) listEl.insertBefore(dragItem, target);
    else listEl.appendChild(dragItem);

    for (const n of others) {
      const prev = first.get(n);
      const now = n.getBoundingClientRect().top;
      const delta = prev - now;
      if (!delta) continue;
      n.classList.remove('settling');
      n.style.transform = `translateY(${delta}px)`;
      // Next frame: transition back to natural position.
      requestAnimationFrame(() => {
        n.classList.add('settling');
        n.style.transform = '';
      });
    }
  });

  function endDrag(e) {
    if (!dragItem) return;
    dragItem.classList.remove('dragging');
    dragItem = null;
    // Clear any lingering FLIP transition state.
    for (const n of listEl.querySelectorAll('.wallet-item')) {
      n.classList.remove('settling');
      n.style.transform = '';
    }
    if (moved) {
      const ids = Array.from(listEl.querySelectorAll('.wallet-item')).map(
        (n) => /** @type {HTMLElement} */ (n).dataset.id
      );
      store.reorderWallets(ids);
    }
  }
  listEl.addEventListener('pointerup', endDrag);
  listEl.addEventListener('pointercancel', endDrag);
}

/**
 * The inline dropdown panel shown beneath an expanded wallet row.
 * @param {Wallet} w
 * @returns {HTMLElement}
 */
function walletPanel(w) {
  const acct = w.accountNumber || '';
  const copyBtn = el(
    'button',
    {
      class: 'btn ghost sm',
      disabled: acct ? undefined : true,
      onClick: (e) => {
        e.stopPropagation();
        copyToClipboard(acct, e.currentTarget);
      },
    },
    [icon('copy', { size: 16 }), el('span', {}, t.wallet.copy)]
  );

  const rekeningRow = el('div', { class: 'menu-rekening' }, [
    el('div', { class: 'menu-rekening-label' }, t.wallet.accountNumber),
    el('div', { class: 'menu-rekening-row' }, [
      el('span', { class: 'menu-rekening-value' + (acct ? '' : ' muted') }, acct || t.wallet.noAccountNumber),
      copyBtn,
    ]),
  ]);

  const items = [];
  if (!w.isPrimary) {
    items.push(
      menuAction('star', t.wallet.setPrimary, () => {
        expandedId = null;
        store.setPrimaryWallet(w.id);
      })
    );
  }
  items.push(
    menuAction('edit', t.app.edit, () => {
      openWalletForm(w);
    })
  );
  const isLast = store.getState().wallets.length <= 1;
  if (!isLast) {
    items.push(
      menuAction('trash', t.app.delete, () => {
        confirmDeleteWallet(w);
      }, true)
    );
  }

  return el('div', { class: 'wallet-panel', onClick: (e) => e.stopPropagation() }, [
    rekeningRow,
    el('div', { class: 'menu-divider' }),
    ...items,
  ]);
}

/**
 * @param {import('../lib/icons.js').icon} iconName
 * @param {string} label @param {() => void} onClick @param {boolean} [danger]
 */
function menuAction(iconName, label, onClick, danger) {
  return el(
    'button',
    {
      class: 'menu-action' + (danger ? ' danger' : ''),
      onClick: (e) => {
        e.stopPropagation();
        onClick();
        rerender();
      },
    },
    [icon(/** @type {any} */ (iconName), { size: 18 }), el('span', {}, label)]
  );
}

/** Copy text to clipboard with a brief "Tersalin!" confirmation. */
function copyToClipboard(text, btnEl) {
  if (!text) return;
  const done = () => {
    const span = btnEl.querySelector('span');
    if (span) {
      const orig = span.textContent;
      span.textContent = t.wallet.copied;
      setTimeout(() => {
        span.textContent = orig;
      }, 1200);
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  } catch {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch {
    /* ignore */
  }
}

/** Re-render the app by notifying the store subscribers (no state change). */
function rerender() {
  // The store's notify() drives a full re-render; toggle a no-op mutation by
  // re-setting the selected month to itself.
  store.setSelectedMonth(store.getState().selectedMonth);
}

/**
 * Open the add/edit wallet form in a modal.
 * @param {Wallet} [existing]
 */
function openWalletForm(existing) {
  const isEdit = !!existing;
  const form = {
    name: existing ? existing.name : '',
    type: /** @type {WalletType} */ (existing ? existing.type : 'bank'),
    balance: existing ? groupDigits(String(existing.balance)) : '',
    accountNumber: existing && existing.accountNumber ? existing.accountNumber : '',
  };
  /** @type {Record<string,string>} */
  let errors = {};

  const content = el('form', { class: 'stack', novalidate: 'true' });

  function rebuild() {
    content.textContent = '';

    const nameInput = el('input', {
      type: 'text',
      value: form.name,
      placeholder: t.wallet.namePlaceholder,
      class: errors.name ? 'invalid' : '',
      onInput: (e) => (form.name = e.target.value),
    });

    const typeSelect = el(
      'select',
      { onChange: (e) => (form.type = e.target.value) },
      WALLET_TYPES.map((ty) =>
        el('option', { value: ty, selected: ty === form.type }, t.wallet.types[ty])
      )
    );

    const balanceInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form.balance,
      placeholder: t.tx.amountPlaceholder,
      class: errors.balance ? 'invalid' : '',
      onInput: (e) => {
        e.target.value = groupDigits(e.target.value);
        form.balance = e.target.value;
      },
    });

    const acctInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      value: form.accountNumber,
      placeholder: t.wallet.accountNumberPlaceholder,
      onInput: (e) => (form.accountNumber = e.target.value),
    });

    content.append(
      field(t.wallet.name, nameInput, errors.name),
      field(t.wallet.type, typeSelect),
      field(t.wallet.initialBalance, balanceInput, errors.balance),
      field(t.wallet.accountNumber, acctInput),
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
    const rawBalance = form.balance.trim();
    let balance = 0;
    if (rawBalance !== '') {
      balance = parseAmount(rawBalance);
      if (Number.isNaN(balance)) errors.balance = t.wallet.balanceInvalid;
    }
    if (!name) errors.name = t.wallet.nameRequired;

    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }

    const payload = {
      name,
      type: form.type,
      balance,
      accountNumber: form.accountNumber.trim() || undefined,
    };
    if (isEdit && existing) {
      await store.editWallet(existing.id, payload);
    } else {
      await store.addWallet(payload);
    }
    closeModal();
  });

  rebuild();
  openModal(isEdit ? t.wallet.editTitle : t.wallet.addTitle, content);
}

/** @param {Wallet} w */
function confirmDeleteWallet(w) {
  const linked = store.getState().transactions.filter((tx) => tx.walletId === w.id).length;
  confirmDialog({
    title: t.wallet.deleteTitle,
    message: t.wallet.deleteMsg(w.name, linked),
    confirmLabel: t.app.delete,
    onConfirm: () => store.removeWallet(w.id),
  });
}
