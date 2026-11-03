/**
 * Localization (Req 12). Two languages: Bahasa Indonesia (`id`, default) and
 * English (`en`). All UI strings live here. Views import the live `t` object
 * and read nested keys, e.g. `t.nav.beranda`; some values are functions for
 * interpolation, e.g. `t.wallet.deleteMsg(...)`.
 *
 * Language can be switched at runtime via `setLanguage('en'|'id')`, which
 * mutates the exported `t` object IN PLACE (so existing `import { t }`
 * references keep working) and updates the active locale. Views re-render
 * after a switch and pick up the new strings.
 *
 * Currency formatting is intentionally pinned to Indonesian grouping (see
 * format.js) so Rupiah always renders the same regardless of UI language.
 */

const LANG_LS_KEY = 'appLanguage';

/** Bahasa Indonesia dictionary. */
const ID = {
  app: {
    name: 'Pelacak Keuangan',
    loading: 'Memuat…',
    dismiss: 'Tutup',
    cancel: 'Batal',
    confirm: 'Konfirmasi',
    close: 'Tutup',
    save: 'Simpan',
    add: 'Tambah',
    delete: 'Hapus',
    edit: 'Ubah',
    back: 'Kembali',
    clear: 'Hapus filter',
    all: 'Semua',
    saved: 'Tersimpan',
    added: 'Ditambahkan',
    deleted: 'Dihapus',
  },

  nav: {
    beranda: 'Beranda',
    dompet: 'Dompet',
    transaksi: 'Transaksi',
    lainnya: 'Lainnya',
    tambah: 'Tambah',
  },

  header: {
    beranda: 'Beranda',
    dompet: 'Dompet',
    transaksi: 'Transaksi',
    lainnya: 'Lainnya',
    kategori: 'Kategori',
    budget: 'Atur Budget',
    aset: 'Aset',
    utang: 'Utang',
    investasi: 'Investasi',
    laporan: 'Laporan',
    pengaturan: 'Pengaturan',
  },

  settings: {
    theme: 'Tema',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    toggleThemeToLight: 'Beralih ke tema terang',
    toggleThemeToDark: 'Beralih ke tema gelap',
    language: 'Bahasa',
    toggleLanguage: 'Ganti bahasa',
    title: 'Pengaturan',
    appearance: 'Tampilan',
    appearanceDesc: 'Pilih tema terang atau gelap.',
    currency: 'Mata uang',
    currencyDesc: 'Pilih mata uang yang ditampilkan di seluruh aplikasi.',
  },

  beranda: {
    totalSaldo: 'Total Saldo',
    ringkasanBulan: 'Ringkasan Bulan Ini',
    comingSoon: 'Fitur lain akan hadir di sini.',
    sekilasHariIni: 'Sekilas Hari Ini',
    budgetHarianTersisa: 'budget harian yang tersisa',
    pemasukan: 'PEMASUKAN',
    pengeluaran: 'PENGELUARAN',
    budgetBelumDiatur: 'Atur budget untuk melihat sisa harian',
    greetPagi: 'Selamat pagi',
    greetSiang: 'Selamat siang',
    greetSore: 'Selamat sore',
    greetMalam: 'Selamat malam',
    calendarTitle: 'Kalender Pengeluaran',
    calendarHint: 'Warna lebih terang = pengeluaran lebih besar',
    recentTitle: 'Transaksi Terbaru',
    seeAll: 'Lihat semua',
    comparisonTitle: 'Perbandingan',
    vsLastMonth: 'vs bulan lalu',
    topExpensesTitle: 'Pengeluaran Terbesar',
    quickAccessTitle: 'Akses Cepat',
    noRecent: 'Belum ada transaksi.',
    groupNeeds: 'Kebutuhan',
    groupWants: 'Keinginan',
    groupSavings: 'Tabungan',
  },

  dompet: {
    placeholderTitle: 'Dompet akan hadir di tahap berikutnya.',
    placeholderHint: 'Kelola rekening bank, e-wallet, tunai, dan kartu kredit di sini.',
  },

  transfer: {
    title: 'Pindah Dana',
    button: 'Pindah Dana',
    from: 'Dari dompet',
    to: 'Ke dompet',
    amount: 'Jumlah',
    note: 'Catatan',
    selectWallet: 'Pilih dompet…',
    submit: 'Pindahkan',
    notePrefix: 'Transfer',
    done: 'Dana berhasil dipindahkan',
    invalid: 'Pilih dua dompet berbeda dan jumlah yang valid.',
    needTwo: 'Butuh minimal dua dompet untuk memindahkan dana.',
    hint: 'Pindah dana antar dompet. Ini tidak dihitung sebagai pemasukan atau pengeluaran.',
  },

  wallet: {
    defaultName: 'Tunai',
    totalSaldo: 'Total Saldo',
    hideBalance: 'Sembunyikan saldo',
    showBalance: 'Tampilkan saldo',
    hidden: '••••••',
    yourWallets: 'Dompet Anda',
    addTitle: 'Tambah Dompet',
    editTitle: 'Ubah Dompet',
    name: 'Nama',
    namePlaceholder: 'mis. BCA, GoPay, Dompet',
    type: 'Jenis',
    initialBalance: 'Saldo awal',
    accountNumber: 'Nomor rekening',
    accountNumberPlaceholder: 'mis. 1234567890 (opsional)',
    noAccountNumber: 'Belum ada nomor rekening',
    copy: 'Salin',
    copied: 'Tersalin!',
    owed: 'terutang',
    emptyTitle: 'Belum ada dompet.',
    emptyHint: 'Tambahkan rekening, e-wallet, atau tunai.',
    addButton: 'Tambah Dompet',
    selectWallet: 'Pilih dompet…',
    walletLabel: 'Dompet',
    nameRequired: 'Masukkan nama dompet.',
    balanceInvalid: 'Masukkan saldo yang valid.',
    deleteTitle: 'Hapus dompet?',
    deleteMsg: (name, n) =>
      n > 0
        ? `Hapus "${name}"? ${n} transaksi akan dipindahkan ke dompet utama.`
        : `Hapus "${name}"?`,
    cannotDeleteLast: 'Tidak bisa menghapus dompet terakhir.',
    primaryBadge: 'UTAMA',
    setPrimary: 'Jadikan Utama',
    actionsAria: 'Aksi dompet',
    dragHandle: 'Seret untuk mengurutkan',
    types: {
      bank: 'Bank',
      ewallet: 'E-Wallet',
      cash: 'Tunai',
      credit: 'Kartu Kredit',
    },
  },

  errors: {
    loadFailed: 'Gagal memuat data tersimpan; memulai dari awal.',
    txSaveFailed: 'Gagal menyimpan transaksi.',
    txUpdateFailed: 'Gagal memperbarui transaksi.',
    txDeleteFailed: 'Gagal menghapus transaksi.',
    categorySaveFailed: 'Gagal menyimpan kategori.',
    categoryDeleteFailed: 'Gagal menghapus kategori.',
    walletSaveFailed: 'Gagal menyimpan dompet.',
    walletUpdateFailed: 'Gagal memperbarui dompet.',
    walletDeleteFailed: 'Gagal menghapus dompet.',
    budgetSaveFailed: 'Gagal menyimpan budget.',
    assetSaveFailed: 'Gagal menyimpan aset.',
    assetUpdateFailed: 'Gagal memperbarui aset.',
    assetDeleteFailed: 'Gagal menghapus aset.',
    debtSaveFailed: 'Gagal menyimpan utang.',
    debtUpdateFailed: 'Gagal memperbarui utang.',
    debtDeleteFailed: 'Gagal menghapus utang.',
    investSaveFailed: 'Gagal menyimpan investasi.',
    investUpdateFailed: 'Gagal memperbarui investasi.',
    investDeleteFailed: 'Gagal menghapus investasi.',
  },

  laporan: {
    title: 'Laporan',
    month: 'Bulan',
    income: 'Pemasukan',
    expenses: 'Pengeluaran',
    netSavings: 'Tabungan Bersih',
    vsLastMonth: 'vs bulan lalu',
    na: '—',
    spendingByCategory: 'Pengeluaran per Kategori',
    topExpenses: 'Pengeluaran Terbesar',
    noExpenses: 'Belum ada pengeluaran bulan ini.',
    noData: 'Belum ada data untuk bulan ini.',
  },

  investasi: {
    title: 'Investasi',
    totalValue: 'Total Nilai Investasi',
    totalGain: 'Total Untung/Rugi',
    yourInvestments: 'Portofolio Anda',
    addButton: 'Tambah Investasi',
    addTitle: 'Tambah Investasi',
    editTitle: 'Ubah Investasi',
    name: 'Nama',
    namePlaceholder: 'mis. BBCA, Bitcoin, Reksadana X',
    type: 'Jenis',
    invested: 'Modal (dana investasi)',
    currentValue: 'Nilai sekarang (opsional)',
    currentValueHint: 'Kosongkan jika sama dengan modal.',
    gain: 'Untung',
    loss: 'Rugi',
    investedLabel: 'Modal',
    currentLabel: 'Nilai',
    nameRequired: 'Masukkan nama investasi.',
    investedInvalid: 'Masukkan modal yang valid.',
    currentInvalid: 'Masukkan nilai yang valid.',
    sourceWallet: 'Dari dompet',
    sourceWalletHint: 'Modal akan dikurangi dari saldo dompet ini.',
    sourceWalletNone: 'Jangan kurangi dompet',
    moveNote: 'Investasi:',
    addFunds: 'Tambah Dana',
    addFundsTitle: (name) => `Tambah Dana — ${name}`,
    addFundsAmount: 'Nominal tambahan',
    addFundsAmountInvalid: 'Masukkan nominal yang valid.',
    addFundsSubmit: 'Tambah Dana',
    emptyTitle: 'Belum ada investasi.',
    emptyHint: 'Tambahkan saham, reksadana, atau kripto untuk memantau performa.',
    deleteTitle: 'Hapus investasi?',
    deleteMsg: (name) => `Hapus "${name}"?`,
    types: {
      saham: 'Saham',
      reksadana: 'Reksadana',
      kripto: 'Kripto',
      lainnya: 'Lainnya',
    },
  },

  utang: {
    title: 'Utang',
    totalDebt: 'Total Utang',
    yourDebts: 'Daftar Utang',
    addButton: 'Tambah Utang',
    addTitle: 'Tambah Utang',
    editTitle: 'Ubah Utang',
    name: 'Nama',
    namePlaceholder: 'mis. KPR, Pinjaman teman',
    total: 'Total utang',
    paid: 'Sudah dibayar',
    dueDate: 'Jatuh tempo (opsional)',
    remaining: 'Sisa',
    remainingOf: (remaining, total) => `${remaining} dari ${total}`,
    due: (date) => `Jatuh tempo ${date}`,
    overdue: 'Terlambat',
    lunas: 'Lunas',
    nameRequired: 'Masukkan nama utang.',
    totalInvalid: 'Masukkan total utang yang valid.',
    emptyTitle: 'Belum ada utang.',
    emptyHint: 'Tambahkan utang untuk melacak sisa yang harus dibayar.',
    deleteTitle: 'Hapus utang?',
    deleteMsg: (name) => `Hapus "${name}"?`,
  },

  aset: {
    title: 'Aset',
    netWorth: 'Kekayaan Bersih',
    breakdown: 'Rincian',
    walletsTotal: 'Dompet & Akun',
    liquidTotal: 'Aset Likuid',
    fixedTotal: 'Aset Tetap',
    runway: 'Total Runway',
    runwayHint: 'Perkiraan berapa bulan aset likuid menutup pengeluaran',
    runwayMonths: (n) => `${n} bulan`,
    runwayNA: 'Belum bisa dihitung',
    yourAssets: 'Aset Manual Anda',
    addButton: 'Tambah Aset',
    addTitle: 'Tambah Aset',
    editTitle: 'Ubah Aset',
    name: 'Nama',
    namePlaceholder: 'mis. Emas, Rumah, Deposito',
    class: 'Jenis',
    classLiquid: 'Aset Likuid',
    classFixed: 'Aset Tetap',
    value: 'Nilai saat ini',
    nameRequired: 'Masukkan nama aset.',
    valueInvalid: 'Masukkan nilai yang valid.',
    emptyTitle: 'Belum ada aset manual.',
    emptyHint: 'Tambahkan aset likuid (mis. emas) atau tetap (mis. properti).',
    deleteTitle: 'Hapus aset?',
    deleteMsg: (name) => `Hapus "${name}"?`,
  },

  budget: {
    title: 'Atur Budget',
    monthlyIncome: 'Pemasukan bulanan',
    monthlyIncomeHint: 'Perkiraan pemasukan Anda tiap bulan',
    method: 'Metode',
    methodPercentage: 'Persentase',
    methodFixed: 'Nominal Tetap',
    needs: 'Kebutuhan',
    wants: 'Keinginan',
    savings: 'Tabungan',
    groupsTitle: 'Alokasi 50/30/20',
    mustTotal100: 'Total persentase harus 100%.',
    total: (n) => `Total: ${n}%`,
    assignTitle: 'Kelompok Kategori',
    assignHint: 'Tetapkan tiap kategori ke salah satu kelompok.',
    noGroup: 'Belum diatur',
    progressTitle: 'Progres Budget Bulan Ini',
    noBudgetTitle: 'Budget belum diatur.',
    noBudgetHint: 'Atur pemasukan bulanan dan alokasi untuk mulai.',
    spentOf: (spent, limit) => `${spent} dari ${limit}`,
    overBudget: 'Melebihi budget',
    perCategoryFixed: 'Budget per Kategori',
    perCategoryFixedHint: 'Tetapkan nominal budget untuk tiap kategori.',
    amount: 'Nominal',
    saved: 'Tersimpan',
  },

  dashboard: {
    month: 'Bulan',
    income: 'Pemasukan',
    expenses: 'Pengeluaran',
    net: 'Saldo Bersih',
    netForMonth: (month) => `Saldo Bersih — ${month}`,
    spendingByCategory: 'Pengeluaran per Kategori',
  },

  chart: {
    spent: 'Terpakai',
    noExpenses: 'Belum ada pengeluaran bulan ini.',
    ariaLabel: 'Pengeluaran per kategori',
  },

  tx: {
    addTitle: 'Tambah Transaksi',
    editTitle: 'Ubah Transaksi',
    type: 'Jenis',
    expense: 'Pengeluaran',
    income: 'Pemasukan',
    amount: 'Jumlah',
    amountPlaceholder: '0',
    category: 'Kategori',
    selectCategory: 'Pilih kategori…',
    date: 'Tanggal',
    note: 'Catatan',
    notePlaceholder: 'Catatan (opsional)',
    photo: 'Foto struk (opsional)',
    takePhoto: 'Ambil Foto',
    choosePhoto: 'Pilih File',
    removePhoto: 'Hapus foto',
    viewPhoto: 'Lihat foto struk',
    closePhoto: 'Tutup',
    filterMonth: 'Bulan',
    filterCategory: 'Kategori',
    filterCategoryAria: 'Saring berdasarkan kategori',
    allCategories: 'Semua kategori',
    count: (n, month) => `${n} transaksi — ${month}`,
    emptyTitle: 'Tidak ada transaksi yang cocok.',
    emptyHint: 'Ketuk + untuk menambah.',
    editAria: 'Ubah transaksi',
    deleteAria: 'Hapus transaksi',
    deleteTitle: 'Hapus transaksi?',
    deleteMsg: (typeLabel, amount, category) =>
      `Hapus ${typeLabel} sebesar ${amount} pada ${category}? Tindakan ini tidak dapat dibatalkan.`,
    today: 'Hari Ini',
    yesterday: 'Kemarin',
    searchPlaceholder: 'Cari catatan…',
    searchAria: 'Cari transaksi',
    filterButton: 'Filter',
    filterTitle: 'Filter Transaksi',
    dateFrom: 'Dari tanggal',
    dateTo: 'Sampai tanggal',
    filterWallet: 'Dompet',
    filterType: 'Jenis',
    allWallets: 'Semua dompet',
    allTypes: 'Semua jenis',
    applyFilters: 'Terapkan',
    resetFilters: 'Atur ulang',
    activeFilters: (n) => `${n} filter aktif`,
    resultCount: (n) => `${n} transaksi`,
  },

  validation: {
    amountRequired: 'Masukkan jumlah.',
    amountPositive: 'Jumlah harus berupa angka positif.',
    typeRequired: 'Pilih pemasukan atau pengeluaran.',
    categoryRequired: 'Pilih kategori.',
    categoryInvalid: 'Pilih kategori yang valid.',
    dateInvalid: 'Masukkan tanggal yang valid.',
  },

  category: {
    title: 'Kategori',
    addLabel: 'Tambah kategori',
    newNamePlaceholder: 'Nama kategori baru',
    newNameAria: 'Nama kategori baru',
    yourCategories: 'Kategori Anda',
    defaultBadge: 'Bawaan',
    excludedBadge: 'Dikecualikan',
    emptyKind: 'Belum ada kategori.',
    dragHandle: 'Seret untuk mengurutkan',
    deleteAria: (name) => `Hapus ${name}`,
    excludeFromBeranda: 'Kecualikan dari Beranda & Laporan',
    excludeHint: 'Transaksi di kategori ini tidak dihitung di Beranda maupun Laporan (ringkasan, Sekilas, kalender, grafik), tapi tetap muncul di Transaksi dan tetap memengaruhi saldo dompet. Cocok untuk kategori pindah dana.',
    excludeAriaOn: (name) => `${name}: sekarang dikecualikan dari Beranda & Laporan. Ketuk untuk menghitung lagi.`,
    excludeAriaOff: (name) => `${name}: sekarang dihitung di Beranda & Laporan. Ketuk untuk mengecualikan.`,
    nameRequired: 'Masukkan nama kategori.',
    duplicate: 'Kategori itu sudah ada.',
    deleteTitle: 'Hapus kategori?',
    deleteMsgInUse: (name, n) =>
      `"${name}" dipakai oleh ${n} transaksi. Transaksi tersebut tetap menyimpan kategorinya, tetapi Anda tidak dapat memilihnya lagi. Tetap hapus?`,
    deleteMsgSimple: (name) => `Hapus "${name}"?`,
    unknown: 'Tak diketahui',
  },

  lainnya: {
    title: 'Lainnya',
    subtitle: 'Fitur dan pengaturan lainnya.',
    budget: 'Atur Budget',
    aset: 'Aset',
    utang: 'Utang',
    investasi: 'Investasi',
    laporan: 'Laporan',
    kategori: 'Kelola Kategori',
    pengaturan: 'Pengaturan',
    soon: 'Segera hadir',
  },

  defaultCategories: {
    food: 'Makanan',
    transport: 'Transportasi',
    rent: 'Sewa',
    bills: 'Tagihan',
    shopping: 'Belanja',
    entertainment: 'Hiburan',
    other: 'Lainnya',
    income: 'Pemasukan',
    gaji: 'Gaji',
    'uang-jajan': 'Uang Jajan',
    reimburse: 'Reimburse',
    bonus: 'Bonus',
    hadiah: 'Hadiah',
  },
};

