// @ts-check
/**
 * Full-screen receipt photo viewer. A lightweight, self-contained overlay
 * (independent of the modal system so it can sit above an open form) that
 * shows a single image. Dismissed by tapping the backdrop, the close button,
 * or pressing Escape.
 */
import { el } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/** @type {HTMLElement|null} */
let current = null;

/**
 * Open the viewer for a given image source (data URL or URL).
 * @param {string} src
 */
export function openPhotoViewer(src) {
  if (!src) return;
  closePhotoViewer();

  const img = el('img', { class: 'photo-viewer-img', src, alt: t.tx.viewPhoto });

  const closeBtn = el(
    'button',
    {
      type: 'button',
      class: 'photo-viewer-close',
      'aria-label': t.tx.closePhoto,
      onClick: () => closePhotoViewer(),
    },
    '✕'
  );

  const overlay = el(
    'div',
    {
      class: 'photo-viewer',
      role: 'dialog',
      'aria-modal': 'true',
      onClick: (e) => {
        if (e.target === overlay) closePhotoViewer();
      },
    },
    [closeBtn, img]
  );

  const onKey = (e) => {
    if (e.key === 'Escape') closePhotoViewer();
  };
  document.addEventListener('keydown', onKey);
  // @ts-ignore stash cleanup
  overlay.__cleanup = () => document.removeEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  current = overlay;
}

/** Close the viewer if open. */
export function closePhotoViewer() {
  if (current) {
    // @ts-ignore
    if (typeof current.__cleanup === 'function') current.__cleanup();
    current.remove();
    current = null;
  }
}
