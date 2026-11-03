// @ts-check
/**
 * Central app store (vanilla, no framework). Holds in-memory state, loads from
 * and writes through to the IndexedDB repository, and exposes selectors.
 * Components subscribe to change notifications.
 *
 * @typedef {import('../types.js').Transaction} Transaction
 * @typedef {import('../types.js').Category} Category
 * @typedef {import('../types.js').MonthlySummary} MonthlySummary
 * @typedef {import('../types.js').CategorySpend} CategorySpend
 */
import * as db from '../data/db.js';
import { currentMonth, monthOf, isToday, isYesterday, formatDateLabel, todayISO, prevMonth, daysInCurrentMonth } from '../lib/dates.js';
import { makeId } from '../lib/validation.js';
import { t } from '../lib/i18n.js';

/**
 * @typedef {Object} TxFilters
 * @property {string} from       - ISO date lower bound (inclusive) or ''
 * @property {string} to         - ISO date upper bound (inclusive) or ''
 * @property {string} walletId   - wallet id or '' for all
 * @property {string} categoryId - category id or '' for all
 * @property {string} type       - 'income' | 'expense' | '' for all
 * @property {string} search     - note/description search (case-insensitive)
 */

/**
 * @typedef {Object} State
 * @property {Transaction[]} transactions
 * @property {Category[]} categories
 * @property {import('../types.js').Wallet[]} wallets
 * @property {import('../types.js').Asset[]} assets
 * @property {import('../types.js').Debt[]} debts
 * @property {import('../types.js').Investment[]} investments
 * @property {import('../types.js').BudgetSettings} budget
 * @property {string} selectedMonth   - 'YYYY-MM'
 * @property {string} filterCategory  - category id or '' for all
 * @property {TxFilters} txFilters    - advanced Transaksi filters + search
 * @property {string} lastWalletId    - last wallet used on a transaction
 * @property {Record<string, boolean>} hidden - per-section privacy locks (display only)
 * @property {boolean} loaded
 * @property {string} error           - non-blocking error message ('' if none)
 * @property {string} notice          - transient confirmation toast ('' if none)
 */

const HIDDEN_LS_KEY = 'hiddenSections';

/**
 * Read the persisted per-section privacy locks. Migrates the old single
 * `saldoHidden` flag (which locked everything) forward if present.
 * @returns {Record<string, boolean>}
 */
function initialHidden() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(HIDDEN_LS_KEY);
    if (raw) return JSON.parse(raw) || {};
    // Back-compat: old global flag.
    if (localStorage.getItem('saldoHidden') === '1') {
      return { dompet: true, sekilas: true, ringkasan: true, aset: true, utang: true, investasi: true };
    }
    return {};
  } catch {
    return {};
  }
}

/** @type {State} */
const state = {
  transactions: [],
  categories: [],
  wallets: [],
  /** @type {import('../types.js').Asset[]} */
  assets: [],
  /** @type {import('../types.js').Debt[]} */
  debts: [],
  /** @type {import('../types.js').Investment[]} */
  investments: [],
  /** @type {import('../types.js').BudgetSettings} */
  budget: {
    id: 'singleton',
    monthlyIncome: 0,
    method: 'percentage',
    groups: { needs: 50, wants: 30, savings: 20 },
    fixedByCategory: {},
    groupCategoryAmounts: {},
  },
  selectedMonth: currentMonth(),
  filterCategory: '',
  txFilters: { from: '', to: '', walletId: '', categoryId: '', type: '', search: '' },
  lastWalletId: '',
  hidden: initialHidden(),
  loaded: false,
  error: '',
  notice: '',
};

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 * @param {() => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

/** @returns {Readonly<State>} */
export function getState() {
  return state;
}

/**
 * Load persisted data and seed defaults. Never throws (Req 9.2, 9.3).
 * @returns {Promise<void>}
 */
export async function init() {
  try {
    const categories = await db.seedDefaultCategoriesIfEmpty();
    // Seed the default "Tunai" wallet and migrate legacy transactions, then
    // load transactions (post-migration so walletId is populated).
    const wallets = await db.seedDefaultWalletAndMigrate(t.wallet.defaultName);
    const transactions = await db.getAllTransactions();
    const budget = await db.getBudget();
    const assets = await db.getAllAssets();
    const debts = await db.getAllDebts();
    const investments = await db.getAllInvestments();
    state.categories = categories;
    state.wallets = wallets;
    state.transactions = transactions;
    state.budget = budget;
    state.assets = assets;
    state.debts = debts;
    state.investments = investments;
    state.lastWalletId =
      (wallets.find((w) => w.id === db.DEFAULT_WALLET_ID) || wallets[0] || {}).id || '';
  } catch {
    // Fall back to defaults so the app still renders.
    state.categories = db.DEFAULT_CATEGORIES.slice();
    state.wallets = [];
    state.transactions = [];
    state.assets = [];
    state.debts = [];
    state.investments = [];
    state.error = t.errors.loadFailed;
  } finally {
    state.loaded = true;
    notify();
  }
}

// ---- Mutations (write-through) --------------------------------------------

/**
 * @param {{amount:number, type:import('../types.js').TxType, categoryId:string, date:string, note?:string, walletId?:string}} data
 * @returns {Promise<void>}
 */
export async function addTransaction(data) {
  /** @type {Transaction} */
  const txn = {
    id: makeId(),
    amount: data.amount,
    type: data.type,
    categoryId: data.categoryId,
    date: data.date,
    note: data.note ? data.note : undefined,
    walletId: data.walletId || undefined,
    photo: data.photo ? data.photo : undefined,
    createdAt: Date.now(),
  };
  state.transactions.push(txn);
  if (txn.walletId) state.lastWalletId = txn.walletId;
  notify();
  try {
    await db.addTransaction(txn);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.txSaveFailed);
  }
}

/**
 * @param {string} id
 * @param {{amount:number, type:import('../types.js').TxType, categoryId:string, date:string, note?:string, walletId?:string}} data
 * @returns {Promise<void>}
 */
export async function editTransaction(id, data) {
  const idx = state.transactions.findIndex((tx) => tx.id === id);
  if (idx === -1) return;
  const existing = state.transactions[idx];
  /** @type {Transaction} */
  const updated = {
    ...existing,
    amount: data.amount,
    type: data.type,
    categoryId: data.categoryId,
    date: data.date,
    note: data.note ? data.note : undefined,
    walletId: data.walletId || existing.walletId,
    photo: data.photo ? data.photo : undefined,
  };
  state.transactions[idx] = updated;
  if (updated.walletId) state.lastWalletId = updated.walletId;
  notify();
  try {
    await db.updateTransaction(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.txUpdateFailed);
  }
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeTransaction(id) {
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  notify();
  try {
    await db.deleteTransaction(id);
  } catch {
    setError(t.errors.txDeleteFailed);
  }
}

/**
 * Add a custom category. Assumes duplicate check done by caller/UI (Req 5.2).
 * @param {string} name
 * @param {import('../types.js').TxType} [kind='expense'] - income or expense
 * @returns {Promise<Category>}
 */
export async function addCategory(name, kind = 'expense') {
  // Append to the end of the manual order within this kind.
  const maxOrder = state.categories.reduce(
    (m, c) => ((c.kind || 'expense') === kind && typeof c.order === 'number' && c.order > m ? c.order : m),
    -1
  );
  /** @type {Category} */
  const cat = { id: makeId(), name: name.trim(), isDefault: false, kind, order: maxOrder + 1 };
  state.categories.push(cat);
  notify();
  try {
    await db.addCategory(cat);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.categorySaveFailed);
  }
  return cat;
}