/** English dictionary (mirrors the ID structure exactly). */
const EN = {
  app: {
    name: 'Finance Tracker',
    loading: 'Loading…',
    dismiss: 'Dismiss',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    save: 'Save',
    add: 'Add',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    clear: 'Clear filters',
    all: 'All',
    saved: 'Saved',
    added: 'Added',
    deleted: 'Deleted',
  },

  nav: {
    beranda: 'Home',
    dompet: 'Wallets',
    transaksi: 'Transactions',
    lainnya: 'More',
    tambah: 'Add',
  },

  header: {
    beranda: 'Home',
    dompet: 'Wallets',
    transaksi: 'Transactions',
    lainnya: 'More',
    kategori: 'Categories',
    budget: 'Budget',
    aset: 'Assets',
    utang: 'Debts',
    investasi: 'Investments',
    laporan: 'Reports',
    pengaturan: 'Settings',
  },

  settings: {
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    toggleThemeToLight: 'Switch to light theme',
    toggleThemeToDark: 'Switch to dark theme',
    language: 'Language',
    toggleLanguage: 'Change language',
    title: 'Settings',
    appearance: 'Appearance',
    appearanceDesc: 'Choose a light or dark theme.',
    currency: 'Currency',
    currencyDesc: 'Choose the currency shown throughout the app.',
  },

  beranda: {
    totalSaldo: 'Total Balance',
    ringkasanBulan: 'This Month’s Summary',
    comingSoon: 'More features coming soon.',
    sekilasHariIni: 'Today at a Glance',
    budgetHarianTersisa: 'daily budget remaining',
    pemasukan: 'INCOME',
    pengeluaran: 'EXPENSES',
    budgetBelumDiatur: 'Set a budget to see your daily remaining',
    greetPagi: 'Good morning',
    greetSiang: 'Good afternoon',
    greetSore: 'Good evening',
    greetMalam: 'Good night',
    calendarTitle: 'Expense Calendar',
    calendarHint: 'Brighter color = bigger spending',
    recentTitle: 'Recent Transactions',
    seeAll: 'See all',
    comparisonTitle: 'Comparison',
    vsLastMonth: 'vs last month',
    topExpensesTitle: 'Top Expenses',
    quickAccessTitle: 'Quick Access',
    noRecent: 'No transactions yet.',
    groupNeeds: 'Needs',
    groupWants: 'Wants',
    groupSavings: 'Savings',
  },

  dompet: {
    placeholderTitle: 'Wallets are coming in the next phase.',
    placeholderHint: 'Manage bank accounts, e-wallets, cash, and credit cards here.',
  },

  transfer: {
    title: 'Transfer Funds',
    button: 'Transfer',
    from: 'From wallet',
    to: 'To wallet',
    amount: 'Amount',
    note: 'Note',
    selectWallet: 'Select a wallet…',
    submit: 'Transfer',
    notePrefix: 'Transfer',
    done: 'Funds transferred',
    invalid: 'Pick two different wallets and a valid amount.',
    needTwo: 'You need at least two wallets to transfer funds.',
    hint: 'Move money between wallets. This is not counted as income or an expense.',
  },

  wallet: {
    defaultName: 'Cash',
    totalSaldo: 'Total Balance',
    hideBalance: 'Hide balance',
    showBalance: 'Show balance',
    hidden: '••••••',
    yourWallets: 'Your Wallets',
    addTitle: 'Add Wallet',
    editTitle: 'Edit Wallet',
    name: 'Name',
    namePlaceholder: 'e.g. BCA, GoPay, Wallet',
    type: 'Type',
    initialBalance: 'Initial balance',
    accountNumber: 'Account number',
    accountNumberPlaceholder: 'e.g. 1234567890 (optional)',
    noAccountNumber: 'No account number yet',
    copy: 'Copy',
    copied: 'Copied!',
    owed: 'owed',
    emptyTitle: 'No wallets yet.',
    emptyHint: 'Add an account, e-wallet, or cash.',
    addButton: 'Add Wallet',
    selectWallet: 'Select a wallet…',
    walletLabel: 'Wallet',
    nameRequired: 'Enter a wallet name.',
    balanceInvalid: 'Enter a valid balance.',
    deleteTitle: 'Delete wallet?',
    deleteMsg: (name, n) =>
      n > 0
        ? `Delete "${name}"? ${n} transaction(s) will be moved to the primary wallet.`
        : `Delete "${name}"?`,
    cannotDeleteLast: 'You can’t delete the last wallet.',
    primaryBadge: 'PRIMARY',
    setPrimary: 'Set as Primary',
    actionsAria: 'Wallet actions',
    dragHandle: 'Drag to reorder',
    types: {
      bank: 'Bank',
      ewallet: 'E-Wallet',
      cash: 'Cash',
      credit: 'Credit Card',
    },
  },

  errors: {
    loadFailed: 'Failed to load saved data; starting fresh.',
    txSaveFailed: 'Failed to save transaction.',
    txUpdateFailed: 'Failed to update transaction.',
    txDeleteFailed: 'Failed to delete transaction.',
    categorySaveFailed: 'Failed to save category.',
    categoryDeleteFailed: 'Failed to delete category.',
    walletSaveFailed: 'Failed to save wallet.',
    walletUpdateFailed: 'Failed to update wallet.',
    walletDeleteFailed: 'Failed to delete wallet.',
    budgetSaveFailed: 'Failed to save budget.',
    assetSaveFailed: 'Failed to save asset.',
    assetUpdateFailed: 'Failed to update asset.',
    assetDeleteFailed: 'Failed to delete asset.',
    debtSaveFailed: 'Failed to save debt.',
    debtUpdateFailed: 'Failed to update debt.',
    debtDeleteFailed: 'Failed to delete debt.',
    investSaveFailed: 'Failed to save investment.',
    investUpdateFailed: 'Failed to update investment.',
    investDeleteFailed: 'Failed to delete investment.',
  },

  laporan: {
    title: 'Reports',
    month: 'Month',
    income: 'Income',
    expenses: 'Expenses',
    netSavings: 'Net Savings',
    vsLastMonth: 'vs last month',
    na: '—',
    spendingByCategory: 'Spending by Category',
    topExpenses: 'Top Expenses',
    noExpenses: 'No expenses this month yet.',
    noData: 'No data for this month yet.',
  },

  investasi: {
    title: 'Investments',
    totalValue: 'Total Investment Value',
    totalGain: 'Total Gain/Loss',
    yourInvestments: 'Your Portfolio',
    addButton: 'Add Investment',
    addTitle: 'Add Investment',
    editTitle: 'Edit Investment',
    name: 'Name',
    namePlaceholder: 'e.g. BBCA, Bitcoin, Mutual Fund X',
    type: 'Type',
    invested: 'Principal (invested amount)',
    currentValue: 'Current value (optional)',
    currentValueHint: 'Leave blank if same as principal.',
    gain: 'Gain',
    loss: 'Loss',
    investedLabel: 'Principal',
    currentLabel: 'Value',
    nameRequired: 'Enter an investment name.',
    investedInvalid: 'Enter a valid principal.',
    currentInvalid: 'Enter a valid value.',
    sourceWallet: 'From wallet',
    sourceWalletHint: 'The principal will be deducted from this wallet’s balance.',
    sourceWalletNone: 'Don’t deduct a wallet',
    moveNote: 'Investment:',
    addFunds: 'Add Funds',
    addFundsTitle: (name) => `Add Funds — ${name}`,
    addFundsAmount: 'Additional amount',
    addFundsAmountInvalid: 'Enter a valid amount.',
    addFundsSubmit: 'Add Funds',
    emptyTitle: 'No investments yet.',
    emptyHint: 'Add stocks, mutual funds, or crypto to track performance.',
    deleteTitle: 'Delete investment?',
    deleteMsg: (name) => `Delete "${name}"?`,
    types: {
      saham: 'Stocks',
      reksadana: 'Mutual Fund',
      kripto: 'Crypto',
      lainnya: 'Other',
    },
  },

  utang: {
    title: 'Debts',
    totalDebt: 'Total Debt',
    yourDebts: 'Debt List',
    addButton: 'Add Debt',
    addTitle: 'Add Debt',
    editTitle: 'Edit Debt',
    name: 'Name',
    namePlaceholder: 'e.g. Mortgage, Loan from friend',
    total: 'Total debt',
    paid: 'Paid so far',
    dueDate: 'Due date (optional)',
    remaining: 'Remaining',
    remainingOf: (remaining, total) => `${remaining} of ${total}`,
    due: (date) => `Due ${date}`,
    overdue: 'Overdue',
    lunas: 'Paid off',
    nameRequired: 'Enter a debt name.',
    totalInvalid: 'Enter a valid total debt.',
    emptyTitle: 'No debts yet.',
    emptyHint: 'Add a debt to track the remaining balance.',
    deleteTitle: 'Delete debt?',
    deleteMsg: (name) => `Delete "${name}"?`,
  },

  aset: {
    title: 'Assets',
    netWorth: 'Net Worth',
    breakdown: 'Breakdown',
    walletsTotal: 'Wallets & Accounts',
    liquidTotal: 'Liquid Assets',
    fixedTotal: 'Fixed Assets',
    runway: 'Total Runway',
    runwayHint: 'Estimated months your liquid assets cover expenses',
    runwayMonths: (n) => `${n} month(s)`,
    runwayNA: 'Not calculable yet',
    yourAssets: 'Your Manual Assets',
    addButton: 'Add Asset',
    addTitle: 'Add Asset',
    editTitle: 'Edit Asset',
    name: 'Name',
    namePlaceholder: 'e.g. Gold, House, Deposit',
    class: 'Type',
    classLiquid: 'Liquid Asset',
    classFixed: 'Fixed Asset',
    value: 'Current value',
    nameRequired: 'Enter an asset name.',
    valueInvalid: 'Enter a valid value.',
    emptyTitle: 'No manual assets yet.',
    emptyHint: 'Add a liquid asset (e.g. gold) or a fixed one (e.g. property).',
    deleteTitle: 'Delete asset?',
    deleteMsg: (name) => `Delete "${name}"?`,
  },

  budget: {
    title: 'Budget',
    monthlyIncome: 'Monthly income',
    monthlyIncomeHint: 'Your estimated income each month',
    method: 'Method',
    methodPercentage: 'Percentage',
    methodFixed: 'Fixed Amount',
    needs: 'Needs',
    wants: 'Wants',
    savings: 'Savings',
    groupsTitle: '50/30/20 Allocation',
    mustTotal100: 'Percentages must total 100%.',
    total: (n) => `Total: ${n}%`,
    assignTitle: 'Category Groups',
    assignHint: 'Assign each category to one group.',
    noGroup: 'Not set',
    progressTitle: 'This Month’s Budget Progress',
    noBudgetTitle: 'No budget set.',
    noBudgetHint: 'Set your monthly income and allocation to start.',
    spentOf: (spent, limit) => `${spent} of ${limit}`,
    overBudget: 'Over budget',
    perCategoryFixed: 'Budget per Category',
    perCategoryFixedHint: 'Set a budget amount for each category.',
    amount: 'Amount',
    saved: 'Saved',
  },

  dashboard: {
    month: 'Month',
    income: 'Income',
    expenses: 'Expenses',
    net: 'Net Balance',
    netForMonth: (month) => `Net Balance — ${month}`,
    spendingByCategory: 'Spending by Category',
  },

  chart: {
    spent: 'Spent',
    noExpenses: 'No expenses this month yet.',
    ariaLabel: 'Spending by category',
  },

  tx: {
    addTitle: 'Add Transaction',
    editTitle: 'Edit Transaction',
    type: 'Type',
    expense: 'Expense',
    income: 'Income',
    amount: 'Amount',
    amountPlaceholder: '0',
    category: 'Category',
    selectCategory: 'Select a category…',
    date: 'Date',
    note: 'Note',
    notePlaceholder: 'Note (optional)',
    photo: 'Receipt photo (optional)',
    takePhoto: 'Take Photo',
    choosePhoto: 'Choose File',
    removePhoto: 'Remove photo',
    viewPhoto: 'View receipt photo',
    closePhoto: 'Close',
    filterMonth: 'Month',
    filterCategory: 'Category',
    filterCategoryAria: 'Filter by category',
    allCategories: 'All categories',
    count: (n, month) => `${n} transactions — ${month}`,
    emptyTitle: 'No matching transactions.',
    emptyHint: 'Tap + to add one.',
    editAria: 'Edit transaction',
    deleteAria: 'Delete transaction',
    deleteTitle: 'Delete transaction?',
    deleteMsg: (typeLabel, amount, category) =>
      `Delete ${typeLabel} of ${amount} in ${category}? This action can’t be undone.`,
    today: 'Today',
    yesterday: 'Yesterday',
    searchPlaceholder: 'Search notes…',
    searchAria: 'Search transactions',
    filterButton: 'Filter',
    filterTitle: 'Filter Transactions',
    dateFrom: 'From date',
    dateTo: 'To date',
    filterWallet: 'Wallet',
    filterType: 'Type',
    allWallets: 'All wallets',
    allTypes: 'All types',
    applyFilters: 'Apply',
    resetFilters: 'Reset',
    activeFilters: (n) => `${n} active filter(s)`,
    resultCount: (n) => `${n} transactions`,
  },

  validation: {
    amountRequired: 'Enter an amount.',
    amountPositive: 'Amount must be a positive number.',
    typeRequired: 'Choose income or expense.',
    categoryRequired: 'Choose a category.',
    categoryInvalid: 'Choose a valid category.',
    dateInvalid: 'Enter a valid date.',
  },

  category: {
    title: 'Categories',
    addLabel: 'Add category',
    newNamePlaceholder: 'New category name',
    newNameAria: 'New category name',
    yourCategories: 'Your Categories',
    defaultBadge: 'Default',
    excludedBadge: 'Excluded',
    emptyKind: 'No categories yet.',
    dragHandle: 'Drag to reorder',
    deleteAria: (name) => `Delete ${name}`,
    excludeFromBeranda: 'Exclude from Home & Reports',
    excludeHint: 'Transactions in this category aren’t counted on Home or Reports (summary, glance, calendar, chart), but still appear in Transactions and still affect wallet balances. Good for money-transfer categories.',
    excludeAriaOn: (name) => `${name}: now excluded from Home & Reports. Tap to count it again.`,
    excludeAriaOff: (name) => `${name}: now counted on Home & Reports. Tap to exclude it.`,
    nameRequired: 'Enter a category name.',
    duplicate: 'That category already exists.',
    deleteTitle: 'Delete category?',
    deleteMsgInUse: (name, n) =>
      `"${name}" is used by ${n} transaction(s). Those keep their category, but you won’t be able to pick it again. Delete anyway?`,
    deleteMsgSimple: (name) => `Delete "${name}"?`,
    unknown: 'Unknown',
  },

  lainnya: {
    title: 'More',
    subtitle: 'Other features and settings.',
    budget: 'Budget',
    aset: 'Assets',
    utang: 'Debts',
    investasi: 'Investments',
    laporan: 'Reports',
    kategori: 'Manage Categories',
    pengaturan: 'Settings',
    soon: 'Coming soon',
  },

  defaultCategories: {
    food: 'Food',
    transport: 'Transport',
    rent: 'Rent',
    bills: 'Bills',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    other: 'Other',
    income: 'Income',
    gaji: 'Salary',
    'uang-jajan': 'Allowance',
    reimburse: 'Reimbursement',
    bonus: 'Bonus',
    hadiah: 'Gift',
  },
};

