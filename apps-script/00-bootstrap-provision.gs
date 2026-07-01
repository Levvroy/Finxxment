/**
 * One-time (idempotent) provisioning of every finxxment sheet: headers, frozen/bold header
 * rows, dropdown validation, and formula columns. Run manually from the Apps Script editor
 * (select provisionFinxxmentSheets and click Run), authorize when prompted, then re-run any
 * time you want to add a sheet you're missing — existing sheets/data are left untouched.
 *
 * Keep CATEGORIES and SUMBER_DANA below in sync with config/categories.json and
 * config/sumber-dana.json (Apps Script cannot read repo files at runtime) — see
 * docs/03-category-sumber-dana-config.md.
 */

const CATEGORIES = [
  'Makan & Minum', 'Transportasi', 'Kos/Tempat Tinggal', 'Kuliah/Akademik',
  'Produksi/Event', 'Peralatan', 'Hiburan/Hobi', 'Kopi/Espresso Setup',
  'Kesehatan', 'Belanja Pribadi', 'Transfer/Pinjam', 'Tabungan/Investasi', 'Lain-lain'
];

const SUMBER_DANA = ['Cash', 'QRIS', 'Debit', 'E-wallet', 'Transfer Bank', 'Kredit'];

const TRANSAKSI_HEADERS = [
  'ID', 'Timestamp Input', 'Tanggal Transaksi', 'Jenis', 'Nominal', 'Kategori',
  'Sub-kategori', 'Tujuan/Merchant', 'Sumber Dana', 'Nama Rekening/Wallet', 'Catatan',
  'Bukti (link)', 'Status Verifikasi', 'Confidence AI', 'Sumber Input', 'Tag Bulan', 'Tag Minggu'
];

const PENDING_HEADERS = [
  'Chat ID', 'Pending ID', 'Created At', 'Type', 'Raw Payload', 'Question Asked',
  'Status', 'Retry Count', 'Expires At'
];

const SALDO_AWAL_HEADERS = ['Sumber Dana', 'Nama Rekening/Wallet', 'Saldo Awal'];

const BUDGET_HEADERS = ['Kategori', 'Budget Bulanan'];

const LOG_ERROR_HEADERS = [
  'Timestamp', 'Chat ID', 'Workflow/Node', 'Error Type', 'Raw Payload', 'Resolved'
];

const HUTANG_PIUTANG_HEADERS = [
  'ID', 'Tanggal', 'Arah', 'Nama Pihak', 'Nominal', 'Jatuh Tempo', 'Status', 'Catatan'
];

const GOALS_HEADERS = [
  'Nama Goal', 'Target Nominal', 'Tanggal Target', 'Sumber Dana', 'Nominal Terkumpul', 'Progress %', 'Status'
];

const PROVISION_MARKER_KEY = 'finxxment_provisioned_version';
const PROVISION_VERSION = '2';

