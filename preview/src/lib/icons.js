// @ts-check
/**
 * Monochrome line-style icons as inline SVG. One consistent set so the whole
 * app (nav, actions, cards) shares a single visual language — no emoji.
 * Icons inherit color via `stroke="currentColor"`.
 */

/** Raw SVG path/markup for each icon (24×24 viewBox, 1.8 stroke). */
const PATHS = {
  // Bottom nav
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 9h18"/><circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>',
  transactions: '<path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',

  // Actions / affordances
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>',
  dots: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/>',
  starFilled:
    '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5Z" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.4-2"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.5 0 10 7 10 7a16.8 16.8 0 0 1-3.3 4.1"/><path d="M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-0.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',

  // Lainnya hub section icons
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/>',
  diamond: '<path d="M6 3h12l3 6-9 12L3 9l3-6Z"/><path d="M3 9h18"/><path d="M9 3l3 6 3-6"/>',
  debt: '<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M4 20h16"/>',
  report: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5"/><path d="M9.5 15.5h5"/>',
  tag: '<path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/>',

  // Wallet types (used as small leading glyphs)
  bank: '<path d="M4 10h16"/><path d="M12 3 4 7h16l-8-4Z"/><path d="M6 10v7"/><path d="M10 10v7"/><path d="M14 10v7"/><path d="M18 10v7"/><path d="M4 20h16"/>',
  ewallet: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M10.5 18h3"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  credit:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18"/><path d="M6.5 14.5h4"/>',
};

/**
 * Build an inline SVG icon element.
 * @param {keyof typeof PATHS} name
 * @param {Object} [opts]
 * @param {number} [opts.size=24]
 * @param {string} [opts.className]
 * @returns {SVGSVGElement}
 */
export function icon(name, opts = {}) {
  const { size = 24, className } = opts;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = PATHS[name] || '';
  return svg;
}

/**
 * Icon name for a wallet type.
 * @param {import('../types.js').WalletType} type
 * @returns {keyof typeof PATHS}
 */
export function walletTypeIcon(type) {
  return type in PATHS ? /** @type {any} */ (type) : 'wallet';
}
