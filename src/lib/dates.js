// @ts-check
/** Date helpers working in the user's local timezone. All dates are stored
 *  as ISO 'YYYY-MM-DD' strings; months as 'YYYY-MM'. Labels use Indonesian
 *  formatting (Req 12.5). */
import { getLocale } from './i18n.js';

/** Indonesian Western time (WIB) is UTC+7, no DST. */
const WIB_OFFSET_MIN = 7 * 60;

/**
 * "Now" as a Date whose UTC fields represent the WIB wall clock. Using the
 * getUTC* accessors on the result yields WIB year/month/day/hours. This makes
 * "today" consistent regardless of the device's timezone (Req: timestamps WIB).
 * @param {Date} [base]
 * @returns {Date}
 */
export function nowWIB(base = new Date()) {
  return new Date(base.getTime() + WIB_OFFSET_MIN * 60 * 1000);
}

/**
 * Today's date as ISO 'YYYY-MM-DD' in WIB.
 * @returns {string}
 */
export function todayISO() {
  const d = nowWIB();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a Date as local 'YYYY-MM-DD' (used for arbitrary dates, e.g. the
 * "yesterday" helper). Uses the Date's local fields.
 * @param {Date} d
 * @returns {string}
 */
export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Current month key 'YYYY-MM' in WIB.
 * @returns {string}
 */
export function currentMonth() {
  return todayISO().slice(0, 7);
}

/**
 * Current day-of-month (1-based) in WIB.
 * @returns {number}
 */
export function todayDayOfMonth() {
  return nowWIB().getUTCDate();
}

/**
 * Number of days in the current WIB month.
 * @returns {number}
 */
export function daysInCurrentMonth() {
  const d = nowWIB();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Extract the month key 'YYYY-MM' from an ISO date string.
 * @param {string} isoDate
 * @returns {string}
 */
export function monthOf(isoDate) {
  return (isoDate || '').slice(0, 7);
}

/**
 * The month key before the given one, e.g. '2026-01' -> '2025-12'.
 * @param {string} monthKey 'YYYY-MM'
 * @returns {string}
 */
export function prevMonth(monthKey) {
  const [y, m] = (monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey || '';
  const d = new Date(y, m - 2, 1); // m-1 is this month; m-2 is previous
  const py = d.getFullYear();
  const pm = String(d.getMonth() + 1).padStart(2, '0');
  return `${py}-${pm}`;
}

/**
 * Human-friendly month label, e.g. '2026-09' -> 'September 2026'.
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
  const [y, m] = (monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey || '';
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
}

/**
 * Human-friendly date label in Indonesian, e.g. '2026-09-18' -> '18 Sep 2026'.
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateLabel(isoDate) {
  const [y, m, d] = (isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return isoDate || '';
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Indonesian date label including the day name, e.g. '2026-09-18' ->
 * 'Jumat, 18 Sep 2026'. Used in the transaction list ("hari").
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateWithDay(isoDate) {
  const [y, m, d] = (isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return isoDate || '';
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Just the Indonesian weekday name for a date, e.g. 'Jumat'.
 * @param {string} isoDate
 * @returns {string}
 */
export function dayName(isoDate) {
  const [y, m, d] = (isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(getLocale(), { weekday: 'long' });
}

/**
 * True if the ISO date is today (local time).
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isToday(isoDate) {
  return isoDate === todayISO();
}

/**
 * True if the ISO date is yesterday (local time).
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isYesterday(isoDate) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDate === toISODate(d);
}

/**
 * True if the string is a valid ISO 'YYYY-MM-DD' calendar date.
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isValidISODate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return false;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