function provisionFinxxmentSheets() {
  const ss = SpreadsheetApp.getActive();

  ensureSheetWithHeaders_(ss, 'Transaksi', TRANSAKSI_HEADERS);
  ensureSheetWithHeaders_(ss, 'Pending Transaksi', PENDING_HEADERS);
  ensureSheetWithHeaders_(ss, 'Saldo Awal', SALDO_AWAL_HEADERS);
  ensureSheetWithHeaders_(ss, 'Budget', BUDGET_HEADERS);
  ensureSheetWithHeaders_(ss, 'Log Error', LOG_ERROR_HEADERS);
  ensureSheetWithHeaders_(ss, 'Hutang Piutang', HUTANG_PIUTANG_HEADERS);
  ensureSheetWithHeaders_(ss, 'Tabungan Goals', GOALS_HEADERS);
  ensureSheetWithHeaders_(ss, 'Dashboard', []);

  applyTransaksiValidationAndFormulas_(ss.getSheetByName('Transaksi'));
  applyHutangPiutangValidation_(ss.getSheetByName('Hutang Piutang'));
  applyGoalsFormulas_(ss.getSheetByName('Tabungan Goals'));
  seedSaldoAwal_(ss.getSheetByName('Saldo Awal'));
  seedBudget_(ss.getSheetByName('Budget'));

  PropertiesService.getDocumentProperties().setProperty(PROVISION_MARKER_KEY, PROVISION_VERSION);
  SpreadsheetApp.getUi().alert('finxxment: provisioning selesai. Sheets siap dipakai.');
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (headers.length === 0) return sheet;

  const existingHeaderRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every((h, i) => existingHeaderRow[i] === h);
  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function applyTransaksiValidationAndFormulas_(sheet) {
  const lastCol = TRANSAKSI_HEADERS.length;
  const numRows = 2000; // generous pre-provisioned range for dropdowns/formulas

  const jenisCol = TRANSAKSI_HEADERS.indexOf('Jenis') + 1;
  const kategoriCol = TRANSAKSI_HEADERS.indexOf('Kategori') + 1;
  const sumberDanaCol = TRANSAKSI_HEADERS.indexOf('Sumber Dana') + 1;
  const statusCol = TRANSAKSI_HEADERS.indexOf('Status Verifikasi') + 1;
  const tanggalCol = TRANSAKSI_HEADERS.indexOf('Tanggal Transaksi') + 1;
  const tagBulanCol = TRANSAKSI_HEADERS.indexOf('Tag Bulan') + 1;
  const tagMingguCol = TRANSAKSI_HEADERS.indexOf('Tag Minggu') + 1;

  setDropdown_(sheet, jenisCol, numRows, ['Keluar', 'Masuk']);
  setDropdown_(sheet, kategoriCol, numRows, CATEGORIES);
  setDropdown_(sheet, sumberDanaCol, numRows, SUMBER_DANA);
  setDropdown_(sheet, statusCol, numRows, ['Verified', 'Unverified', 'Mismatch-Resolved', 'Perlu Review Manual']);

  // ARRAYFORMULA in the header's row-2 cell auto-expands down the column as rows are appended.
  const tanggalColLetter = columnToLetter_(tanggalCol);
  sheet.getRange(2, tagBulanCol).setFormula(
    '=ARRAYFORMULA(IF(' + tanggalColLetter + '2:' + tanggalColLetter + '="","",' +
    'TEXT(' + tanggalColLetter + '2:' + tanggalColLetter + ',"YYYY-MM")))'
  );
  sheet.getRange(2, tagMingguCol).setFormula(
    '=ARRAYFORMULA(IF(' + tanggalColLetter + '2:' + tanggalColLetter + '="","",' +
    'WEEKNUM(' + tanggalColLetter + '2:' + tanggalColLetter + ')))'
  );
}

function applyHutangPiutangValidation_(sheet) {
  const numRows = 500;
  const arahCol = HUTANG_PIUTANG_HEADERS.indexOf('Arah') + 1;
  const statusCol = HUTANG_PIUTANG_HEADERS.indexOf('Status') + 1;
  setDropdown_(sheet, arahCol, numRows, ['Piutang', 'Utang']);
  setDropdown_(sheet, statusCol, numRows, ['Belum Lunas', 'Lunas']);
}

function applyGoalsFormulas_(sheet) {
  const numRows = 200;
  const namaCol = GOALS_HEADERS.indexOf('Nama Goal') + 1;
  const targetCol = GOALS_HEADERS.indexOf('Target Nominal') + 1;
  const terkumpulCol = GOALS_HEADERS.indexOf('Nominal Terkumpul') + 1;
  const progressCol = GOALS_HEADERS.indexOf('Progress %') + 1;
  const statusCol = GOALS_HEADERS.indexOf('Status') + 1;

  const namaLetter = columnToLetter_(namaCol);
  const targetLetter = columnToLetter_(targetCol);
  const terkumpulLetter = columnToLetter_(terkumpulCol);

  // Terkumpul = sum of Transaksi rows where Kategori = "Tabungan/Investasi" and
  // Sub-kategori matches this goal's Nama Goal (the user picks a consistent goal name as the
  // sub-kategori when logging a contribution, e.g. "keluar 200000 nabung kamera" -> sub_kategori "kamera").
  sheet.getRange(2, terkumpulCol).setFormula(
    '=ARRAYFORMULA(IF(' + namaLetter + '2:' + namaLetter + '="","",' +
    'SUMIFS(Transaksi!E:E,Transaksi!G:G,' + namaLetter + '2:' + namaLetter + ',Transaksi!F:F,"Tabungan/Investasi")))'
  );
  sheet.getRange(2, progressCol).setFormula(
    '=ARRAYFORMULA(IF(' + namaLetter + '2:' + namaLetter + '="","",' +
    'IFERROR(ROUND(' + terkumpulLetter + '2:' + terkumpulLetter + '/' + targetLetter + '2:' + targetLetter + '*100,0),0)))'
  );
  setDropdown_(sheet, statusCol, numRows, ['Berjalan', 'Tercapai', 'Dibatalkan']);
}

function setDropdown_(sheet, col, numRows, values) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, numRows, 1).setDataValidation(rule);
}

function columnToLetter_(column) {
  let letter = '';
  while (column > 0) {
    const remainder = (column - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    column = Math.floor((column - remainder - 1) / 26);
  }
  return letter;
}

function seedSaldoAwal_(sheet) {
  if (sheet.getLastRow() > 1) return; // already seeded, don't duplicate
  const rows = SUMBER_DANA.map(function (s) { return [s, '', 0]; });
  sheet.getRange(2, 1, rows.length, SALDO_AWAL_HEADERS.length).setValues(rows);
}

function seedBudget_(sheet) {
  if (sheet.getLastRow() > 1) return;
  const rows = CATEGORIES.map(function (c) { return [c, '']; });
  sheet.getRange(2, 1, rows.length, BUDGET_HEADERS.length).setValues(rows);
}
