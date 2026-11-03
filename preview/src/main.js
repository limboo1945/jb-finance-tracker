// @ts-check
/**
 * App entry point: initializes the store, renders the shell (header, active
 * view, 5-tab bottom nav with elevated center "+" button, error toast), and
 * registers the service worker.
 */
import { el, render } from './lib/dom.js';
import * as store from './state/store.js';
import { t, setLanguage, currentLang } from './lib/i18n.js';
import { icon } from './lib/icons.js';
import { renderBeranda } from './views/beranda.js';
import { renderWallets } from './views/wallets.js';
import { renderTransactions } from './views/transactions.js';
import { renderLainnya } from './views/lainnya.js';
import { renderBudget } from './views/budget.js';
import { renderAssets } from './views/assets.js';
import { renderDebts } from './views/debts.js';
import { renderInvestments } from './views/investments.js';
import { renderLaporan } from './views/laporan.js';
import { renderCategoryManager } from './views/categoryManager.js';
import { renderSettings } from './views/settings.js';
import { openTransactionForm } from './views/transactionForm.js';

/**
 * Active view. Primary tabs: beranda | dompet | transaksi | lainnya.
 * Secondary sections (budget, aset, utang, investasi, laporan) are reached
 * from Lainnya and will be added in later phases.
 * @type {string}
 */
let activeView = 'beranda';

/** Views reachable from Lainnya that render with a back affordance. */
const SECONDARY = new Set(['budget', 'aset', 'utang', 'investasi', 'laporan', 'kategori', 'pengaturan']);

const root = /** @type {HTMLElement} */ (document.getElementById('app'));

// ---- Theme (light / dark) -------------------------------------------------

const THEME_LS_KEY = 'appTheme';

/** Read the persisted theme, defaulting to dark. @returns {'dark'|'light'} */
function initialTheme() {
  try {
    const v = localStorage.getItem(THEME_LS_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** @type {'dark'|'light'} */
let currentTheme = initialTheme();

/** Apply the theme to <html> (data-theme) and sync the browser theme-color. */
function applyTheme() {
  const html = document.documentElement;
  if (currentTheme === 'light') html.setAttribute('data-theme', 'light');
  else html.removeAttribute('data-theme');
  // Keep the iOS status-bar / browser chrome color in step with the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', currentTheme === 'light' ? '#f4f5f7' : '#000000');
}

/** Toggle between light and dark, persist, and re-render. */
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_LS_KEY, currentTheme);
  } catch {
    /* ignore */
  }
  applyTheme();
  renderApp();
}

/** Toggle UI language (id <-> en), persist (handled in i18n), and re-render. */
function toggleLanguage() {
  setLanguage(currentLang === 'id' ? 'en' : 'id');
  renderApp();
}

// ---- Per-view scroll memory ----------------------------------------------
// The whole window scrolls (there's no per-view scroll container), so without
// this every view would share one scroll position. We remember each view's
// scrollY and restore it when returning, so e.g. Home and Transaksi keep
// their own independent scroll positions.
/** @type {Record<string, number>} */
const scrollPositions = {};

/** Save the current window scroll under the currently active view. */
function saveScroll() {
  scrollPositions[activeView] = window.scrollY || window.pageYOffset || 0;
}

/**
 * Restore the saved scroll for the active view (0 if none). Called
 * SYNCHRONOUSLY right after the new content is rendered, before the browser
 * paints — so the page appears already at the correct scroll position with no
 * visible jump/snap. (The content is swapped synchronously, so its full height
 * exists by the time we scroll.)
 * @param {number} [forced] - if given, scroll to exactly this position
 */
function restoreScroll(forced) {
  const y = forced != null ? forced : scrollPositions[activeView] || 0;
  window.scrollTo(0, y);
}

/**
 * The last Lainnya sub-feature the user opened (e.g. 'investasi'). Used so
 * that tapping the More tab FROM ANOTHER TAB returns to that feature.
 * @type {string|null}
 */
let lastLainnyaView = null;

/**
 * Switch views. Saves the outgoing view's scroll and restores the incoming
 * view's scroll. Pass `{ toTop: true }` to force the new view to the top.
 * @param {string} view
 * @param {{ toTop?: boolean }} [opts]
 */