/**
 * Delete a category. Any category (including defaults) may be removed; the UI
 * confirms and warns when the category is in use. Transactions keep their
 * categoryId and render as "Tak diketahui" if the category is gone.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeCategory(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  // If this is a default category, mark it so the migration doesn't re-add it.
  if (cat.isDefault) db.markDefaultDeleted(id);
  state.categories = state.categories.filter((c) => c.id !== id);
  notify();
  try {
    await db.deleteCategory(id);
  } catch {
    setError(t.errors.categoryDeleteFailed);
  }
}

/**
 * Reorder the categories of one kind to match the given id sequence
 * (drag-to-reorder in Kelola Kategori). Assigns each an `order` index; this
 * order is honored in the manager list and the transaction form dropdown.
 * @param {import('../types.js').TxType} kind
 * @param {string[]} orderedIds - category ids in the desired order
 * @returns {Promise<void>}
 */
export async function reorderCategories(kind, orderedIds) {
  const changed = [];
  orderedIds.forEach((id, i) => {
    const c = state.categories.find(
      (x) => x.id === id && (x.kind || 'expense') === kind
    );
    if (c && c.order !== i) {
      c.order = i;
      changed.push(c);
    }
  });
  if (changed.length === 0) return;
  notify();
  try {
    for (const c of changed) await db.addCategory(c);
  } catch {
    setError(t.errors.categorySaveFailed);
  }
}

// ---- Wallet mutations -----------------------------------------------------

/**
 * Add a wallet (Req 14.1). The first wallet added becomes primary by default.
 * @param {{name:string, type:import('../types.js').WalletType, balance:number, accountNumber?:string}} data
 * @returns {Promise<import('../types.js').Wallet>}
 */
export async function addWallet(data) {
  const isFirst = state.wallets.length === 0;
  // New wallets go to the end of the manual order.
  const maxOrder = state.wallets.reduce(
    (m, w) => (typeof w.order === 'number' && w.order > m ? w.order : m),
    -1
  );
  /** @type {import('../types.js').Wallet} */
  const wallet = {
    id: makeId(),
    name: data.name.trim(),
    type: data.type,
    balance: data.balance,
    accountNumber: data.accountNumber ? data.accountNumber.trim() : undefined,
    isPrimary: isFirst,
    order: maxOrder + 1,
    createdAt: Date.now(),
  };
  state.wallets.push(wallet);
  notify();
  try {
    await db.addWallet(wallet);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.walletSaveFailed);
  }
  return wallet;
}

/**
 * Edit a wallet's name/type/initial balance/account number.
 * @param {string} id
 * @param {{name:string, type:import('../types.js').WalletType, balance:number, accountNumber?:string}} data
 * @returns {Promise<void>}
 */
export async function editWallet(id, data) {
  const idx = state.wallets.findIndex((w) => w.id === id);
  if (idx === -1) return;
  /** @type {import('../types.js').Wallet} */
  const updated = {
    ...state.wallets[idx],
    name: data.name.trim(),
    type: data.type,
    balance: data.balance,
    accountNumber: data.accountNumber ? data.accountNumber.trim() : undefined,
  };
  state.wallets[idx] = updated;
  notify();
  try {
    await db.updateWallet(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.walletUpdateFailed);
  }
}

/**
 * Set a wallet as the primary ("UTAMA"). Clears the flag on all others so
 * exactly one is primary at a time (Req 14).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function setPrimaryWallet(id) {
  if (!state.wallets.some((w) => w.id === id)) return;
  /** @type {import('../types.js').Wallet[]} */
  const changed = [];
  for (const w of state.wallets) {
    const shouldBe = w.id === id;
    if (!!w.isPrimary !== shouldBe) {
      w.isPrimary = shouldBe;
      changed.push(w);
    }
  }
  notify();
  try {
    for (const w of changed) await db.updateWallet(w);
  } catch {
    setError(t.errors.walletUpdateFailed);
  }
}

/**
 * Reorder wallets to match the given id sequence (drag-to-reorder in Dompet).
 * Assigns each wallet an `order` index matching its position; persists all.
 * @param {string[]} orderedIds - wallet ids in the desired display order
 * @returns {Promise<void>}
 */
export async function reorderWallets(orderedIds) {
  const changed = [];
  orderedIds.forEach((id, i) => {
    const w = state.wallets.find((x) => x.id === id);
    if (w && w.order !== i) {
      w.order = i;
      changed.push(w);
    }
  });
  if (changed.length === 0) return;
  notify();
  try {
    for (const w of changed) await db.updateWallet(w);
  } catch {
    setError(t.errors.walletUpdateFailed);
  }
}

/**
 * Delete a wallet. Linked transactions are reassigned to the primary wallet
 * to preserve totals (Req 14.6, 21.2). The last remaining wallet cannot be
 * deleted; deleting the primary promotes another wallet to primary.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeWallet(id) {
  const target = state.wallets.find((w) => w.id === id);
  if (!target) return;
  // Must always keep at least one wallet.
  if (state.wallets.length <= 1) return;

  // Reassign linked transactions to another wallet (prefer the primary).
  const fallback =
    state.wallets.find((w) => w.id !== id && w.isPrimary) ||
    state.wallets.find((w) => w.id !== id);
  const fallbackId = fallback ? fallback.id : undefined;
  const affected = state.transactions.filter((tx) => tx.walletId === id);
  for (const tx of affected) {
    tx.walletId = fallbackId;
  }

  const wasPrimary = !!target.isPrimary;
  state.wallets = state.wallets.filter((w) => w.id !== id);

  // If we removed the primary, promote the fallback.
  let promoted = null;
  if (wasPrimary && fallback) {
    const f = state.wallets.find((w) => w.id === fallback.id);
    if (f) {
      f.isPrimary = true;
      promoted = f;
    }
  }
  notify();
  try {
    for (const tx of affected) await db.updateTransaction(tx);
    if (promoted) await db.updateWallet(promoted);
    await db.deleteWallet(id);
  } catch {
    setError(t.errors.walletDeleteFailed);
  }
}

// ---- Budget mutations (Req 16) --------------------------------------------

/** Persist the current budget settings (write-through). */
async function persistBudget() {
  notify();
  try {
    await db.saveBudget(state.budget);
  } catch {
    setError(t.errors.budgetSaveFailed);
  }
}

/** @param {number} income expected monthly income (Rupiah) */
export function setMonthlyIncome(income) {
  state.budget = { ...state.budget, monthlyIncome: Math.max(0, Math.round(income) || 0) };
  return persistBudget();
}

/** @param {import('../types.js').BudgetMethod} method */
export function setBudgetMethod(method) {
  if (method !== 'percentage' && method !== 'fixed') return Promise.resolve();
  state.budget = { ...state.budget, method };
  return persistBudget();
}

/**
 * Set the three group percentages (Kebutuhan/Keinginan/Tabungan). They should
 * sum to 100; the UI enforces this before calling (Req 16.3, 16.4).
 * @param {{needs:number, wants:number, savings:number}} groups
 */
export function setGroupPercents(groups) {
  state.budget = {
    ...state.budget,
    groups: {
      needs: Math.max(0, Math.round(groups.needs) || 0),
      wants: Math.max(0, Math.round(groups.wants) || 0),
      savings: Math.max(0, Math.round(groups.savings) || 0),
    },
  };
  return persistBudget();
}

