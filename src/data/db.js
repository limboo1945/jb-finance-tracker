// @ts-check
/**
 * IndexedDB repository for the finance tracker.
 * Uses the raw IndexedDB API (no dependencies). All reads are wrapped so a
 * missing or corrupt database resolves to a valid empty/default state rather
 * than throwing (Req 9.3).
 *
 * @typedef {import('../types.js').Transaction} Transaction
 * @typedef {import('../types.js').Category} Category
 */

const DB_NAME = 'finance-tracker';
const DB_VERSION = 6;
const STORE_TX = 'transactions';
const STORE_CAT = 'categories';
const STORE_WALLET = 'wallets';
const STORE_BUDGET = 'budget';
const STORE_ASSET = 'assets';
const STORE_DEBT = 'debts';
const STORE_INVEST = 'investments';

/** Stable id for the seeded default cash wallet (Req 21.2). */
export const DEFAULT_WALLET_ID = 'tunai';

/** Stable key for the singleton budget settings record (Req 16). */
export const BUDGET_ID = 'singleton';

/** Default budget settings (percentage 50/30/20, no income set yet). */
export const DEFAULT_BUDGET = /** @type {import('../types.js').BudgetSettings} */ ({
  id: BUDGET_ID,
  monthlyIncome: 0,
  method: 'percentage',
  groups: { needs: 50, wants: 30, savings: 20 },
  fixedByCategory: {},
  groupCategoryAmounts: {},
});

const DELETED_DEFAULTS_LS_KEY = 'deletedDefaultCategories';

/**
 * IDs of default categories the user explicitly deleted, so the migration
 * doesn't re-add them. Stored in localStorage (lightweight; not in IndexedDB
 * since the migration runs before IDB data is available for this check).
 * @returns {Set<string>}
 */