function setView(view, opts = {}) {
  saveScroll();
  // Remember the last Lainnya sub-feature we entered (for the More-tab return).
  if (SECONDARY.has(view)) lastLainnyaView = view;
  if (opts.toTop) scrollPositions[view] = 0;
  activeView = view;
  renderApp();
  restoreScroll();
}

/**
 * Bottom-nav tap on a primary tab.
 * - If already on that tab: scroll to the TOP.
 * - If switching from another tab: restore this tab's last scroll position.
 * @param {string} view
 */
function tapPrimaryTab(view) {
  if (activeView === view) {
    // Re-tapping the current tab: smooth-scroll to the top.
    scrollPositions[view] = 0;
    scrollToTopSmooth();
    return;
  }
  // Switching tabs: restore where we left this tab (setView restores scroll).
  setView(view);
}

/**
 * Handle a tap on the "Lainnya" (More) bottom-nav tab.
 * - If currently INSIDE the Lainnya section (the hub or a sub-feature):
 *     - on the hub already → scroll to top;
 *     - inside a feature → go back to the hub.
 * - If currently on ANOTHER tab (Home/Dompet/Transaksi): return to the last
 *   feature you were in (if any), otherwise the hub.
 */
function openLainnyaTab() {
  const inLainnyaSection = activeView === 'lainnya' || SECONDARY.has(activeView);

  if (inLainnyaSection) {
    if (activeView === 'lainnya') {
      // Already on the hub: scroll to top.
      scrollPositions['lainnya'] = 0;
      scrollToTopSmooth();
    } else {
      // Inside a feature: go back to the hub.
      setView('lainnya');
    }
    return;
  }

  // Coming from another tab: resume the last feature, else the hub.
  if (lastLainnyaView && SECONDARY.has(lastLainnyaView)) {
    setView(lastLainnyaView);
  } else {
    setView('lainnya');
  }
}

/** Smoothly scroll to the top (used when re-tapping the current tab). */
function scrollToTopSmooth() {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    window.scrollTo(0, 0);
  }
}

/**
 * Go back from a secondary view to the Lainnya hub (via the header back button
 * or the edge-swipe). This is an explicit "leave the feature" action, so we
 * clear the remembered feature — a later More-tap from another tab then shows
 * the hub (your most recent Lainnya position), not the feature you left.
 */
function backToLainnya() {
  lastLainnyaView = null;
  setView('lainnya');
}

/** Map a view id to its header title. */
function headerTitle(view) {
  return t.header[view] || t.app.name;
}

// ---- Persistent app shell -------------------------------------------------
// The header, <main>, and bottom nav are created ONCE and then updated in
// place. Only the contents of <main> are swapped when the view changes. This
// avoids destroying/recreating the sticky header + nav on every tab switch,
// which caused a visible flicker/jump.
/** @type {{ header: HTMLElement, h1: HTMLElement, headerLeft: HTMLElement, headerRight: HTMLElement, themeBtn: HTMLElement, langBtn: HTMLElement, backBtn: HTMLElement, main: HTMLElement, navButtons: Record<string, HTMLElement>, toastSlot: HTMLElement, noticeSlot: HTMLElement } | null} */
let shell = null;

/** The view that was last rendered into <main>, to detect real view changes. */
let lastRenderedView = null;