/**
 * Assign a category to a budget group (or clear with '' / null) (Req 16.6).
 * @param {string} categoryId
 * @param {import('../types.js').BudgetGroup | ''} group
 */
export function setCategoryGroup(categoryId, group) {
  const idx = state.categories.findIndex((c) => c.id === categoryId);
  if (idx === -1) return Promise.resolve();
  const updated = { ...state.categories[idx] };
  if (group) updated.budgetGroup = group;
  else delete updated.budgetGroup;
  state.categories[idx] = updated;
  notify();
  return db.addCategory(updated).catch(() => setError(t.errors.categorySaveFailed));
}

/**
 * Set whether a category is excluded from Beranda tracking (money-move
 * categories like "Pindah -"/"Pindah +"). Excluded categories don't count in
 * the Beranda summary, Sekilas, calendar, comparison, or top expenses, but
 * still appear in Transaksi and still affect wallet balances.
 * @param {string} categoryId @param {boolean} excluded
 * @returns {Promise<void>}
 */
export function setCategoryExcludeFromBeranda(categoryId, excluded) {
  const idx = state.categories.findIndex((c) => c.id === categoryId);
  if (idx === -1) return Promise.resolve();
  const updated = { ...state.categories[idx] };
  if (excluded) updated.excludeFromBeranda = true;
  else delete updated.excludeFromBeranda;
  state.categories[idx] = updated;
  notify();
  return db.addCategory(updated).catch(() => setError(t.errors.categorySaveFailed));
}

/**
 * Set a fixed per-category budget amount (Req 16.8).
 * @param {string} categoryId @param {number} amount
 */
export function setFixedBudget(categoryId, amount) {
  const fixed = { ...state.budget.fixedByCategory };
  const val = Math.max(0, Math.round(amount) || 0);
  if (val > 0) fixed[categoryId] = val;
  else delete fixed[categoryId];
  state.budget = { ...state.budget, fixedByCategory: fixed };
  return persistBudget();
}

/**
 * Set an explicit per-category budget amount in percentage mode. Passing 0
 * clears the override, reverting that category to the even-split default
 * (Req 16.7).
 * @param {string} categoryId @param {number} amount
 */
export function setCategoryAmount(categoryId, amount) {
  const map = { ...(state.budget.groupCategoryAmounts || {}) };
  const val = Math.max(0, Math.round(amount) || 0);
  if (val > 0) map[categoryId] = val;
  else delete map[categoryId];
  state.budget = { ...state.budget, groupCategoryAmounts: map };
  return persistBudget();
}

// ---- Asset mutations (Req 17) ---------------------------------------------

/**
 * Add a manual asset.
 * @param {{name:string, assetClass:import('../types.js').AssetClass, value:number}} data
 * @returns {Promise<import('../types.js').Asset>}
 */
export async function addAsset(data) {
  /** @type {import('../types.js').Asset} */
  const asset = {
    id: makeId(),
    name: data.name.trim(),
    assetClass: data.assetClass,
    value: Math.round(data.value) || 0,
    createdAt: Date.now(),
  };
  state.assets.push(asset);
  notify();
  try {
    await db.addAsset(asset);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.assetSaveFailed);
  }
  return asset;
}

/**
 * Edit a manual asset.
 * @param {string} id
 * @param {{name:string, assetClass:import('../types.js').AssetClass, value:number}} data
 * @returns {Promise<void>}
 */
export async function editAsset(id, data) {
  const idx = state.assets.findIndex((a) => a.id === id);
  if (idx === -1) return;
  /** @type {import('../types.js').Asset} */
  const updated = {
    ...state.assets[idx],
    name: data.name.trim(),
    assetClass: data.assetClass,
    value: Math.round(data.value) || 0,
  };
  state.assets[idx] = updated;
  notify();
  try {
    await db.updateAsset(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.assetUpdateFailed);
  }
}

/** @param {string} id @returns {Promise<void>} */
export async function removeAsset(id) {
  if (!state.assets.some((a) => a.id === id)) return;
  state.assets = state.assets.filter((a) => a.id !== id);
  notify();
  try {
    await db.deleteAsset(id);
  } catch {
    setError(t.errors.assetDeleteFailed);
  }
}

// ---- Debt mutations (Req 18) ----------------------------------------------

/**
 * Add a debt.
 * @param {{name:string, total:number, paid:number, dueDate?:string}} data
 * @returns {Promise<import('../types.js').Debt>}
 */
export async function addDebt(data) {
  /** @type {import('../types.js').Debt} */
  const debt = {
    id: makeId(),
    name: data.name.trim(),
    total: Math.max(0, Math.round(data.total) || 0),
    paid: Math.max(0, Math.round(data.paid) || 0),
    dueDate: data.dueDate || undefined,
    createdAt: Date.now(),
  };
  state.debts.push(debt);
  notify();
  try {
    await db.addDebt(debt);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.debtSaveFailed);
  }
  return debt;
}

/**
 * Edit a debt.
 * @param {string} id
 * @param {{name:string, total:number, paid:number, dueDate?:string}} data
 * @returns {Promise<void>}
 */
export async function editDebt(id, data) {
  const idx = state.debts.findIndex((d) => d.id === id);
  if (idx === -1) return;
  /** @type {import('../types.js').Debt} */
  const updated = {
    ...state.debts[idx],
    name: data.name.trim(),
    total: Math.max(0, Math.round(data.total) || 0),
    paid: Math.max(0, Math.round(data.paid) || 0),
    dueDate: data.dueDate || undefined,
  };
  state.debts[idx] = updated;
  notify();
  try {
    await db.updateDebt(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.debtUpdateFailed);
  }
}

/** @param {string} id @returns {Promise<void>} */
export async function removeDebt(id) {
  if (!state.debts.some((d) => d.id === id)) return;
  state.debts = state.debts.filter((d) => d.id !== id);
  notify();
  try {
    await db.deleteDebt(id);
  } catch {
    setError(t.errors.debtDeleteFailed);
  }
}

// ---- Investment mutations (Req 19) ----------------------------------------

/**
 * Add an investment holding. `currentValue` is optional and defaults to the
 * invested amount (a fresh holding is worth what you put in). Optionally pass
 * `sourceWalletId` to deduct the invested amount from that wallet — this
 * records a "Pindah -" expense transaction so the wallet saldo drops while the
 * movement is excluded from Beranda tracking.
 * @param {{name:string, invType:import('../types.js').InvestmentType, invested:number, currentValue?:number, sourceWalletId?:string}} data
 * @returns {Promise<import('../types.js').Investment>}
 */
export async function addInvestment(data) {
  const invested = Math.max(0, Math.round(data.invested) || 0);
  const currentValue =
    data.currentValue == null || Number.isNaN(data.currentValue)
      ? invested
      : Math.max(0, Math.round(data.currentValue) || 0);
  /** @type {import('../types.js').Investment} */
  const inv = {
    id: makeId(),
    name: data.name.trim(),
    invType: data.invType,
    invested,
    currentValue,
    createdAt: Date.now(),
  };
  state.investments.push(inv);
  notify();
  try {
    await db.addInvestment(inv);
    showNotice(t.app.added);
  } catch {
    setError(t.errors.investSaveFailed);
  }
  // Deduct from the chosen wallet (if any and amount > 0) via a move-out tx.
  if (data.sourceWalletId && invested > 0) {
    await deductForInvestment(data.sourceWalletId, invested, inv.name);
  }
  return inv;
}