function getDeletedDefaults() {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(DELETED_DEFAULTS_LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Mark a default category as user-deleted so the migration won't re-add it.
 * @param {string} id
 */
export function markDefaultDeleted(id) {
  try {
    const set = getDeletedDefaults();
    set.add(id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_DEFAULTS_LS_KEY, JSON.stringify([...set]));
    }
  } catch { /* ignore */ }
}

/** Default categories seeded on first run (Req 5.1). Stable slug ids. */
export const DEFAULT_CATEGORIES = /** @type {Category[]} */ ([
  // Expense categories
  { id: 'food', name: 'Food', isDefault: true, kind: 'expense' },
  { id: 'transport', name: 'Transport', isDefault: true, kind: 'expense' },
  { id: 'rent', name: 'Rent', isDefault: true, kind: 'expense' },
  { id: 'bills', name: 'Bills', isDefault: true, kind: 'expense' },
  { id: 'shopping', name: 'Shopping', isDefault: true, kind: 'expense' },
  { id: 'entertainment', name: 'Entertainment', isDefault: true, kind: 'expense' },
  { id: 'other', name: 'Other', isDefault: true, kind: 'expense' },
  // Income categories
  { id: 'income', name: 'Income', isDefault: true, kind: 'income' },
  { id: 'gaji', name: 'Salary', isDefault: true, kind: 'income' },
  { id: 'uang-jajan', name: 'Allowance', isDefault: true, kind: 'income' },
  { id: 'reimburse', name: 'Reimbursement', isDefault: true, kind: 'income' },
  { id: 'bonus', name: 'Bonus', isDefault: true, kind: 'income' },
  { id: 'hadiah', name: 'Gift', isDefault: true, kind: 'income' },
]);

/** @type {Promise<IDBDatabase|null>|null} */
let dbPromise = null;

/**
 * Open (and if needed create/upgrade) the database.
 * Resolves to null if IndexedDB is unavailable or blocked so callers can
 * fall back to defaults without crashing.
 * @returns {Promise<IDBDatabase|null>}
 */
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 stores
      if (!db.objectStoreNames.contains(STORE_TX)) {
        const tx = db.createObjectStore(STORE_TX, { keyPath: 'id' });
        tx.createIndex('by-date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CAT)) {
        db.createObjectStore(STORE_CAT, { keyPath: 'id' });
      }
      // v2 stores (Req 21.3)
      if (!db.objectStoreNames.contains(STORE_WALLET)) {
        db.createObjectStore(STORE_WALLET, { keyPath: 'id' });
      }
      // v3 stores (Req 16)
      if (!db.objectStoreNames.contains(STORE_BUDGET)) {
        db.createObjectStore(STORE_BUDGET, { keyPath: 'id' });
      }
      // v4 stores (Req 17)
      if (!db.objectStoreNames.contains(STORE_ASSET)) {
        db.createObjectStore(STORE_ASSET, { keyPath: 'id' });
      }
      // v5 stores (Req 18)
      if (!db.objectStoreNames.contains(STORE_DEBT)) {
        db.createObjectStore(STORE_DEBT, { keyPath: 'id' });
      }
      // v6 stores (Req 19)
      if (!db.objectStoreNames.contains(STORE_INVEST)) {
        db.createObjectStore(STORE_INVEST, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/**
 * Run a transaction against a store and return a promise for its result.
 * @template T
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} fn
 * @returns {Promise<T>}
 */
function run(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) {
          reject(new Error('IndexedDB unavailable'));
          return;
        }
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

// ---- Transactions ---------------------------------------------------------

/** @returns {Promise<Transaction[]>} */
export async function getAllTransactions() {
  try {
    const all = await run(STORE_TX, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidTransaction) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {Transaction} txn @returns {Promise<void>} */
export async function addTransaction(txn) {
  await run(STORE_TX, 'readwrite', (s) => s.put(txn));
}

/** @param {Transaction} txn @returns {Promise<void>} */
export async function updateTransaction(txn) {
  await run(STORE_TX, 'readwrite', (s) => s.put(txn));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteTransaction(id) {
  await run(STORE_TX, 'readwrite', (s) => s.delete(id));
}

// ---- Categories -----------------------------------------------------------

/** @returns {Promise<Category[]>} */
export async function getAllCategories() {
  try {
    const all = await run(STORE_CAT, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidCategory) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {Category} c @returns {Promise<void>} */
export async function addCategory(c) {
  await run(STORE_CAT, 'readwrite', (s) => s.put(c));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteCategory(id) {
  await run(STORE_CAT, 'readwrite', (s) => s.delete(id));
}

/**
 * Seed default categories if the store is empty; otherwise migrate existing
 * categories: backfill a `kind` (defaults use the known mapping, others
 * default to 'expense') and add any newly-introduced income defaults that are
 * missing. Returns the full category list. Never throws (Req 5.1, 9.3).
 * @returns {Promise<Category[]>}
 */
export async function seedDefaultCategoriesIfEmpty() {
  try {
    let existing = await getAllCategories();

    // First run: seed everything with an initial per-kind order.
    if (existing.length === 0) {
      const seeded = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i }));
      for (const c of seeded) await addCategory(c);
      return seeded;
    }

    // Migration: backfill `kind` on categories that lack it.
    const defaultKindById = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.kind]));
    for (const c of existing) {
      if (!c.kind) {
        c.kind = defaultKindById.get(c.id) || 'expense';
        await addCategory(c);
      }
    }

    // Migration: add newly-introduced default income categories if missing,
    // but skip any that the user explicitly deleted.
    const haveIds = new Set(existing.map((c) => c.id));
    const deletedDefaults = getDeletedDefaults();
    for (const c of DEFAULT_CATEGORIES) {
      if (!haveIds.has(c.id) && !deletedDefaults.has(c.id)) {
        await addCategory(c);
        existing.push(c);
      }
    }

    // Migration: backfill a per-kind `order` for categories missing one.
    // Preserve the current display order (alphabetical by name) so nothing
    // visibly jumps on upgrade; new categories append after existing ones.
    if (existing.some((c) => typeof c.order !== 'number')) {
      for (const kind of ['expense', 'income']) {
        const inKind = existing.filter((c) => (c.kind || 'expense') === kind);
        // Start numbering after any already-ordered items in this kind.
        let next = inKind.reduce(
          (m, c) => (typeof c.order === 'number' && c.order >= m ? c.order + 1 : m),
          0
        );
        const unordered = inKind
          .filter((c) => typeof c.order !== 'number')
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        for (const c of unordered) {
          c.order = next++;
          await addCategory(c);
        }
      }
    }

    return existing;
  } catch {
    return DEFAULT_CATEGORIES.slice();
  }
}

// ---- Wallets --------------------------------------------------------------

/** @returns {Promise<import('../types.js').Wallet[]>} */
export async function getAllWallets() {
  try {
    const all = await run(STORE_WALLET, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidWallet) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {import('../types.js').Wallet} w @returns {Promise<void>} */
export async function addWallet(w) {
  await run(STORE_WALLET, 'readwrite', (s) => s.put(w));
}

/** @param {import('../types.js').Wallet} w @returns {Promise<void>} */
export async function updateWallet(w) {
  await run(STORE_WALLET, 'readwrite', (s) => s.put(w));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteWallet(id) {
  await run(STORE_WALLET, 'readwrite', (s) => s.delete(id));
}

/**
 * Ensure a default cash wallet ("Tunai") exists and migrate any legacy
 * transactions that have no walletId onto it (Req 21.1, 21.2). Never throws.
 * @param {string} tunaiName - localized display name for the seeded wallet
 * @returns {Promise<import('../types.js').Wallet[]>} the full wallet list
 */
export async function seedDefaultWalletAndMigrate(tunaiName) {
  try {
    let wallets = await getAllWallets();

    // Seed the default cash wallet if there are none yet.
    if (wallets.length === 0) {
      /** @type {import('../types.js').Wallet} */
      const tunai = {
        id: DEFAULT_WALLET_ID,
        name: tunaiName,
        type: 'cash',
        balance: 0,
        isPrimary: true,
        createdAt: Date.now(),
      };
      await addWallet(tunai);
      wallets = [tunai];
    }

    // Ensure exactly one primary wallet exists (migration for pre-primary data).
    if (wallets.length > 0 && !wallets.some((w) => w.isPrimary)) {
      const first =
        wallets.find((w) => w.id === DEFAULT_WALLET_ID) || wallets[0];
      first.isPrimary = true;
      await updateWallet(first);
    }

    // Migrate legacy transactions with no walletId to the default wallet.
    const txns = await getAllTransactions();
    const orphans = txns.filter((t) => !t.walletId);
    if (orphans.length > 0) {
      const fallbackId =
        (wallets.find((w) => w.id === DEFAULT_WALLET_ID) || wallets[0]).id;
      for (const t of orphans) {
        await updateTransaction({ ...t, walletId: fallbackId });
      }
    }

    // Assign an initial manual order to any wallet missing one. Preserve the
    // current display order (primary first, then creation order) so nothing
    // visibly moves on upgrade.
    if (wallets.some((w) => typeof w.order !== 'number')) {
      const ordered = wallets.slice().sort((a, b) => {
        if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      for (let i = 0; i < ordered.length; i++) {
        if (typeof ordered[i].order !== 'number') {
          ordered[i].order = i;
          await updateWallet(ordered[i]);
        }
      }
    }

    return wallets;
  } catch {
    // Fall back to an in-memory default so the app still works (Req 9.3).
    return [
      {
        id: DEFAULT_WALLET_ID,
        name: tunaiName,
        type: 'cash',
        balance: 0,
        createdAt: Date.now(),
      },
    ];
  }
}

// ---- Budget ---------------------------------------------------------------

/**
 * Load the singleton budget settings, or the defaults if none saved yet.
 * Never throws (Req 9.3).
 * @returns {Promise<import('../types.js').BudgetSettings>}
 */
export async function getBudget() {
  try {
    const rec = await run(STORE_BUDGET, 'readonly', (s) => s.get(BUDGET_ID));
    if (rec && isValidBudget(rec)) {
      // Merge onto defaults so missing fields are backfilled.
      return {
        ...DEFAULT_BUDGET,
        ...rec,
        groups: { ...DEFAULT_BUDGET.groups, ...(rec.groups || {}) },
        fixedByCategory: { ...(rec.fixedByCategory || {}) },
        groupCategoryAmounts: { ...(rec.groupCategoryAmounts || {}) },
      };
    }
    return { ...DEFAULT_BUDGET };
  } catch {
    return { ...DEFAULT_BUDGET };
  }
}

/**
 * Persist the budget settings.
 * @param {import('../types.js').BudgetSettings} budget
 * @returns {Promise<void>}
 */
export async function saveBudget(budget) {
  await run(STORE_BUDGET, 'readwrite', (s) => s.put({ ...budget, id: BUDGET_ID }));
}

// ---- Assets (Req 17) ------------------------------------------------------

/** @returns {Promise<import('../types.js').Asset[]>} */
export async function getAllAssets() {
  try {
    const all = await run(STORE_ASSET, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidAsset) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {import('../types.js').Asset} a @returns {Promise<void>} */
export async function addAsset(a) {
  await run(STORE_ASSET, 'readwrite', (s) => s.put(a));
}

/** @param {import('../types.js').Asset} a @returns {Promise<void>} */
export async function updateAsset(a) {
  await run(STORE_ASSET, 'readwrite', (s) => s.put(a));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteAsset(id) {
  await run(STORE_ASSET, 'readwrite', (s) => s.delete(id));
}

// ---- Debts (Req 18) -------------------------------------------------------

/** @returns {Promise<import('../types.js').Debt[]>} */
export async function getAllDebts() {
  try {
    const all = await run(STORE_DEBT, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidDebt) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {import('../types.js').Debt} d @returns {Promise<void>} */
export async function addDebt(d) {
  await run(STORE_DEBT, 'readwrite', (s) => s.put(d));
}

/** @param {import('../types.js').Debt} d @returns {Promise<void>} */
export async function updateDebt(d) {
  await run(STORE_DEBT, 'readwrite', (s) => s.put(d));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteDebt(id) {
  await run(STORE_DEBT, 'readwrite', (s) => s.delete(id));
}

// ---- Investments (Req 19) -------------------------------------------------

/** @returns {Promise<import('../types.js').Investment[]>} */
export async function getAllInvestments() {
  try {
    const all = await run(STORE_INVEST, 'readonly', (s) => s.getAll());
    return Array.isArray(all) ? all.filter(isValidInvestment) : [];
  } catch {
    return []; // Safe fallback (Req 9.3)
  }
}

/** @param {import('../types.js').Investment} inv @returns {Promise<void>} */
export async function addInvestment(inv) {
  await run(STORE_INVEST, 'readwrite', (s) => s.put(inv));
}

/** @param {import('../types.js').Investment} inv @returns {Promise<void>} */
export async function updateInvestment(inv) {
  await run(STORE_INVEST, 'readwrite', (s) => s.put(inv));
}

/** @param {string} id @returns {Promise<void>} */
export async function deleteInvestment(id) {
  await run(STORE_INVEST, 'readwrite', (s) => s.delete(id));
}

// ---- Validation guards for corrupt records --------------------------------

/** @param {any} t @returns {t is Transaction} */
function isValidTransaction(t) {
  return (
    t &&
    typeof t.id === 'string' &&
    typeof t.amount === 'number' &&
    Number.isFinite(t.amount) &&
    (t.type === 'income' || t.type === 'expense') &&
    typeof t.categoryId === 'string' &&
    typeof t.date === 'string'
  );
}

/** @param {any} c @returns {c is Category} */
function isValidCategory(c) {
  return c && typeof c.id === 'string' && typeof c.name === 'string';
}

/** @param {any} w @returns {w is import('../types.js').Wallet} */
function isValidWallet(w) {
  return (
    w &&
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    typeof w.balance === 'number' &&
    Number.isFinite(w.balance)
  );
}

/** @param {any} b @returns {boolean} */
function isValidBudget(b) {
  return b && typeof b === 'object' && typeof b.id === 'string';
}

/** @param {any} a @returns {a is import('../types.js').Asset} */
function isValidAsset(a) {
  return (
    a &&
    typeof a.id === 'string' &&
    typeof a.name === 'string' &&
    typeof a.value === 'number' &&
    Number.isFinite(a.value) &&
    (a.assetClass === 'liquid' || a.assetClass === 'fixed')
  );
}

/** @param {any} d @returns {d is import('../types.js').Debt} */
function isValidDebt(d) {
  return (
    d &&
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.total === 'number' &&
    Number.isFinite(d.total) &&
    typeof d.paid === 'number' &&
    Number.isFinite(d.paid)
  );
}

/** @param {any} v @returns {v is import('../types.js').Investment} */
function isValidInvestment(v) {
  return (
    v &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.invested === 'number' &&
    Number.isFinite(v.invested) &&
    typeof v.currentValue === 'number' &&
    Number.isFinite(v.currentValue)
  );
}