/** Build the one-time shell DOM and mount it into #app. */
function buildShell() {
  const h1 = el('h1', {}, headerTitle(activeView));

  // Persistent header controls — created ONCE and only shown/hidden & updated
  // in place, so switching tabs never recreates them (no flicker).
  const themeBtn = el(
    'button',
    { class: 'header-toggle theme-toggle', type: 'button', onClick: () => toggleTheme() },
    el('span', { class: 'theme-icon' }, icon(currentTheme === 'dark' ? 'sun' : 'moon', { size: 20 }))
  );
  const langBtn = el(
    'button',
    { class: 'header-toggle lang-toggle', type: 'button', onClick: () => toggleLanguage() },
    el('span', { class: 'lang-code' }, currentLang === 'id' ? 'ID' : 'EN')
  );
  const backBtn = el(
    'button',
    { class: 'back-btn', onClick: () => backToLainnya(), 'aria-label': t.app.back },
    [icon('chevronLeft', { size: 20 }), el('span', { class: 'back-label' }, t.app.back)]
  );

  const headerLeft = el('div', { class: 'header-left' }, [themeBtn, backBtn]);
  const headerRight = el('div', { class: 'header-right' }, [langBtn]);
  const header = el('header', { class: 'app-header' }, [headerLeft, h1, headerRight]);

  const main = el('main', { class: 'main', id: 'view-root' });

  /** @type {Record<string, HTMLElement>} */
  const navButtons = {};
  navButtons.beranda = navButton('beranda', 'home', t.nav.beranda, { onClick: () => tapPrimaryTab('beranda') });
  navButtons.dompet = navButton('dompet', 'wallet', t.nav.dompet, { onClick: () => tapPrimaryTab('dompet') });
  const fab = fabButton();
  navButtons.transaksi = navButton('transaksi', 'transactions', t.nav.transaksi, { onClick: () => tapPrimaryTab('transaksi') });
  navButtons.lainnya = navButton('lainnya', 'more', t.nav.lainnya, { onClick: openLainnyaTab });
  const nav = el('nav', { class: 'bottom-nav', 'aria-label': t.nav.beranda }, [
    navButtons.beranda,
    navButtons.dompet,
    fab,
    navButtons.transaksi,
    navButtons.lainnya,
  ]);

  // Slots for transient toast/notice so they can appear/disappear without
  // touching the rest of the shell.
  const toastSlot = el('div', { class: 'slot-toast' });
  const noticeSlot = el('div', { class: 'slot-notice' });

  shell = {
    header, h1, headerLeft, headerRight, themeBtn, langBtn, backBtn,
    main, navButtons, toastSlot, noticeSlot,
  };
  render(root, [header, main, nav, toastSlot, noticeSlot]);
}

/**
 * Update the header for the current view by showing/hiding and re-labeling the
 * PERSISTENT controls — never recreating them. This is what keeps tab switches
 * flicker-free (switching between two primary tabs changes only the title).
 */
function updateHeader() {
  if (!shell) return;
  const isSecondary = SECONDARY.has(activeView);

  // Title + back-mode class.
  if (shell.h1.textContent !== headerTitle(activeView)) {
    shell.h1.textContent = headerTitle(activeView);
  }
  shell.header.classList.toggle('with-back', isSecondary);

  // Theme + language toggles: shown on primary tabs, hidden inside features.
  shell.themeBtn.hidden = isSecondary;
  shell.langBtn.hidden = isSecondary;
  // Back button: only inside a feature.
  shell.backBtn.hidden = !isSecondary;

  // Keep the theme button's icon + labels in sync (only touch the DOM when the
  // theme actually changed, so a plain tab switch doesn't repaint the icon).
  const wantSun = currentTheme === 'dark';
  if (shell.themeBtn.dataset.state !== (wantSun ? 'sun' : 'moon')) {
    shell.themeBtn.dataset.state = wantSun ? 'sun' : 'moon';
    const iconWrap = shell.themeBtn.querySelector('.theme-icon');
    if (iconWrap) {
      iconWrap.textContent = '';
      iconWrap.appendChild(icon(wantSun ? 'sun' : 'moon', { size: 20 }));
    }
    shell.themeBtn.setAttribute(
      'aria-label',
      wantSun ? t.settings.toggleThemeToLight : t.settings.toggleThemeToDark
    );
    shell.themeBtn.title = wantSun ? t.settings.themeLight : t.settings.themeDark;
  }

  // Keep the language label in sync (only when it changed).
  const langText = currentLang === 'id' ? 'ID' : 'EN';
  const langCode = shell.langBtn.querySelector('.lang-code');
  if (langCode && langCode.textContent !== langText) langCode.textContent = langText;
  shell.langBtn.setAttribute('aria-label', t.settings.toggleLanguage);
  shell.langBtn.title = t.settings.language;

  // Keep the back label localized.
  const backLabel = shell.backBtn.querySelector('.back-label');
  if (backLabel && backLabel.textContent !== t.app.back) backLabel.textContent = t.app.back;
  shell.backBtn.setAttribute('aria-label', t.app.back);
}

