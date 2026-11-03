// @ts-check
/**
 * Category manager: list categories grouped by kind (Pemasukan/Pengeluaran),
 * add custom (reject duplicates, pick kind), and delete any category —
 * including defaults — with an in-use confirmation.
 */
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import * as store from '../state/store.js';
import { categoryNameExists } from '../lib/validation.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';

/**
 * Render the category manager UI into a page container (routed secondary view).
 * @param {HTMLElement} container
 */
export function renderCategoryManager(container) {
  const content = el('div', { class: 'stack' });
  buildCategoryManager(content);
  container.append(content);
}

/** Open the category manager as a modal (kept for callers that prefer it). */
export function openCategoryManager() {
  const content = el('div', { class: 'stack' });
  buildCategoryManager(content);
  openModal(t.category.title, content);
}

/**
 * Build the category manager UI into the given `content` element. Works both
 * as modal content and as a routed page body.
 * @param {HTMLElement} content
 */
function buildCategoryManager(content) {
  // Add-form state (kept across rebuilds within this session).
  let inputValue = '';
  /** @type {import('../types.js').TxType} */
  let addKind = 'expense';

  function rebuild() {
    content.textContent = '';

    const input = el('input', {
      type: 'text',
      value: inputValue,
      placeholder: t.category.newNamePlaceholder,
      'aria-label': t.category.newNameAria,
      onInput: (e) => {
        inputValue = e.target.value;
      },
    });
    const errorNode = el('span', { class: 'field-error' }, '');

    // Kind picker (income/expense) for the new category.
    const kindSeg = el('div', { class: 'segmented', role: 'group', 'aria-label': t.tx.type }, [
      kindButton('expense', t.tx.expense),
      kindButton('income', t.tx.income),
    ]);
    function kindButton(k, label) {
      return el(
        'button',
        {
          type: 'button',
          dataset: { type: k },
          class: addKind === k ? 'active' : '',
          onClick: () => {
            addKind = k;
            rebuild();
          },
        },
        label
      );
    }

    function submitAdd() {
      const name = inputValue.trim();
      let error = '';
      if (!name) error = t.category.nameRequired;
      else if (categoryNameExists(name, store.getState().categories)) error = t.category.duplicate;
      if (error) {
        errorNode.textContent = error;
        input.classList.add('invalid');
        return;
      }
      store.addCategory(name, addKind).then(() => {
        inputValue = '';
        rebuild();
      });
    }

    const addForm = el('form', { class: 'field', onSubmit: (e) => { e.preventDefault(); submitAdd(); } }, [
      el('span', { class: 'field-label' }, t.category.addLabel),
      kindSeg,
      el('div', { class: 'filter-bar', style: 'margin-top:8px' }, [
        input,
        el('button', { type: 'submit', class: 'btn primary' }, t.app.add),
      ]),
      errorNode,
    ]);

    // The toggle at the top drives both the add-form kind AND which list is
    // shown: Pengeluaran → expense categories, Pemasukan → income categories.
    content.append(
      addForm,
      kindGroup(addKind, addKind === 'income' ? t.tx.income : t.tx.expense),
      el('div', { class: 'field-hint', style: 'margin-top:4px' }, t.category.excludeHint)
    );
  }

  /** A titled, drag-reorderable list of categories of one kind. */
  function kindGroup(kind, title) {
    // Honor the manual order (same order the + dropdown uses).
    const cats = store.categoriesByKind(kind);
    let listNode = null;
    if (cats.length) {
      listNode = el(
        'ul',
        { class: 'cat-list' },
        cats.map((c) => {
          const displayName = store.categoryName(c.id);
          const excluded = !!c.excludeFromBeranda;
          return el('li', { class: 'cat-item' + (excluded ? ' excluded' : ''), dataset: { id: c.id } }, [
            el(
              'span',
              { class: 'cat-drag', 'aria-label': t.category.dragHandle, role: 'button' },
              icon('grip', { size: 18 })
            ),
            el('span', { class: 'cat-name' }, displayName),
            c.isDefault ? el('span', { class: 'badge' }, t.category.defaultBadge) : null,
            excluded ? el('span', { class: 'badge excluded-badge' }, t.category.excludedBadge) : null,
            el(
              'button',
              {
                class: 'icon-btn' + (excluded ? ' active' : ''),
                title: t.category.excludeFromBeranda,
                'aria-pressed': excluded ? 'true' : 'false',
                'aria-label': excluded
                  ? t.category.excludeAriaOn(displayName)
                  : t.category.excludeAriaOff(displayName),
                onClick: () =>
                  store.setCategoryExcludeFromBeranda(c.id, !excluded).then(() => rebuild()),
              },
              icon(excluded ? 'eyeOff' : 'eye', { size: 18 })
            ),
            el(
              'button',
              {
                class: 'icon-btn',
                'aria-label': t.category.deleteAria(displayName),
                onClick: () => deleteCategory(c, rebuild, content),
              },
              icon('trash', { size: 18 })
            ),
          ]);
        })
      );
      setupCategoryDrag(listNode, kind);
    }
    return el('div', { class: 'cat-group' }, [
      el('div', { class: 'cat-group-title ' + kind }, title),
      listNode || el('div', { class: 'field-hint', style: 'margin-bottom:4px' }, t.category.emptyKind),
    ]);
  }

  /**
   * Pointer-based drag-to-reorder for a kind's category list, with FLIP
   * animation. On drop, persists the new order via the store.
   * @param {HTMLElement} listEl @param {import('../types.js').TxType} kind
   */
  function setupCategoryDrag(listEl, kind) {
    /** @type {HTMLElement|null} */
    let dragItem = null;
    let startY = 0;
    let moved = false;

    listEl.addEventListener('pointerdown', (e) => {
      const handle = e.target instanceof Element ? e.target.closest('.cat-drag') : null;
      if (!handle) return;
      const item = handle.closest('.cat-item');
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
      const others = Array.from(listEl.querySelectorAll('.cat-item')).filter((n) => n !== dragItem);
      let target = null;
      for (const sib of others) {
        const rect = sib.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          target = sib;
          break;
        }
      }
      const willMove = target ? dragItem.nextSibling !== target : listEl.lastElementChild !== dragItem;
      if (!willMove) return;
      // FLIP: record, move, animate siblings from old->new.
      const first = new Map();
      for (const n of others) first.set(n, n.getBoundingClientRect().top);
      if (target) listEl.insertBefore(dragItem, target);
      else listEl.appendChild(dragItem);
      for (const n of others) {
        const delta = first.get(n) - n.getBoundingClientRect().top;
        if (!delta) continue;
        n.classList.remove('settling');
        n.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          n.classList.add('settling');
          n.style.transform = '';
        });
      }
    });

    function endDrag() {
      if (!dragItem) return;
      dragItem.classList.remove('dragging');
      dragItem = null;
      for (const n of listEl.querySelectorAll('.cat-item')) {
        n.classList.remove('settling');
        n.style.transform = '';
      }
      if (moved) {
        const ids = Array.from(listEl.querySelectorAll('.cat-item')).map(
          (n) => /** @type {HTMLElement} */ (n).dataset.id
        );
        store.reorderCategories(kind, ids);
      }
    }
    listEl.addEventListener('pointerup', endDrag);
    listEl.addEventListener('pointercancel', endDrag);
  }

  rebuild();
}