/**
 * Record a wallet deduction for an investment as a "Pindah -" expense
 * transaction on the given wallet. The move category keeps it out of Beranda
 * while still lowering the wallet saldo (money really moved out).
 * @param {string} walletId @param {number} amount @param {string} invName
 * @returns {Promise<void>}
 */
async function deductForInvestment(walletId, amount, invName) {
  const categoryId = await ensureMoveOutCategory();
  await addTransaction({
    amount: Math.max(0, Math.round(amount) || 0),
    type: 'expense',
    categoryId,
    date: todayISO(),
    note: `${t.investasi.moveNote} ${invName}`.trim(),
    walletId,
  });
}

/**
 * Add more money ("top up") to an existing investment: increases its invested
 * amount (and current value by the same amount) and, if a source wallet is
 * given, deducts that amount from the wallet via a "Pindah -" transaction.
 * @param {string} id @param {number} amount @param {string} [sourceWalletId]
 * @returns {Promise<void>}
 */
export async function addFundsToInvestment(id, amount, sourceWalletId) {
  const idx = state.investments.findIndex((v) => v.id === id);
  if (idx === -1) return;
  const add = Math.max(0, Math.round(amount) || 0);
  if (add <= 0) return;
  const existing = state.investments[idx];
  /** @type {import('../types.js').Investment} */
  const updated = {
    ...existing,
    invested: Math.max(0, (existing.invested || 0) + add),
    currentValue: Math.max(0, (existing.currentValue || 0) + add),
  };
  state.investments[idx] = updated;
  notify();
  try {
    await db.updateInvestment(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.investUpdateFailed);
  }
  if (sourceWalletId) {
    await deductForInvestment(sourceWalletId, add, updated.name);
  }
}

/**
 * Edit an investment holding.
 * @param {string} id
 * @param {{name:string, invType:import('../types.js').InvestmentType, invested:number, currentValue:number}} data
 * @returns {Promise<void>}
 */
export async function editInvestment(id, data) {
  const idx = state.investments.findIndex((v) => v.id === id);
  if (idx === -1) return;
  /** @type {import('../types.js').Investment} */
  const updated = {
    ...state.investments[idx],
    name: data.name.trim(),
    invType: data.invType,
    invested: Math.max(0, Math.round(data.invested) || 0),
    currentValue: Math.max(0, Math.round(data.currentValue) || 0),
  };
  state.investments[idx] = updated;
  notify();
  try {
    await db.updateInvestment(updated);
    showNotice(t.app.saved);
  } catch {
    setError(t.errors.investUpdateFailed);
  }
}

/** @param {string} id @returns {Promise<void>} */
export async function removeInvestment(id) {
  if (!state.investments.some((v) => v.id === id)) return;
  state.investments = state.investments.filter((v) => v.id !== id);
  notify();
  try {
    await db.deleteInvestment(id);
  } catch {
    setError(t.errors.investDeleteFailed);
  }
}

/** @param {string} month 'YYYY-MM' */
export function setSelectedMonth(month) {
  state.selectedMonth = month;
  notify();
}

/** @param {string} categoryId category id or '' for all */
export function setFilterCategory(categoryId) {
  state.filterCategory = categoryId;
  notify();
}

/**
 * Whether a section's amounts are hidden for privacy (display-only). Each
 * section (e.g. 'dompet', 'sekilas', 'ringkasan', 'aset', 'utang',
 * 'investasi') has its own independent lock.
 * @param {string} key
 * @returns {boolean}
 */
export function isHidden(key) {
  return !!state.hidden[key];
}

/**
 * Toggle a section's privacy lock; persisted per section.
 * @param {string} key
 */
export function toggleHidden(key) {
  state.hidden = { ...state.hidden, [key]: !state.hidden[key] };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HIDDEN_LS_KEY, JSON.stringify(state.hidden));
    }
  } catch {
    /* ignore storage errors */
  }
  notify();
}

/** Clear all list filters (keeps selected month) (Req 4.4). */
export function clearFilters() {
  state.filterCategory = '';
  notify();
}

// ---- Advanced Transaksi filters + search (Req 15) -------------------------

/**
 * Merge changes into the advanced Transaksi filters.
 * @param {Partial<TxFilters>} patch
 */
export function setTxFilters(patch) {
  state.txFilters = { ...state.txFilters, ...patch };
  notify();
}

/** Set the note/description search query. @param {string} query */
export function setTxSearch(query) {
  state.txFilters = { ...state.txFilters, search: query };
  notify();
}

/**
 * Set the search query WITHOUT notifying subscribers. The Transaksi view uses
 * this so typing in the search box doesn't trigger a full app re-render (which
 * would rebuild the input and drop focus, closing the mobile keyboard). The
 * view updates just its results list in place instead.
 * @param {string} query
 */
export function setTxSearchSilent(query) {
  state.txFilters = { ...state.txFilters, search: query };
}

/** Reset all advanced Transaksi filters and search. */
export function clearTxFilters() {
  state.txFilters = { from: '', to: '', walletId: '', categoryId: '', type: '', search: '' };
  notify();
}

/**
 * Count how many advanced filters are active (excludes search, which has its
 * own visible input). Used to badge the filter button.
 * @returns {number}
 */
export function activeFilterCount() {
  const f = state.txFilters;
  let n = 0;
  if (f.from) n++;
  if (f.to) n++;
  if (f.walletId) n++;
  if (f.categoryId) n++;
  if (f.type) n++;
  return n;
}

/** @param {string} msg */
export function setError(msg) {
  state.error = msg;
  notify();
}

export function clearError() {
  state.error = '';
  notify();
}

/** @type {number|undefined} */
let noticeTimer;

/**
 * Show a brief center-screen confirmation toast (e.g. "Tersimpan").
 * @param {string} msg
 */
export function showNotice(msg) {
  state.notice = msg;
  notify();
  if (typeof clearTimeout === 'function') clearTimeout(noticeTimer);
  if (typeof setTimeout === 'function') {
    noticeTimer = setTimeout(() => {
      state.notice = '';
      notify();
    }, 1600);
  }
}

// ---- Selectors ------------------------------------------------------------

/**
 * Transactions sorted most-recent-first (date desc, then createdAt desc) (Req 3.1).
 * @param {Transaction[]} list
 * @returns {Transaction[]}
 */
