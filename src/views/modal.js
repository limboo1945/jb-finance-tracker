// @ts-check
/** Reusable modal + confirm dialog. Framework-free. */
import { el } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/** @type {HTMLElement|null} */
let currentBackdrop = null;

/**
 * Open a modal with the given title and content node.
 * Returns a close() function.
 * @param {string} title
 * @param {Node} content
 * @returns {() => void}
 */
export function openModal(title, content) {
  closeModal(); // only one at a time

  const header = el('div', { class: 'modal-header' }, [
    el('h2', {}, title),
    el(
      'button',
      {
        class: 'modal-close',
        type: 'button',
        'aria-label': t.app.close,
        onClick: () => closeModal(),
      },
      '✕'
    ),
  ]);

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
    header,
    content,
  ]);

  const backdrop = el(
    'div',
    {
      class: 'modal-backdrop',
      onClick: (e) => {
        if (e.target === backdrop) closeModal();
      },
    },
    modal
  );

  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKey);
  // @ts-ignore stash cleanup
  backdrop.__cleanup = () => document.removeEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
  currentBackdrop = backdrop;

  // Focus first focusable element for accessibility.
  const focusable = modal.querySelector(
    'input, select, textarea, button'
  );
  if (focusable instanceof HTMLElement) setTimeout(() => focusable.focus(), 30);

  return closeModal;
}

/** Close the currently open modal, if any. */
export function closeModal() {
  if (currentBackdrop) {
    // @ts-ignore
    if (typeof currentBackdrop.__cleanup === 'function') currentBackdrop.__cleanup();
    currentBackdrop.remove();
    currentBackdrop = null;
  }
}

/**
 * Confirmation dialog (Req 2.3). Calls onConfirm when the user confirms.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {() => void} opts.onConfirm
 * @param {string} [opts.confirmLabel]
 * @param {boolean} [opts.danger]
 */
export function confirmDialog({ title, message, onConfirm, confirmLabel, danger = true }) {
  const content = el('div', { class: 'stack' }, [
    el('p', { style: 'margin:0;color:var(--text-muted)' }, message),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn ghost', onClick: () => closeModal() }, t.app.cancel),
      el(
        'button',
        {
          class: 'btn ' + (danger ? 'danger' : 'primary'),
          onClick: () => {
            closeModal();
            onConfirm();
          },
        },
        confirmLabel || t.app.confirm
      ),
    ]),
  ]);
  openModal(title, content);
}
