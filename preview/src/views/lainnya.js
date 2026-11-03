// @ts-check
/**
 * Lainnya (More) — hub linking to secondary sections. Ready sections navigate
 * to their view; the rest show "Segera hadir" until built. Line icons only.
 */
import { el } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';

/**
 * Render the Lainnya hub.
 * @param {HTMLElement} container
 * @param {(view: string) => void} navigate - router callback for sections
 */
export function renderLainnya(container, navigate) {
  /** @type {{ id: string, icon: import('../lib/icons.js').icon, label: string, ready?: boolean, onClick?: () => void }[]} */
  const items = [
    { id: 'budget', icon: 'target', label: t.lainnya.budget, ready: true, onClick: () => navigate('budget') },
    { id: 'aset', icon: 'diamond', label: t.lainnya.aset, ready: true, onClick: () => navigate('aset') },
    { id: 'utang', icon: 'debt', label: t.lainnya.utang, ready: true, onClick: () => navigate('utang') },
    { id: 'investasi', icon: 'chart', label: t.lainnya.investasi, ready: true, onClick: () => navigate('investasi') },
    { id: 'laporan', icon: 'report', label: t.lainnya.laporan, ready: true, onClick: () => navigate('laporan') },
    { id: 'kategori', icon: 'tag', label: t.lainnya.kategori, ready: true, onClick: () => navigate('kategori') },
    { id: 'pengaturan', icon: 'settings', label: t.lainnya.pengaturan, ready: true, onClick: () => navigate('pengaturan') },
  ];

  const list = el(
    'ul',
    { class: 'menu-list' },
    items.map((item) =>
      el(
        'li',
        {},
        el(
          'button',
          {
            class: 'menu-row' + (item.ready ? '' : ' disabled'),
            disabled: item.ready ? undefined : true,
            onClick: item.ready ? item.onClick : undefined,
          },
          [
            el('span', { class: 'menu-icon', 'aria-hidden': 'true' }, icon(/** @type {any} */ (item.icon), { size: 20 })),
            el('span', { class: 'menu-label' }, item.label),
            item.ready
              ? el('span', { class: 'menu-chevron', 'aria-hidden': 'true' }, icon('chevronRight', { size: 18 }))
              : el('span', { class: 'badge' }, t.lainnya.soon),
          ]
        )
      )
    )
  );

  container.append(el('div', { class: 'section-title' }, t.lainnya.subtitle), list);
}
