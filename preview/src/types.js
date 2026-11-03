// @ts-check
// Data model type definitions (JSDoc typedefs — no runtime code).
// Amounts are stored as positive numbers; `type` conveys income vs expense.

/**
 * @typedef {'income' | 'expense'} TxType
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id           - uuid
 * @property {number} amount       - positive number
 * @property {TxType} type         - 'income' | 'expense'
 * @property {string} categoryId   - FK -> Category.id
 * @property {string} date         - ISO 'YYYY-MM-DD' (local date, no time)
 * @property {string} [note]       - optional free text
 * @property {number} createdAt    - epoch ms, stable tiebreak for ordering
 * @property {string} [walletId]   - FK -> Wallet.id (source/destination wallet)
 * @property {string} [photo]      - optional receipt photo as a data URL (JPEG)
 */

/**
 * @typedef {'bank' | 'ewallet' | 'cash' | 'credit'} WalletType
 */

/**
 * @typedef {Object} Wallet
 * @property {string} id             - uuid; default cash wallet uses 'tunai'
 * @property {string} name           - display name
 * @property {WalletType} type       - bank | ewallet | cash | credit
 * @property {number} balance        - INITIAL balance; displayed saldo is derived
 *                                      (initial + income − expenses). May be
 *                                      negative for credit-card wallets.
 * @property {boolean} [isPrimary]   - the primary ("UTAMA") wallet; exactly one
 * @property {string} [accountNumber]- optional account/rekening number
 * @property {number} [order]        - manual sort position (ascending) in Dompet list
 * @property {number} createdAt      - epoch ms
 */

/**
 * @typedef {'needs' | 'wants' | 'savings'} BudgetGroup
 */

/**
 * @typedef {Object} Category
 * @property {string} id             - uuid; defaults use stable slugs e.g. 'food'
 * @property {string} name           - display name, unique case-insensitive
 * @property {boolean} isDefault     - whether this is a seeded default category
 * @property {TxType} [kind]         - 'income' | 'expense' — which transaction type it applies to
 * @property {BudgetGroup} [budgetGroup] - budget group assignment (Kebutuhan/Keinginan/Tabungan)
 * @property {number} [order]        - manual sort position within its kind (ascending)
 * @property {boolean} [excludeFromBeranda] - when true, transactions in this
 *                                      category are excluded from Beranda
 *                                      tracking (money-move categories). They
 *                                      still show in Transaksi and still affect
 *                                      wallet balances.
 */

/**
 * @typedef {'percentage' | 'fixed'} BudgetMethod
 */

/**
 * @typedef {Object} BudgetSettings
 * @property {string} id             - singleton key
 * @property {number} monthlyIncome  - expected monthly income (Rupiah)
 * @property {BudgetMethod} method   - 'percentage' | 'fixed'
 * @property {{needs:number, wants:number, savings:number}} groups - percentages summing to 100
 * @property {Record<string, number>} fixedByCategory - categoryId -> Rupiah budget (fixed method)
 * @property {Record<string, number>} [groupCategoryAmounts] - categoryId -> Rupiah override (percentage method)
 */

/**
 * @typedef {'liquid' | 'fixed'} AssetClass
 */

/**
 * @typedef {Object} Asset
 * @property {string} id             - uuid
 * @property {string} name           - display name
 * @property {AssetClass} assetClass - 'liquid' (Aset Likuid) | 'fixed' (Aset Tetap)
 * @property {number} value          - current value (Rupiah)
 * @property {number} createdAt      - epoch ms
 */

/**
 * @typedef {Object} Debt
 * @property {string} id           - uuid
 * @property {string} name         - display name (e.g. "KPR", "Pinjaman teman")
 * @property {number} total        - total amount owed (Rupiah)
 * @property {number} paid         - amount paid so far (Rupiah)
 * @property {string} [dueDate]    - optional ISO 'YYYY-MM-DD' due date (jatuh tempo)
 * @property {number} createdAt    - epoch ms
 */

/**
 * @typedef {'saham' | 'reksadana' | 'kripto' | 'lainnya'} InvestmentType
 */

/**
 * @typedef {Object} Investment
 * @property {string} id             - uuid
 * @property {string} name           - display name (e.g. "BBCA", "Bitcoin")
 * @property {InvestmentType} invType - saham | reksadana | kripto | lainnya
 * @property {number} invested       - amount invested / modal (Rupiah)
 * @property {number} currentValue   - current value / nilai sekarang (Rupiah)
 * @property {number} createdAt      - epoch ms
 */

/**
 * @typedef {Object} MonthlySummary
 * @property {string} month        - 'YYYY-MM'
 * @property {number} totalIncome
 * @property {number} totalExpenses
 * @property {number} net          - income - expenses
 */

/**
 * @typedef {Object} CategorySpend
 * @property {string} categoryId
 * @property {string} categoryName
 * @property {number} total        - expense total for the month
 */

export {};