function sortRecent(list) {
  return list.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * Filtered + sorted transactions for the list view. Applies month + category
 * filters together (logical AND) (Req 4.1–4.3).
 * @param {{ month?: string, categoryId?: string }} [opts]
 * @returns {Transaction[]}
 */
export function selectFilteredTransactions(opts = {}) {
  const month = opts.month ?? state.selectedMonth;
  const categoryId = opts.categoryId ?? state.filterCategory;
  let list = state.transactions;
  if (month) list = list.filter((t) => monthOf(t.date) === month);
  if (categoryId) list = list.filter((t) => t.categoryId === categoryId);
  return sortRecent(list);
}

/**
 * Advanced Transaksi selector: date range + wallet + category + type filters
 * (logical AND) plus a case-insensitive note/description search. Returns the
 * matching transactions sorted most-recent-first (Req 15.1–15.4).
 * @param {Partial<TxFilters>} [override] - defaults to the store's txFilters
 * @returns {Transaction[]}
 */
export function selectTransactionsAdvanced(override) {
  const f = { ...state.txFilters, ...(override || {}) };
  const search = (f.search || '').trim().toLowerCase();
  let list = state.transactions;

  if (f.from) list = list.filter((t) => t.date >= f.from);
  if (f.to) list = list.filter((t) => t.date <= f.to);
  if (f.walletId) list = list.filter((t) => t.walletId === f.walletId);
  if (f.categoryId) list = list.filter((t) => t.categoryId === f.categoryId);
  if (f.type) list = list.filter((t) => t.type === f.type);
  if (search) {
    list = list.filter((t) => (t.note || '').toLowerCase().includes(search));
  }
  return sortRecent(list);
}

/**
 * Group a sorted transaction list into date sections with Indonesian headings:
 * "Hari Ini", "Kemarin", then a formatted date. Groups preserve the incoming
 * (most-recent-first) order (Req 15.5).
 * @param {Transaction[]} list - expected already sorted most-recent-first
 * @returns {{ key: string, label: string, items: Transaction[] }[]}
 */
export function groupByDate(list) {
  /** @type {{ key: string, label: string, items: Transaction[] }[]} */
  const groups = [];
  /** @type {Map<string, number>} */
  const index = new Map();
  for (const tx of list) {
    const key = tx.date;
    let gi = index.get(key);
    if (gi === undefined) {
      gi = groups.length;
      index.set(key, gi);
      groups.push({ key, label: dateGroupLabel(key), items: [] });
    }
    groups[gi].items.push(tx);
  }
  return groups;
}

/**
 * Heading for a date group.
 * @param {string} isoDate
 * @returns {string}
 */
function dateGroupLabel(isoDate) {
  if (isToday(isoDate)) return t.tx.today;
  if (isYesterday(isoDate)) return t.tx.yesterday;
  return formatDateLabel(isoDate);
}

/**
 * All transactions for a given month (unsorted filter helper).
 * @param {string} [month]
 * @returns {Transaction[]}
 */
export function selectTransactionsForMonth(month = state.selectedMonth) {
  return state.transactions.filter((t) => monthOf(t.date) === month);
}

/**
 * Monthly totals for the selected (or given) month (Req 6.1). Returns zeros
 * when there are no transactions (Req 6.4).
 * @param {string} [month]
 * @returns {MonthlySummary}
 */
export function selectMonthlySummary(month = state.selectedMonth) {
  const list = selectTransactionsForMonth(month);
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of list) {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpenses += t.amount;
  }
  return {
    month,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

/**
 * Beranda-only monthly summary that EXCLUDES money-move ("Pindah") categories.
 * Mirrors selectMonthlySummary but skips transactions whose category is a move
 * category, so the home screen reflects real income/expense only. Other
 * screens (Transaksi, Laporan, Dashboard, Budget) keep using
 * selectMonthlySummary and are unaffected.
 * @param {string} [month]
 * @returns {MonthlySummary}
 */
export function berandaMonthlySummary(month = state.selectedMonth) {
  const list = selectTransactionsForMonth(month);
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const tx of list) {
    if (isMoveCategory(tx.categoryId)) continue;
    if (tx.type === 'income') totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  }
  return { month, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}

/**
 * Today's expenses EXCLUDING money-move categories (Beranda "Sekilas").
 * @returns {number}
 */
export function berandaTodayExpenses() {
  const today = todayISO();
  let sum = 0;
  for (const tx of state.transactions) {
    if (tx.type === 'expense' && tx.date === today && !isMoveCategory(tx.categoryId)) {
      sum += tx.amount;
    }
  }
  return sum;
}

/**
 * Today's income EXCLUDING money-move categories (Beranda "Sekilas").
 * @returns {number}
 */
export function berandaTodayIncome() {
  const today = todayISO();
  let sum = 0;
  for (const tx of state.transactions) {
    if (tx.type === 'income' && tx.date === today && !isMoveCategory(tx.categoryId)) {
      sum += tx.amount;
    }
  }
  return sum;
}

/**
 * Beranda daily budget remaining = daily allowance − today's (non-move)
 * expenses. Mirrors dailyBudgetRemaining but ignores money-move transactions
 * so moving money doesn't eat into the daily budget. Null when no budget.
 * @returns {number|null}
 */
export function berandaDailyBudgetRemaining() {
  const allowance = dailyAllowance();
  if (allowance == null) return null;
  return allowance - berandaTodayExpenses();
}

/**
 * Per-day expense totals for a month EXCLUDING money-move categories, for the
 * Beranda calendar. Map of day-of-month (1-based) → expense total.
 * @param {string} [month]
 * @returns {Map<number, number>}
 */
export function berandaDailyExpenseMap(month = state.selectedMonth) {
  /** @type {Map<number, number>} */
  const map = new Map();
  for (const tx of selectTransactionsForMonth(month)) {
    if (tx.type !== 'expense') continue;
    if (isMoveCategory(tx.categoryId)) continue;
    const d = parseInt(tx.date.slice(8, 10), 10);
    if (d) map.set(d, (map.get(d) || 0) + tx.amount);
  }
  return map;
}

/**
 * Beranda comparison vs previous month, EXCLUDING money-move categories.
 * @param {string} [month]
 * @returns {{ incomePct:(number|null), expensePct:(number|null) }}
 */
export function berandaPreviousMonthComparison(month = state.selectedMonth) {
  const cur = berandaMonthlySummary(month);
  const prev = berandaMonthlySummary(prevMonth(month));
  const pct = (curVal, prevVal) =>
    prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : null;
  return {
    incomePct: pct(cur.totalIncome, prev.totalIncome),
    expensePct: pct(cur.totalExpenses, prev.totalExpenses),
  };
}

/**
 * Top (non-move) expense transactions for a month, largest first — Beranda.
 * @param {string} [month] @param {number} [n=5]
 * @returns {import('../types.js').Transaction[]}
 */
export function berandaTopExpenses(month = state.selectedMonth, n = 5) {
  return selectTransactionsForMonth(month)
    .filter((tx) => tx.type === 'expense' && !isMoveCategory(tx.categoryId))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

/**
 * Expense totals grouped by category for the month, omitting zero-total
 * categories, sorted descending by total (Req 7.2).
 * @param {string} [month]
 * @returns {CategorySpend[]}
 */
export function selectSpendingByCategory(month = state.selectedMonth) {
  const list = selectTransactionsForMonth(month).filter(
    (t) => t.type === 'expense'
  );
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const t of list) {
    totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount);
  }
  /** @type {CategorySpend[]} */
  const result = [];
  for (const [categoryId, total] of totals) {
    if (total <= 0) continue;
    result.push({
      categoryId,
      categoryName: categoryName(categoryId),
      total,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

/**
 * Like selectSpendingByCategory, but EXCLUDES categories flagged as excluded
 * (money-move / "Pindah"). Used by Laporan's chart so excluded categories
 * don't dominate the spending breakdown. The base selector is left unchanged
 * for any screen that wants the full picture.
 * @param {string} [month]
 * @returns {CategorySpend[]}
 */
export function selectSpendingByCategoryExcluded(month = state.selectedMonth) {
  const list = selectTransactionsForMonth(month).filter(
    (tx) => tx.type === 'expense' && !isMoveCategory(tx.categoryId)
  );
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const tx of list) {
    totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amount);
  }
  /** @type {CategorySpend[]} */
  const result = [];
  for (const [categoryId, total] of totals) {
    if (total <= 0) continue;
    result.push({ categoryId, categoryName: categoryName(categoryId), total });
  }
  return result.sort((a, b) => b.total - a.total);
}

/**
 * Monthly report that EXCLUDES excluded categories, for Laporan. Mirrors
 * monthlyReport's shape ({month, income, expenses, netSavings}).
 * @param {string} [month]
 * @returns {{ month:string, income:number, expenses:number, netSavings:number }}
 */
export function monthlyReportExcluded(month = state.selectedMonth) {
  const s = berandaMonthlySummary(month);
  return {
    month,
    income: s.totalIncome,
    expenses: s.totalExpenses,
    netSavings: s.totalIncome - s.totalExpenses,
  };
}

/**
 * Resolve a category id to its display name (falls back gracefully).
 * @param {string} id
 * @returns {string}
 */
export function categoryName(id) {
  const c = state.categories.find((x) => x.id === id);
  if (!c) return t.category.unknown;
  // Localize default categories by their stable slug id; custom categories
  // keep their user-entered name.
  if (c.isDefault && t.defaultCategories[c.id]) return t.defaultCategories[c.id];
  return c.name;
}

/**
 * Categories for a given transaction kind (income/expense), sorted by manual
 * `order` (falls back to name when order is absent). This ordering is honored
 * everywhere — Kelola Kategori and the transaction form dropdown — so they
 * always match. Categories with no `kind` are treated as expense.
 * @param {import('../types.js').TxType} kind
 * @returns {import('../types.js').Category[]}
 */
export function categoriesByKind(kind) {
  return state.categories
    .filter((c) => (c.kind || 'expense') === kind)
    .sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : Infinity;
      const bo = typeof b.order === 'number' ? b.order : Infinity;
      if (ao !== bo) return ao - bo;
      return (a.name || '').localeCompare(b.name || '');
    });
}

/**
 * Count of transactions using a given category (for delete-in-use warning) (Req 5.5).
 * @param {string} categoryId
 * @returns {number}
 */
export function countTransactionsForCategory(categoryId) {
  return state.transactions.filter((t) => t.categoryId === categoryId).length;
}

// ---- "Pindah" (money-move) categories -------------------------------------
// Transactions in these categories are just moving money between the user's
// own places (e.g. wallet → investment), not real income/expense. They are
// EXCLUDED from the Beranda summary, daily "Sekilas", and calendar — but still
// appear in Transaksi and still affect wallet balances (money really moved).
// Custom categories have random UUIDs, so we identify these by their canonical
// names + kind.

/** Canonical names of the money-move categories. */
export const MOVE_OUT_NAME = 'Pindah -'; // expense side (money leaving a wallet)
export const MOVE_IN_NAME = 'Pindah +'; // income side (money arriving in a wallet)

/**
 * Find a category by exact (trimmed) name and kind.
 * @param {string} name @param {import('../types.js').TxType} kind
 * @returns {import('../types.js').Category | undefined}
 */
export function categoryByNameKind(name, kind) {
  const target = name.trim().toLowerCase();
  return state.categories.find(
    (c) => (c.name || '').trim().toLowerCase() === target && (c.kind || 'expense') === kind
  );
}

/** @returns {string|undefined} id of the "Pindah -" expense category, if it exists. */
export function moveOutCategoryId() {
  const c = categoryByNameKind(MOVE_OUT_NAME, 'expense');
  return c ? c.id : undefined;
}

/** @returns {string|undefined} id of the "Pindah +" income category, if it exists. */
export function moveInCategoryId() {
  const c = categoryByNameKind(MOVE_IN_NAME, 'income');
  return c ? c.id : undefined;
}

/**
 * Whether a transaction's category should be excluded from Beranda tracking.
 * True when the category has the explicit `excludeFromBeranda` flag, OR (as a
 * fallback for categories created before the flag existed) when it is one of
 * the canonical "Pindah -"/"Pindah +" money-move categories by name.
 * @param {string} categoryId
 * @returns {boolean}
 */
export function isMoveCategory(categoryId) {
  if (!categoryId) return false;
  const c = state.categories.find((x) => x.id === categoryId);
  if (c && c.excludeFromBeranda) return true;
  return categoryId === moveOutCategoryId() || categoryId === moveInCategoryId();
}

/**
 * Ensure the "Pindah -" (expense) category exists, creating it if needed, and
 * return its id. Used when deducting a wallet for an investment so the
 * deduction is excluded from Beranda but still reduces the wallet saldo.
 * @returns {Promise<string>}
 */
export async function ensureMoveOutCategory() {
  const existing = moveOutCategoryId();
  if (existing) {
    // Make sure it's flagged so it stays out of Beranda even if renamed later.
    const c = state.categories.find((x) => x.id === existing);
    if (c && !c.excludeFromBeranda) await setCategoryExcludeFromBeranda(existing, true);
    return existing;
  }
  const cat = await addCategory(MOVE_OUT_NAME, 'expense');
  await setCategoryExcludeFromBeranda(cat.id, true);
  return cat.id;
}

/**
 * Sorted list of months (desc) that have transactions, plus the current month,
 * for populating the month selector.
 * @returns {string[]}
 */
export function selectAvailableMonths() {
  const set = new Set(state.transactions.map((t) => monthOf(t.date)));
  set.add(currentMonth());
  set.add(state.selectedMonth);
  return Array.from(set)
    .filter(Boolean)
    .sort((a, b) => (a < b ? 1 : -1));
}


// ---- Wallet selectors -----------------------------------------------------

/**
 * Look up a wallet by id.
 * @param {string} id
 * @returns {import('../types.js').Wallet | undefined}
 */
export function walletById(id) {
  return state.wallets.find((w) => w.id === id);
}

/**
 * Display name for a wallet id (falls back gracefully).
 * @param {string} id
 * @returns {string}
 */
export function walletName(id) {
  const w = walletById(id);
  return w ? w.name : '';
}

/**
 * Derived saldo for a wallet: initial balance + all income to it − all
 * expenses from it, across all time (Req 14.8). Keeps balances drift-free.
 * @param {string} id
 * @returns {number}
 */
export function walletSaldo(id) {
  const w = walletById(id);
  if (!w) return 0;
  let saldo = w.balance;
  for (const tx of state.transactions) {
    if (tx.walletId !== id) continue;
    if (tx.type === 'income') saldo += tx.amount;
    else saldo -= tx.amount;
  }
  return saldo;
}

/**
 * Total saldo across all wallets. Credit-card wallets that are negative
 * subtract from the total (Req 14.3, 14.4).
 * @returns {number}
 */
export function totalSaldo() {
  return state.wallets.reduce((sum, w) => sum + walletSaldo(w.id), 0);
}

/**
 * Wallets with their derived saldo. Primary wallet first, then creation order.
 * @returns {{ wallet: import('../types.js').Wallet, saldo: number }[]}
 */
export function walletsWithSaldo() {
  return state.wallets
    .slice()
    .sort(compareWalletOrder)
    .map((w) => ({ wallet: w, saldo: walletSaldo(w.id) }));
}

/**
 * Sort comparator for wallets by manual `order`, falling back to primary-first
 * then creation order when `order` is absent.
 * @param {import('../types.js').Wallet} a @param {import('../types.js').Wallet} b
 */
function compareWalletOrder(a, b) {
  const ao = typeof a.order === 'number' ? a.order : Infinity;
  const bo = typeof b.order === 'number' ? b.order : Infinity;
  if (ao !== bo) return ao - bo;
  if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

/**
 * The current primary ("UTAMA") wallet, if any.
 * @returns {import('../types.js').Wallet | undefined}
 */
export function primaryWallet() {
  return state.wallets.find((w) => w.isPrimary);
}


// ---- Budget selectors (Req 16) --------------------------------------------

/** @returns {import('../types.js').BudgetSettings} */
export function getBudget() {
  return state.budget;
}

/** @returns {boolean} true if a usable budget is configured. */
export function hasBudget() {
  const b = state.budget;
  if (b.method === 'percentage') return b.monthlyIncome > 0;
  // fixed: usable if any category has a positive limit
  return Object.values(b.fixedByCategory || {}).some((v) => v > 0);
}

/**
 * Rupiah budget for a group (percentage method): percent × monthly income.
 * @param {import('../types.js').BudgetGroup} group
 * @returns {number}
 */
export function groupBudget(group) {
  const b = state.budget;
  const pct = (b.groups && b.groups[group]) || 0;
  return Math.round((pct / 100) * (b.monthlyIncome || 0));
}

/**
 * Budget limit for a single category.
 * - fixed method: the stored per-category amount (0 if none).
 * - percentage method: the category's group budget split evenly across all
 *   categories assigned to that group (Req 16.7). Categories with no group
 *   get 0.
 * @param {string} categoryId
 * @returns {number}
 */
export function categoryBudget(categoryId) {
  const b = state.budget;
  if (b.method === 'fixed') {
    return (b.fixedByCategory && b.fixedByCategory[categoryId]) || 0;
  }
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat || !cat.budgetGroup) return 0;
  // If the user set an explicit amount for this category, use it (Req 16.7,
  // editable). Otherwise fall back to an even split of the group budget.
  const override = b.groupCategoryAmounts && b.groupCategoryAmounts[categoryId];
  if (override != null && override > 0) return override;
  const group = cat.budgetGroup;
  const peers = state.categories.filter((c) => c.budgetGroup === group);
  if (peers.length === 0) return 0;
  return Math.round(groupBudget(group) / peers.length);
}

/**
 * Per-category budget progress for a month: spent vs limit (Req 16.9).
 * Only categories with a positive limit (or with spending) are returned.
 * @param {string} [month]
 * @returns {{ categoryId:string, categoryName:string, group:(import('../types.js').BudgetGroup|undefined), spent:number, limit:number, pct:number, over:boolean }[]}
 */
export function budgetProgress(month = state.selectedMonth) {
  const spendMap = new Map();
  for (const tx of selectTransactionsForMonth(month)) {
    if (tx.type !== 'expense') continue;
    spendMap.set(tx.categoryId, (spendMap.get(tx.categoryId) || 0) + tx.amount);
  }
  /** @type {ReturnType<typeof budgetProgress>} */
  const rows = [];
  for (const c of state.categories) {
    const limit = categoryBudget(c.id);
    const spent = spendMap.get(c.id) || 0;
    if (limit <= 0 && spent <= 0) continue;
    const pct = limit > 0 ? Math.min(999, Math.round((spent / limit) * 100)) : 0;
    rows.push({
      categoryId: c.id,
      categoryName: categoryName(c.id),
      group: c.budgetGroup,
      spent,
      limit,
      pct,
      over: limit > 0 && spent > limit,
    });
  }
  // Sort: over-budget first, then by spent desc.
  return rows.sort((a, b) => {
    if (a.over !== b.over) return a.over ? -1 : 1;
    return b.spent - a.spent;
  });
}

/**
 * Total budgeted amount for the current month.
 * - percentage: whole monthly income (needs+wants+savings should sum to it)
 * - fixed: sum of per-category limits
 * @returns {number}
 */
export function totalMonthlyBudget() {
  const b = state.budget;
  if (b.method === 'fixed') {
    return Object.values(b.fixedByCategory || {}).reduce((s, v) => s + (v || 0), 0);
  }
  return b.monthlyIncome || 0;
}

/**
 * Amount allocated to savings (Tabungan) this month.
 * - percentage: savings% × monthly income.
 * - fixed: sum of fixed budgets for categories assigned to the savings group.
 * Savings is money set aside, so it's excluded from spendable income and the
 * daily budget.
 * @returns {number}
 */
export function savingsAllocation() {
  const b = state.budget;
  if (b.method === 'percentage') {
    return groupBudget('savings');
  }
  // fixed: sum fixed budgets of categories in the savings group
  let sum = 0;
  for (const c of state.categories) {
    if (c.budgetGroup === 'savings') sum += (b.fixedByCategory && b.fixedByCategory[c.id]) || 0;
  }
  return sum;
}

/**
 * Spendable income for a month = (budget's expected monthly income + this
 * month's actual income transactions) − savings allocation. Savings is not
 * counted as spendable (Req: Beranda pemasukan excludes tabungan).
 * @param {string} [month]
 * @returns {number}
 */
export function spendableIncome(month = state.selectedMonth) {
  const base = state.budget.monthlyIncome || 0;
  let actualIncome = 0;
  for (const tx of selectTransactionsForMonth(month)) {
    if (tx.type === 'income') actualIncome += tx.amount;
  }
  return Math.max(0, base + actualIncome - savingsAllocation());
}

/**
 * Spendable monthly budget = total budget − savings allocation. This is the
 * pool the daily budget draws from (savings is set aside, not spent).
 * @returns {number}
 */
export function spendableMonthlyBudget() {
  return Math.max(0, totalMonthlyBudget() - savingsAllocation());
}

/**
 * The flat daily allowance = (monthly income − savings) ÷ days in the current
 * month (WIB). This resets each day. Returns null when no budget is set.
 * @returns {number|null}
 */
export function dailyAllowance() {
  if (!hasBudget()) return null;
  const pool = spendableMonthlyBudget();
  if (pool <= 0) return null;
  const days = daysInCurrentMonth();
  if (days <= 0) return null;
  return Math.round(pool / days);
}

/**
 * Total expenses recorded today (WIB).
 * @returns {number}
 */
export function todayExpenses() {
  const today = todayISO();
  let sum = 0;
  for (const tx of state.transactions) {
    if (tx.type === 'expense' && tx.date === today) sum += tx.amount;
  }
  return sum;
}

/**
 * Total income recorded today (WIB).
 * @returns {number}
 */
export function todayIncome() {
  const today = todayISO();
  let sum = 0;
  for (const tx of state.transactions) {
    if (tx.type === 'income' && tx.date === today) sum += tx.amount;
  }
  return sum;
}

/**
 * Today's remaining daily budget: the flat daily allowance minus today's
 * expenses; resets each day (WIB). Can go negative if you overspend today.
 * Returns null when no budget is set.
 * @returns {number|null}
 */
export function dailyBudgetRemaining() {
  const allowance = dailyAllowance();
  if (allowance == null) return null;
  return allowance - todayExpenses();
}


// ---- Asset / net worth selectors (Req 17) ---------------------------------

/**
 * Total value of manual assets in a class.
 * @param {import('../types.js').AssetClass} cls
 * @returns {number}
 */
function assetsTotal(cls) {
  return state.assets
    .filter((a) => a.assetClass === cls)
    .reduce((s, a) => s + (a.value || 0), 0);
}

/**
 * Breakdown of the three net-worth components (Req 17.3):
 * wallets total, liquid assets total, fixed assets total.
 * @returns {{ walletsTotal:number, liquidTotal:number, fixedTotal:number }}
 */
export function assetsBreakdown() {
  return {
    walletsTotal: totalSaldo(),
    liquidTotal: assetsTotal('liquid'),
    fixedTotal: assetsTotal('fixed'),
  };
}

/**
 * Estimated total net worth = wallets + liquid + fixed (Req 17.1).
 * Credit-card negatives already subtract via totalSaldo().
 * @returns {number}
 */
export function netWorth() {
  const b = assetsBreakdown();
  return b.walletsTotal + b.liquidTotal + b.fixedTotal;
}

/**
 * Average monthly expense over the last `window` months that have expense
 * data (Req 17.4). Returns 0 when there is no expense history.
 * @param {number} [window=3]
 * @returns {number}
 */
export function avgMonthlyExpense(window = 3) {
  // Sum expenses per month key.
  /** @type {Map<string, number>} */
  const byMonth = new Map();
  for (const tx of state.transactions) {
    if (tx.type !== 'expense') continue;
    const m = monthOf(tx.date);
    byMonth.set(m, (byMonth.get(m) || 0) + tx.amount);
  }
  if (byMonth.size === 0) return 0;
  // Take the most recent `window` months that have expenses.
  const months = Array.from(byMonth.keys()).sort((a, b) => (a < b ? 1 : -1));
  const pick = months.slice(0, window);
  const sum = pick.reduce((s, m) => s + (byMonth.get(m) || 0), 0);
  return Math.round(sum / pick.length);
}

/**
 * Liquid net worth for the runway calc: non-credit wallet saldo + liquid
 * assets (credit cards and fixed assets excluded).
 * @returns {number}
 */
export function liquidNetWorth() {
  let wallets = 0;
  for (const w of state.wallets) {
    if (w.type === 'credit') continue;
    wallets += walletSaldo(w.id);
  }
  return wallets + assetsTotal('liquid');
}

/**
 * Total Runway: how many months liquid net worth covers average monthly
 * expenses (Req 17.4). Returns null when average expense is 0 (not-applicable,
 * avoids divide-by-zero, Req 17.5).
 * @returns {number|null}
 */
export function runwayMonths() {
  const avg = avgMonthlyExpense(3);
  if (avg <= 0) return null;
  return liquidNetWorth() / avg;
}


// ---- Debt selectors (Req 18) ----------------------------------------------

/**
 * Remaining balance for a debt = total − paid, never below zero (Req 18.2).
 * @param {import('../types.js').Debt} d
 * @returns {number}
 */
export function debtRemaining(d) {
  return Math.max(0, (d.total || 0) - (d.paid || 0));
}

/**
 * Overall total remaining debt across all debts (Req 18.3).
 * @returns {number}
 */
export function totalDebt() {
  return state.debts.reduce((s, d) => s + debtRemaining(d), 0);
}

/**
 * True if a debt has an unpaid balance and a due date in the past (Req 18.4).
 * @param {import('../types.js').Debt} d
 * @returns {boolean}
 */
export function isDebtOverdue(d) {
  if (!d.dueDate) return false;
  if (debtRemaining(d) <= 0) return false;
  return d.dueDate < todayISO();
}

/**
 * Debts sorted: unpaid first, overdue first within that, then by due date,
 * then most recently added.
 * @returns {import('../types.js').Debt[]}
 */
export function debtsSorted() {
  return state.debts.slice().sort((a, b) => {
    const ar = debtRemaining(a) > 0;
    const br = debtRemaining(b) > 0;
    if (ar !== br) return ar ? -1 : 1;
    const ao = isDebtOverdue(a);
    const bo = isDebtOverdue(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}


// ---- Investment selectors (Req 19) ----------------------------------------

/**
 * Gain/loss for a single investment holding (Req 19.4).
 * @param {import('../types.js').Investment} v
 * @returns {{ gain:number, gainPct:number }}
 */
export function investmentGainLoss(v) {
  const gain = (v.currentValue || 0) - (v.invested || 0);
  const gainPct = v.invested > 0 ? (gain / v.invested) * 100 : 0;
  return { gain, gainPct };
}

/**
 * Portfolio totals: invested, current value, overall gain, and gain % (Req 19.2, 19.3).
 * @returns {{ invested:number, current:number, gain:number, gainPct:number }}
 */
export function investTotals() {
  let invested = 0;
  let current = 0;
  for (const v of state.investments) {
    invested += v.invested || 0;
    current += v.currentValue || 0;
  }
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return { invested, current, gain, gainPct };
}

/**
 * Investments sorted by current value (largest first).
 * @returns {import('../types.js').Investment[]}
 */
export function investmentsSorted() {
  return state.investments
    .slice()
    .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));
}


// ---- Laporan / report selectors (Req 20) ----------------------------------

/**
 * Monthly report figures (Req 20.1): income, expenses, and net savings
 * (income − expenses) for a month. Uses raw transaction totals for the month.
 * @param {string} [month]
 * @returns {{ month:string, income:number, expenses:number, netSavings:number }}
 */
export function monthlyReport(month = state.selectedMonth) {
  const s = selectMonthlySummary(month);
  return {
    month,
    income: s.totalIncome,
    expenses: s.totalExpenses,
    netSavings: s.totalIncome - s.totalExpenses,
  };
}

/**
 * Percentage change vs the previous month for income and expenses (Req 20.2).
 * Each field is null when the previous month's figure is 0/absent (N/A,
 * avoids divide-by-zero, Req 20.3).
 * @param {string} [month]
 * @returns {{ incomePct:(number|null), expensePct:(number|null) }}
 */
export function previousMonthComparison(month = state.selectedMonth) {
  const cur = monthlyReport(month);
  const prev = monthlyReport(prevMonth(month));
  const pct = (curVal, prevVal) =>
    prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : null;
  return {
    incomePct: pct(cur.income, prev.income),
    expensePct: pct(cur.expenses, prev.expenses),
  };
}

/**
 * Top expense transactions for a month, largest first (Req 20.5).
 * @param {string} [month] @param {number} [n=5]
 * @returns {import('../types.js').Transaction[]}
 */
export function topExpenses(month = state.selectedMonth, n = 5) {
  return selectTransactionsForMonth(month)
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}


// ---- Dashboard (Beranda) selectors (Req 22) -------------------------------

/**
 * Time-of-day greeting in Bahasa Indonesia (Req 22.2).
 * pagi <11, siang 11–14, sore 15–18, malam otherwise.
 * @param {Date} [now]
 * @returns {string}
 */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return t.beranda.greetPagi;
  if (h < 15) return t.beranda.greetSiang;
  if (h < 19) return t.beranda.greetSore;
  return t.beranda.greetMalam;
}

/**
 * Daily net spend for each day of a month (Req 22.5): a map of day-of-month
 * (1-based) to net spend (expenses − income) for that day. Positive = net
 * spending, negative = net income; 0/absent = neutral.
 * @param {string} [month]
 * @returns {Map<number, number>}
 */
export function dailyNetSpend(month = state.selectedMonth) {
  /** @type {Map<number, number>} */
  const map = new Map();
  for (const tx of selectTransactionsForMonth(month)) {
    const day = parseInt(tx.date.slice(8, 10), 10);
    if (!day) continue;
    const delta = tx.type === 'expense' ? tx.amount : -tx.amount;
    map.set(day, (map.get(day) || 0) + delta);
  }
  return map;
}

/**
 * The most recent transactions across all months (Req 22.6).
 * @param {number} [n=8]
 * @returns {Transaction[]}
 */
export function recentTransactions(n = 8) {
  return sortRecent(state.transactions).slice(0, n);
}
