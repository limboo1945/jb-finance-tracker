// @ts-check
/**
 * Pengaturan (Settings) — a secondary section reached from Lainnya.
 * Lets the user choose:
 *   • Appearance: light / dark theme
 *   • Currency: the display currency used across the whole app (default IDR)
 *
 * Theme is persisted under the same `appTheme` key main.js uses; changing it
 * here dispatches an `app:settings-changed` event so the shell re-applies the
 * theme and re-renders (keeping the header toggle in sync).
 */
import { el } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { icon } from '../lib/icons.js';
import { CURRENCIES, currentCurrency, setCurrency } from '../lib/format.js';
import * as store from '../state/store.js';

const THEME_LS_KEY = 'appTheme';

/** Current theme from <html> / storage. @returns {'dark'|'light'} */
function readTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light') return 'light';
  try {
    const v = localStorage.getItem(THEME_LS_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Persist the theme and tell the shell to re-apply + re-render. @param {'dark'|'light'} theme */
function writeTheme(theme) {
  try {
    localStorage.setItem(THEME_LS_KEY, theme);
  } catch {
    /* ignore */
  }
  document.dispatchEvent(new CustomEvent('app:settings-changed'));
}

/**
 * Render the Settings view.
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  container.append(
    el('div', { class: 'section-title' }, t.settings.title),
    appearanceCard(),
    currencyCard()
  );
}

/** Appearance (theme) card with a Light / Dark segmented control. */
function appearanceCard() {
  const theme = readTheme();

  function segBtn(value, label, iconName) {
    return el(
      'button',
      {
        type: 'button',
        class: theme === value ? 'active' : '',
        'aria-pressed': theme === value ? 'true' : 'false',
        onClick: () => {
          if (readTheme() !== value) writeTheme(/** @type {'dark'|'light'} */ (value));
        },
      },
      [icon(iconName, { size: 18 }), el('span', {}, label)]
    );
  }

  const seg = el('div', { class: 'segmented settings-seg', role: 'group', 'aria-label': t.settings.theme }, [
    segBtn('light', t.settings.themeLight, 'sun'),
    segBtn('dark', t.settings.themeDark, 'moon'),
  ]);

  return settingRow(t.settings.appearance, t.settings.appearanceDesc, 'sun', seg);
}

/** Currency card with a <select> of supported currencies (default IDR). */
function currencyCard() {
  const active = currentCurrency();

  const select = el(
    'select',
    {
      'aria-label': t.settings.currency,
      onChange: (e) => {
        setCurrency(e.target.value);
        // A full re-render refreshes every money label across the app.
        store.showNotice(t.app.saved);
      },
    },
    Object.values(CURRENCIES).map((c) =>
      el('option', { value: c.code, selected: c.code === active }, c.code + ' — ' + c.label)
    )
  );

  return settingRow(t.settings.currency, t.settings.currencyDesc, 'wallet', select);
}

/**
 * One settings card: icon + title + description, with a control below.
 * @param {string} title @param {string} desc
 * @param {import('../lib/icons.js').icon} iconName @param {HTMLElement} control
 */
function settingRow(title, desc, iconName, control) {
  return el('div', { class: 'card settings-card' }, [
    el('div', { class: 'settings-head' }, [
      el('span', { class: 'settings-icon', 'aria-hidden': 'true' }, icon(/** @type {any} */ (iconName), { size: 20 })),
      el('div', { class: 'settings-text' }, [
        el('div', { class: 'settings-title' }, title),
        el('div', { class: 'settings-desc' }, desc),
      ]),
    ]),
    el('div', { class: 'settings-control' }, control),
  ]);
}
