// @ts-check
/**
 * Add / edit transaction form (Req 1, 2.1, 2.2). Opened in a modal.
 * @typedef {import('../types.js').Transaction} Transaction
 */
import { el } from '../lib/dom.js';
import { openModal, closeModal } from './modal.js';
import * as store from '../state/store.js';
import { validateTransaction } from '../lib/validation.js';
import { parseAmount, groupDigits } from '../lib/format.js';
import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { openPhotoViewer } from './photoViewer.js';

/**
 * Open the transaction form. Pass a transaction to edit; omit to add.
 * @param {Transaction} [existing]
 */
export function openTransactionForm(existing) {
  const isEdit = !!existing;
  const state = store.getState();
  const categories = state.categories;
  const wallets = state.wallets;

  // Default wallet: the transaction's own (edit), else the primary (UTAMA)
  // wallet, else the first wallet.
  const primary = store.primaryWallet();
  const defaultWalletId =
    (existing && existing.walletId) ||
    (primary ? primary.id : '') ||
    (wallets[0] ? wallets[0].id : '');

  // Working copy of form values. Amount is stored as a grouped display string.
  const form = {
    amount: existing ? groupDigits(String(existing.amount)) : '',
    type: /** @type {'income'|'expense'} */ (existing ? existing.type : 'expense'),
    categoryId: existing ? existing.categoryId : '',
    date: existing ? existing.date : todayISO(),
    note: existing && existing.note ? existing.note : '',
    walletId: defaultWalletId,
    photo: existing && existing.photo ? existing.photo : '',
  };

  /** @type {Record<string,string>} */
  let errors = {};

  const content = el('form', { class: 'stack', novalidate: 'true' });

  function rebuild() {
    content.textContent = '';

    // Type segmented control
    const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': t.tx.type }, [
      typeButton('expense', t.tx.expense),
      typeButton('income', t.tx.income),
    ]);

    // Amount (whole Rupiah, live-grouped with dots)
    const amountInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      placeholder: t.tx.amountPlaceholder,
      value: form.amount,
      class: errors.amount ? 'invalid' : '',
      onInput: (e) => {
        e.target.value = groupDigits(e.target.value);
        form.amount = e.target.value;
      },
    });

    // Category select — only categories matching the selected type.
    const kindCategories = store.categoriesByKind(form.type);
    const catSelect = el(
      'select',
      {
        class: errors.categoryId ? 'invalid' : '',
        onChange: (e) => (form.categoryId = e.target.value),
      },
      [
        el('option', { value: '', disabled: true, selected: !form.categoryId }, t.tx.selectCategory),
        ...kindCategories.map((c) =>
          el('option', { value: c.id, selected: c.id === form.categoryId }, store.categoryName(c.id))
        ),
      ]
    );

    // Wallet select
    const walletSelect = el(
      'select',
      {
        class: errors.walletId ? 'invalid' : '',
        onChange: (e) => (form.walletId = e.target.value),
      },
      [
        wallets.length === 0
          ? el('option', { value: '', selected: true }, t.wallet.selectWallet)
          : null,
        ...wallets.map((w) =>
          el('option', { value: w.id, selected: w.id === form.walletId }, w.name)
        ),
      ]
    );

    // Date
    const dateInput = el('input', {
      type: 'date',
      value: form.date,
      class: errors.date ? 'invalid' : '',
      onInput: (e) => (form.date = e.target.value),
    });

    // Note
    const noteInput = el('textarea', {
      placeholder: t.tx.notePlaceholder,
      value: form.note,
      onInput: (e) => (form.note = e.target.value),
    });

    content.append(
      field(t.tx.type, seg, errors.type),
      field(t.tx.amount, amountInput, errors.amount),
      field(t.tx.category, catSelect, errors.categoryId),
      field(t.wallet.walletLabel, walletSelect, errors.walletId),
      field(t.tx.date, dateInput, errors.date),
      field(t.tx.note, noteInput),
      photoField(),
      el('div', { class: 'btn-row' }, [
        el('button', { type: 'button', class: 'btn ghost', onClick: () => closeModal() }, t.app.cancel),
        el('button', { type: 'submit', class: 'btn primary' }, isEdit ? t.app.save : t.app.add),
      ])
    );
  }

  function typeButton(type, label) {
    return el(
      'button',
      {
        type: 'button',
        dataset: { type },
        class: form.type === type ? 'active' : '',
        'aria-pressed': form.type === type ? 'true' : 'false',
        onClick: () => {
          if (form.type !== type) {
            form.type = type;
            // Clear category if it no longer matches the selected type.
            const cat = store.getState().categories.find((c) => c.id === form.categoryId);
            if (!cat || (cat.kind || 'expense') !== type) form.categoryId = '';
            rebuild();
          }
        },
      },
      label
    );
  }

  function field(labelText, control, error) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, labelText),
      control,
      el('span', { class: 'field-error', role: error ? 'alert' : undefined }, error || ''),
    ]);
  }

  /**
   * Optional receipt-photo field. Offers "Take Photo" (camera capture on
   * mobile) and "Choose File" (gallery). The chosen image is downscaled and
   * JPEG-compressed to a data URL so it fits comfortably in IndexedDB. When a
   * photo is set, a thumbnail preview + "Remove" button is shown; tapping the
   * thumbnail opens the full-screen viewer.
   */
  function photoField() {
    // Camera input: `capture` hints mobile browsers to open the camera.
    const cameraInput = el('input', {
      type: 'file',
      accept: 'image/*',
      capture: 'environment',
      hidden: true,
      onChange: (e) => onPick(e.target.files && e.target.files[0]),
    });
    // Gallery input: no capture attribute → file/photo picker.
    const galleryInput = el('input', {
      type: 'file',
      accept: 'image/*',
      hidden: true,
      onChange: (e) => onPick(e.target.files && e.target.files[0]),
    });

    const takeBtn = el(
      'button',
      { type: 'button', class: 'btn ghost photo-btn', onClick: () => cameraInput.click() },
      [icon('report', { size: 18 }), el('span', {}, t.tx.takePhoto)]
    );
    const chooseBtn = el(
      'button',
      { type: 'button', class: 'btn ghost photo-btn', onClick: () => galleryInput.click() },
      [icon('copy', { size: 18 }), el('span', {}, t.tx.choosePhoto)]
    );

    const preview = el('div', { class: 'photo-preview' });

    function renderPreview() {
      preview.textContent = '';
      if (!form.photo) {
        preview.hidden = true;
        return;
      }
      preview.hidden = false;
      const thumb = el('img', {
        class: 'photo-thumb',
        src: form.photo,
        alt: t.tx.photo,
        onClick: () => openPhotoViewer(form.photo),
      });
      const removeBtn = el(
        'button',
        {
          type: 'button',
          class: 'btn danger btn-sm',
          onClick: () => {
            form.photo = '';
            cameraInput.value = '';
            galleryInput.value = '';
            renderPreview();
          },
        },
        t.tx.removePhoto
      );
      preview.append(thumb, removeBtn);
    }

    async function onPick(file) {
      if (!file) return;
      try {
        form.photo = await compressImage(file);
      } catch {
        form.photo = '';
      }
      renderPreview();
    }

    renderPreview();

    return el('div', { class: 'field' }, [
      el('span', { class: 'field-label' }, t.tx.photo),
      el('div', { class: 'photo-actions' }, [takeBtn, chooseBtn]),
      cameraInput,
      galleryInput,
      preview,
    ]);
  }

  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    errors = validateTransaction(
      {
        amount: form.amount,
        type: form.type,
        categoryId: form.categoryId,
        date: form.date,
        note: form.note,
      },
      categories
    );
    if (Object.keys(errors).length > 0) {
      rebuild();
      return;
    }
    const payload = {
      amount: parseAmount(form.amount),
      type: form.type,
      categoryId: form.categoryId,
      date: form.date,
      note: form.note.trim() || undefined,
      walletId: form.walletId || undefined,
      photo: form.photo || undefined,
    };
    if (isEdit && existing) {
      await store.editTransaction(existing.id, payload);
    } else {
      await store.addTransaction(payload);
    }
    closeModal();
  });

  rebuild();
  openModal(isEdit ? t.tx.editTitle : t.tx.addTitle, content);
}

/**
 * Read an image file, downscale it so its longest edge is at most `maxDim`
 * pixels, and return a JPEG data URL at the given quality. Keeps stored
 * receipts small (typically tens of KB) so IndexedDB stays lean.
 * @param {File} file
 * @param {number} [maxDim=1280]
 * @param {number} [quality=0.72]
 * @returns {Promise<string>}
 */
function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(String(reader.result));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