/**
 * Inline delete confirmation — replaces the category list with a confirm
 * prompt, then restores via rebuild. This avoids opening a second modal
 * (which would close the category manager).
 * @param {import('../types.js').Category} c
 * @param {() => void} rebuild
 * @param {HTMLElement} content - the manager content node (modal or page body)
 */
function deleteCategory(c, rebuild, content) {
  const inUse = store.countTransactionsForCategory(c.id);
  const displayName = store.categoryName(c.id);
  const message =
    inUse > 0
      ? t.category.deleteMsgInUse(displayName, inUse)
      : t.category.deleteMsgSimple(displayName);

  // Show an inline confirm within the modal content.
  const confirmBlock = el('div', { class: 'inline-confirm card' }, [
    el('div', { style: 'font-weight:600;margin-bottom:8px' }, t.category.deleteTitle),
    el('div', { style: 'color:var(--text-muted);margin-bottom:14px' }, message),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn ghost', onClick: () => rebuild() }, t.app.cancel),
      el(
        'button',
        {
          class: 'btn danger',
          onClick: () => store.removeCategory(c.id).then(() => rebuild()),
        },
        t.app.delete
      ),
    ]),
  ]);

  // Replace content with the confirm; rebuild restores the normal view. Works
  // whether the manager is a modal or a routed page (content is the body node).
  const parent = content || document.querySelector('.modal .stack');
  if (parent) {
    parent.textContent = '';
    parent.appendChild(confirmBlock);
  } else {
    rebuild();
  }
}
