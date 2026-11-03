// @ts-check
/** Shared month <select> bound to the store's selectedMonth. */
import { el } from '../lib/dom.js';
import * as store from '../state/store.js';
import { formatMonthLabel } from '../lib/dates.js';

/**
 * Build a month selector element.
 * @returns {HTMLElement}
 */
export function monthSelect() {
  const months = store.selectAvailableMonths();
  const selected = store.getState().selectedMonth;
  return el(
    'select',
    {
      'aria-label': 'Select month',
      onChange: (e) => store.setSelectedMonth(e.target.value),
    },
    months.map((m) =>
      el('option', { value: m, selected: m === selected }, formatMonthLabel(m))
    )
  );
}