/** Dictionaries by language code. */
const DICTS = { id: ID, en: EN };

/** Date-formatting locale per language. Currency stays id-ID (see format.js). */
const LOCALES = { id: 'id-ID', en: 'en-US' };

/** Read the persisted language, defaulting to Indonesian. */
function initialLang() {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(LANG_LS_KEY);
      if (v === 'en' || v === 'id') return v;
    }
  } catch {
    /* ignore */
  }
  return 'id';
}

/** Current language code ('id' | 'en'). */
export let currentLang = initialLang();

/**
 * Active date-formatting locale (BCP-47). Use `getLocale()` so consumers always
 * read the current value after a language switch (an imported binding would be
 * stale). Currency formatting is pinned separately in format.js.
 * @returns {string}
 */
export function getLocale() {
  return LOCALES[currentLang] || 'id-ID';
}

/**
 * The live translations object. Views import this and read keys at render time.
 * It is MUTATED in place by setLanguage so existing imports stay valid.
 * @type {typeof ID}
 */
export const t = /** @type {any} */ ({});

/** Copy all keys of `src` onto `t`, replacing existing ones. */
function applyDict(src) {
  for (const k of Object.keys(t)) delete (/** @type {any} */ (t)[k]);
  for (const k of Object.keys(src)) (/** @type {any} */ (t)[k]) = (/** @type {any} */ (src)[k]);
}

/**
 * Switch the UI language. Mutates `t` in place and persists the choice.
 * Callers should re-render afterwards (main.js does on store/toggle).
 * @param {'id'|'en'} lang
 */
export function setLanguage(lang) {
  if (lang !== 'id' && lang !== 'en') return;
  currentLang = lang;
  applyDict(DICTS[lang]);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_LS_KEY, lang);
  } catch {
    /* ignore */
  }
}

// Initialize `t` with the persisted (or default) language on module load.
applyDict(DICTS[currentLang]);

/**
 * Convenience: map a transaction type to its localized label.
 * @param {'income'|'expense'} type
 * @returns {string}
 */
export function typeLabel(type) {
  return type === 'income' ? t.tx.income : t.tx.expense;
}