/** Update which bottom-nav tab is highlighted. */
function updateNavActive() {
  if (!shell) return;
  const isSecondary = SECONDARY.has(activeView);
  for (const [view, btn] of Object.entries(shell.navButtons)) {
    const active = view === 'lainnya' ? activeView === 'lainnya' || isSecondary : activeView === view;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
}

/** Reflect the transient error toast / notice from the store. */
function updateTransient() {
  if (!shell) return;
  const state = store.getState();

  shell.toastSlot.textContent = '';
  if (state.error) {
    shell.toastSlot.appendChild(
      el('div', { class: 'toast', role: 'alert' }, [
        el('span', {}, state.error),
        el('button', { onClick: () => store.clearError(), 'aria-label': t.app.dismiss }, '✕'),
      ])
    );
  }

  shell.noticeSlot.textContent = '';
  if (state.notice) {
    shell.noticeSlot.appendChild(el('div', { class: 'notice', role: 'status' }, state.notice));
  }
}

function renderApp() {
  const state = store.getState();

  if (!state.loaded) {
    // Pre-load: show a simple loading screen (no shell yet).
    shell = null;
    render(root, el('div', { class: 'loading' }, t.app.loading));
    return;
  }

  // Build the persistent shell once; afterwards only update pieces in place.
  if (!shell || !root.contains(shell.header)) buildShell();

  updateHeader();
  updateNavActive();

  // Swap only the <main> content for the active view.
  const viewChanged = lastRenderedView !== activeView;
  shell.main.textContent = '';
  renderActiveView(shell.main);
  // Subtle fade ONLY when the view actually changed (not on in-place data
  // re-renders), so tab switches read as smooth without flashing on edits.
  if (viewChanged) {
    shell.main.classList.remove('view-enter');
    void shell.main.offsetWidth; // force reflow so the animation can replay
    shell.main.classList.add('view-enter');
  }
  lastRenderedView = activeView;

  updateTransient();
}

/** Render whichever view is active into the main container. */
function renderActiveView(main) {
  switch (activeView) {
    case 'beranda':
      renderBeranda(main, setView);
      break;
    case 'dompet':
      renderWallets(main);
      break;
    case 'transaksi':
      renderTransactions(main);
      break;
    case 'lainnya':
      renderLainnya(main, setView);
      break;
    case 'budget':
      renderBudget(main);
      break;
    case 'aset':
      renderAssets(main);
      break;
    case 'utang':
      renderDebts(main);
      break;
    case 'investasi':
      renderInvestments(main);
      break;
    case 'laporan':
      renderLaporan(main);
      break;
    case 'kategori':
      renderCategoryManager(main);
      break;
    case 'pengaturan':
      renderSettings(main);
      break;
    default:
      // Secondary sections not yet implemented in this phase.
      renderComingSoon(main);
  }
}

function renderComingSoon(main) {
  main.append(el('div', { class: 'empty' }, el('div', {}, t.lainnya.soon)));
}

/**
 * A bottom-nav tab button.
 * @param {string} view @param {import('./lib/icons.js').icon extends (n: infer N, ...a: any) => any ? N : string} iconName @param {string} label
 */
function navButton(view, iconName, label, opts = {}) {
  const active = opts.active != null ? opts.active : activeView === view;
  const onClick = opts.onClick || (() => setView(view));
  return el(
    'button',
    {
      class: 'nav-btn' + (active ? ' active' : ''),
      onClick,
      'aria-current': active ? 'page' : undefined,
    },
    [
      el('span', { class: 'icon', 'aria-hidden': 'true' }, icon(iconName, { size: 24 })),
      el('span', {}, label),
    ]
  );
}

/** The elevated central "+" action button (Req 13.1, 13.3). */
function fabButton() {
  return el(
    'button',
    {
      class: 'nav-fab',
      onClick: () => openTransactionForm(),
      'aria-label': t.nav.tambah,
    },
    icon('plus', { size: 28 })
  );
}

/**
 * Edge-swipe-to-go-back gesture (like native/Gojek): on a secondary (Lainnya
 * sub-feature) view, a swipe starting from the left screen edge and dragging
 * right returns to the Lainnya hub. The page follows the finger and either
 * completes (past threshold) or snaps back on release.
 */
function setupEdgeSwipeBack() {
  const EDGE = 28; // px from the left edge where a back-swipe may start
  const COMPLETE_RATIO = 0.35; // fraction of screen width to trigger back
  const COMPLETE_VELOCITY = 0.5; // px/ms flick that also triggers back

  let tracking = false;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let dx = 0;
  let decidedHoriz = false; // locked into horizontal drag
  let cancelled = false;

  /** The nodes we translate during the drag. */
  function panels() {
    return /** @type {HTMLElement[]} */ (
      [root.querySelector('.app-header'), root.querySelector('.main')].filter(Boolean)
    );
  }

  function setOffset(x, animate) {
    for (const p of panels()) {
      p.style.transition = animate ? 'transform 0.2s ease' : '';
      p.style.transform = x ? `translateX(${x}px)` : '';
    }
  }

  function reset() {
    tracking = false;
    decidedHoriz = false;
    cancelled = false;
    dx = 0;
  }

  document.addEventListener(
    'touchstart',
    (e) => {
      // Only on secondary views, single touch starting at the left edge, and
      // not while a modal is open.
      if (!SECONDARY.has(activeView)) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.touches.length !== 1) return;
      const tch = e.touches[0];
      if (tch.clientX > EDGE) return;
      tracking = true;
      cancelled = false;
      decidedHoriz = false;
      startX = tch.clientX;
      startY = tch.clientY;
      startT = Date.now();
      dx = 0;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!tracking || cancelled) return;
      const tch = e.touches[0];
      dx = tch.clientX - startX;
      const dy = tch.clientY - startY;
      if (!decidedHoriz) {
        // Decide gesture intent: horizontal → drag; vertical → let it scroll.
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          cancelled = true;
          return;
        }
        decidedHoriz = true;
      }
      if (dx < 0) dx = 0; // only drag rightward
      // Resist a little so it feels anchored.
      setOffset(dx, false);
      if (e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('touchend', () => {
    if (!tracking) return;
    const dt = Math.max(1, Date.now() - startT);
    const velocity = dx / dt;
    const width = window.innerWidth || 360;
    const shouldComplete = dx > width * COMPLETE_RATIO || velocity > COMPLETE_VELOCITY;
    if (decidedHoriz && !cancelled && shouldComplete) {
      // Slide the rest of the way out, then navigate back to the hub.
      setOffset(width, true);
      setTimeout(() => {
        setOffset(0, false);
        backToLainnya();
      }, 180);
    } else {
      // Snap back into place.
      setOffset(0, true);
      setTimeout(() => setOffset(0, false), 220);
    }
    reset();
  });

  document.addEventListener('touchcancel', () => {
    if (!tracking) return;
    setOffset(0, true);
    reset();
  });
}

// The Settings view persists the theme itself, then fires this event so the
// shell re-reads the stored theme, re-applies it, and re-renders (keeping the
// header theme toggle and the live preview in Settings in sync).
document.addEventListener('app:settings-changed', () => {
  const stored = initialTheme();
  currentTheme = stored;
  applyTheme();
  const y = window.scrollY || window.pageYOffset || 0;
  renderApp();
  requestAnimationFrame(() => window.scrollTo(0, y));
});

// Re-render whenever the store changes. Preserve the current scroll position
// across these re-renders (they rebuild the DOM) so adding/editing data or
// toggling things doesn't jump the page to the top.
store.subscribe(() => {
  const y = window.scrollY || window.pageYOffset || 0;
  renderApp();
  requestAnimationFrame(() => window.scrollTo(0, y));
});

// Boot.
applyTheme(); // apply persisted theme before first paint
store.init();
renderApp();
setupEdgeSwipeBack();

// Register the service worker (non-blocking, graceful failure) (Req 10.4, 10.5).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
