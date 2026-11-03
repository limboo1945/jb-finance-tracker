// @ts-check
/**
 * Validation and normalization helpers.
 * @typedef {import('../types.js').Category} Category
 */
import { isValidISODate } from './dates.js';
import { parseAmount } from './format.js';
import { t } from './i18n.js';

/**
 * @typedef {Object} TxInput
 * @property {string|number} amount
 * @property {string} type
 * @property {string} categoryId
 * @property {string} date
 * @property {string} [note]
 */

/**
 * Validate a transaction form input. Returns a map of field -> message.
 * An empty object means the input is valid (Req 1.2, 1.3, 2.2).
 * @param {TxInput} input
 * @param {Category[]} categories - available categories for existence check
 * @returns {Record<string, string>}
 */
export function validateTransaction(input, categories) {
  /** @type {Record<string, string>} */
  const errors = {};

  const amountNum =
    typeof input.amount === 'number' ? input.amount : parseAmount(input.amount);
  if (
    input.amount === '' ||
    input.amount === null ||
    input.amount === undefined ||
    Number.isNaN(amountNum)
  ) {
    errors.amount = t.validation.amountRequired;
  } else if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = t.validation.amountPositive;
  }

  if (input.type !== 'income' && input.type !== 'expense') {
    errors.type = t.validation.typeRequired;
  }

  if (!input.categoryId) {
    errors.categoryId = t.validation.categoryRequired;
  } else if (
    Array.isArray(categories) &&
    categories.length > 0 &&
    !categories.some((c) => c.id === input.categoryId)
  ) {
    errors.categoryId = t.validation.categoryInvalid;
  }

  if (!input.date || !isValidISODate(input.date)) {
    errors.date = t.validation.dateInvalid;
  }

  return errors;
}

/**
 * Normalize a category name for comparison/dedup (case-insensitive, trimmed).
 * @param {string} name
 * @returns {string}
 */
export function normalizeCategoryName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * True if a category name already exists (case-insensitive) (Req 5.3).
 * @param {string} name
 * @param {Category[]} categories
 * @returns {boolean}
 */
export function categoryNameExists(name, categories) {
  const norm = normalizeCategoryName(name);
  return (categories || []).some((c) => normalizeCategoryName(c.name) === norm);
}

/**
 * Generate a unique id. Uses crypto.randomUUID when available.
 * @returns {string}
 */
export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
