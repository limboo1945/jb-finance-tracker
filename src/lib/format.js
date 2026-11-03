// @ts-check
/**
 * Currency formatting (Req 12). The display currency is user-selectable in
 * Settings (default: Indonesian Rupiah). Internal math always uses whole
 * integer units — we never store fractional minor units — so every supported
 * currency is formatted with 0 decimal places and its own grouping/symbol.
 */

/** Supported display currencies. `locale` drives grouping + symbol placement. */
export const CURRENCIES = {
  IDR: { code: 'IDR', locale: 'id-ID', label: 'Rupiah (Rp)' },
  USD: { code: 'USD', locale: 'en-US', label: 'US Dollar ($)' },
  EUR: { code: 'EUR', locale: 'de-DE', label: 'Euro (€)' },
  SGD: { code: 'SGD', locale: 'en-SG', label: 'Singapore Dollar (S$)' },
  JPY: { code: 'JPY', locale: 'ja-JP', label: 'Japanese Yen (¥)' },
  GBP: { code: 'GBP', locale: 'en-GB', label: 'British Pound (£)' },
  AUD: { code: 'AUD', locale: 'en-AU', label: 'Australian Dollar (A$)' },
  MYR: { code: 'MYR', locale: 'ms-MY', label: 'Malaysian Ringgit (RM)' },
};

const CURRENCY_LS_KEY = 'appCurrency';
const DEFAULT_CURRENCY = 'IDR';

/** @type {string} */
let activeCurrency = readStoredCurrency();
/** @type {Intl.NumberFormat} */
let fmt = buildFormatter(activeCurrency);

/** Read the persisted currency code, defaulting to IDR. @returns {string} */
function readStoredCurrency() {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(CURRENCY_LS_KEY);
      if (v && CURRENCIES[v]) return v;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CURRENCY;
}

/** @param {string} code */
function buildFormatter(code) {
  const c = CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** The active currency code (e.g. 'IDR'). @returns {string} */
export function currentCurrency() {
  return activeCurrency;
}

/**
 * Change the active display currency, persist it, and rebuild the formatter.
 * No-op for an unknown code.
 * @param {string} code
 */
export function setCurrency(code) {
  if (!CURRENCIES[code]) return;
  activeCurrency = code;
  fmt = buildFormatter(code);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CURRENCY_LS_KEY, code);
  } catch {
    /* ignore */
  }
}

/**
 * Format a number as the active currency, e.g. 1250000 -> "Rp1.250.000".
 * Negative values keep their sign, e.g. -500000 -> "-Rp500.000".
 * @param {number} n
 * @returns {string}
 */
export function money(n) {
  return fmt.format(Number.isFinite(n) ? Math.round(n) : 0);
}

/**
 * Format an absolute value with an explicit +/- sign based on the
 * transaction type. Expenses are shown negative, income positive.
 * @param {number} amount
 * @param {'income'|'expense'} type
 * @returns {string}
 */
export function signedMoney(amount, type) {
  const sign = type === 'expense' ? '-' : '+';
  return sign + money(Math.abs(amount));
}

/**
 * Format a signed value directly (used for balances/gains that may be
 * negative), e.g. -500000 -> "-Rp500.000", 300000 -> "Rp300.000".
 * @param {number} n
 * @returns {string}
 */
export function moneySigned(n) {
  return money(n);
}

/**
 * Parse user input into a whole integer. Accepts plain digits and
 * strips grouping characters (`.`, `,`, spaces). Returns NaN if not numeric.
 * @param {string|number} input
 * @returns {number}
 */
export function parseAmount(input) {
  if (typeof input === 'number') return Math.round(input);
  const cleaned = String(input).replace(/[.\s,]/g, '');
  if (cleaned === '' || !/^-?\d+$/.test(cleaned)) return NaN;
  return parseInt(cleaned, 10);
}

/**
 * Compact amount for tight spaces (e.g. calendar cells), e.g.
 * 675000 -> "675rb", 1250000 -> "1,2jt", 500 -> "500". Keeps a leading sign.
 * @param {number} n
 * @returns {string}
 */
export function moneyShort(n) {
  if (!Number.isFinite(n) || n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let out;
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    out = (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',') + 'jt';
  } else if (abs >= 1_000) {
    const v = abs / 1_000;
    out = (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',') + 'rb';
  } else {
    out = String(Math.round(abs));
  }
  return sign + out;
}

/**
 * Group a raw amount string with `.` thousands separators for display in an
 * input field, e.g. "500000" -> "500.000". Non-digits are stripped; an empty
 * or all-zero-stripped string returns ''. A leading '-' is preserved.
 * @param {string} raw
 * @returns {string}
 */
export function groupDigits(raw) {
  let s = String(raw == null ? '' : raw);
  const neg = s.trim().startsWith('-');
  const digits = s.replace(/\D/g, '');
  if (digits === '') return '';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + grouped;
}

/**
 * Wire a text input so it live-formats with `.` thousands separators while
 * keeping the caret reasonable. The input should be type="text"
 * inputmode="numeric". Returns nothing; attaches an input listener.
 * @param {HTMLInputElement} input
 */
export function attachAmountFormatting(input) {
  input.addEventListener('input', () => {
    input.value = groupDigits(input.value);
  });
}
