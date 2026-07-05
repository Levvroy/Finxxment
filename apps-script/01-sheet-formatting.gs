/**
 * Visual style for every finxxment sheet: colors, number formats, conditional formatting, and
 * per-sheet layout (column widths, banding, frozen columns/rows, tab colors, hidden helper
 * columns). Called once from provisionFinxxmentSheets() in 00-bootstrap-provision.gs - re-run
 * that function any time you want to re-apply the look (e.g. after resetting a sheet's
 * formatting by hand).
 *
 * Section-header backgrounds for the Dashboard's individual blocks (Saldo, Burn Rate, Budget
 * vs Actual, Hutang Piutang, Tabungan Goals) are set inline in the files that own those blocks
 * (20-saldo-burnrate.gs, 30-budget-vs-actual.gs, 50-hutang-piutang.gs, 60-savings-goals.gs)
 * since those functions rewrite that content on every refresh anyway - this file only handles
 * the one-time structural formatting (title banner, column widths, hidden columns, banding).
 */

// ---- Palette (kept centralized so every sheet reads consistently) ----
const FINX_COLOR_HEADER_BG = '#1F3864';
const FINX_COLOR_HEADER_TEXT = '#FFFFFF';
const FINX_COLOR_TITLE_BG = '#0B5345';
const FINX_COLOR_TITLE_TEXT = '#FFFFFF';
const FINX_COLOR_SUBTITLE_TEXT = '#666666';

const FINX_COLOR_SECTION_SALDO = '#D0E4F5';
const FINX_COLOR_SECTION_BURNRATE = '#FCE5CD';
const FINX_COLOR_SECTION_BUDGET = '#E6D6F2';
const FINX_COLOR_SECTION_HUTANG = '#FADBD8';
const FINX_COLOR_SECTION_GOALS = '#D9EAD3';

const FINX_COLOR_SUCCESS_BG = '#D9EAD3';
const FINX_COLOR_SUCCESS_TEXT = '#274E13';
const FINX_COLOR_WARNING_BG = '#FFF2CC';
const FINX_COLOR_WARNING_TEXT = '#7F6000';
const FINX_COLOR_DANGER_BG = '#F4CCCC';
const FINX_COLOR_DANGER_TEXT = '#990000';
const FINX_COLOR_INFO_BG = '#CFE2F3';
const FINX_COLOR_INFO_TEXT = '#0B5394';
const FINX_COLOR_NEUTRAL_BG = '#F3F3F3';
const FINX_COLOR_NEUTRAL_TEXT = '#666666';

// ---- Number formats ----
const FINX_FORMAT_RUPIAH = '"Rp"#,##0;-"Rp"#,##0';
const FINX_FORMAT_DATE = 'dd/mm/yyyy';
const FINX_FORMAT_DATETIME = 'dd/mm/yyyy hh:mm';
const FINX_FORMAT_PERCENT_SUFFIX = '0"%"';

function formatAllSheets_() {
  const ss = SpreadsheetApp.getActive();
  formatTransaksiSheet_(ss.getSheetByName('Transaksi'));
  formatPendingSheet_(ss.getSheetByName('Pending Transaksi'));
  formatSaldoAwalSheet_(ss.getSheetByName('Saldo Awal'));
  formatBudgetSheet_(ss.getSheetByName('Budget'));
  formatLogErrorSheet_(ss.getSheetByName('Log Error'));
  formatHutangPiutangSheet_(ss.getSheetByName('Hutang Piutang'));
  formatGoalsSheet_(ss.getSheetByName('Tabungan Goals'));
  formatDashboardSheet_(ss.getSheetByName('Dashboard'));
  setSheetTabColors_(ss);
}

// ---- Shared helpers ----

function applyHeaderStyle_(sheet, numCols) {
  const range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(FINX_COLOR_HEADER_BG)
    .setFontColor(FINX_COLOR_HEADER_TEXT)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 28);
  sheet.setFrozenRows(1);
}

function applyBanding_(sheet, numCols, numDataRows) {
  if (numDataRows <= 0) return;
  const range = sheet.getRange(2, 1, numDataRows, numCols);
  const existing = sheet.getBandings();
  existing.forEach(function (b) {
    if (b.getRange().getRow() === 2 && b.getRange().getColumn() === 1) b.remove();
  });
  range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
}

/**
 * A freshly-inserted blank sheet only has its default column count (often fewer than 26, and
 * always fewer than the Dashboard's chart-helper band which reaches column 28) - hideColumns/
 * setColumnWidth/getRange all throw "out of bounds" past whatever currently exists. Call this
 * before touching any column beyond what the sheet is guaranteed to already have.
 */
function ensureMinColumns_(sheet, minCols) {
  const missing = minCols - sheet.getMaxColumns();
  if (missing > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), missing);
}

function setColumnWidths_(sheet, widths) {
  widths.forEach(function (w, i) {
    if (w) sheet.setColumnWidth(i + 1, w);
  });
}

function setNumberFormatColumn_(sheet, col, numRows, format) {
  sheet.getRange(2, col, numRows, 1).setNumberFormat(format);
}

/**
 * Builds one conditional-format rule per {value, bg, text} entry and applies them to a single
 * column, replacing only the rules previously targeting that exact column (so calling this for
 * different columns on the same sheet composes instead of clobbering each other).
 */
function setStatusConditionalFormatting_(sheet, col, numRows, valueRules) {
  const range = sheet.getRange(2, col, numRows, 1);
  const kept = sheet.getConditionalFormatRules().filter(function (r) {
    return !r.getRanges().some(function (rg) { return rg.getColumn() === col && rg.getRow() === 2; });
  });
  const added = valueRules.map(function (vr) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(vr.value)
      .setBackground(vr.bg)
      .setFontColor(vr.text || null)
      .setBold(!!vr.bold)
      .setRanges([range])
      .build();
  });
  sheet.setConditionalFormatRules(kept.concat(added));
}

function setSheetTabColors_(ss) {
  const tabColors = {
    'Transaksi': '#1F3864',
    'Pending Transaksi': '#B45F06',
    'Dashboard': '#0B5345',
    'Saldo Awal': '#134F5C',
    'Budget': '#674EA7',
    'Hutang Piutang': '#990000',
    'Tabungan Goals': '#38761D',
    'Log Error': '#CC0000'
  };
  tabColors[PANDUAN_SHEET_NAME] = '#000000';
  Object.keys(tabColors).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(tabColors[name]);
  });
}

// ---- Per-sheet formatting ----

function formatTransaksiSheet_(sheet) {
  if (!sheet) return;
  const numCols = TRANSAKSI_HEADERS.length;
  const numRows = 2000;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  sheet.setFrozenColumns(1);
  applyBanding_(sheet, numCols, numRows);

  setColumnWidths_(sheet, [
    90, 140, 110, 80, 110, 160, 130, 200, 110, 150, 220, 160, 150, 100, 150, 90, 90
  ]);

  const col = function (name) { return TRANSAKSI_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Nominal'), numRows, FINX_FORMAT_RUPIAH);
  setNumberFormatColumn_(sheet, col('Timestamp Input'), numRows, FINX_FORMAT_DATETIME);
  setNumberFormatColumn_(sheet, col('Tanggal Transaksi'), numRows, FINX_FORMAT_DATE);
  sheet.getRange(2, col('Jenis'), numRows, 1).setHorizontalAlignment('center');
  sheet.getRange(2, col('Nominal'), numRows, 1).setHorizontalAlignment('right');
  sheet.getRange(2, col('Status Verifikasi'), numRows, 1).setHorizontalAlignment('center');
  sheet.getRange(2, col('Catatan'), numRows, 1).setWrap(true);

  setStatusConditionalFormatting_(sheet, col('Jenis'), numRows, [
    { value: 'Masuk', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT, bold: true },
    { value: 'Keluar', bg: FINX_COLOR_DANGER_BG, text: FINX_COLOR_DANGER_TEXT, bold: true }
  ]);
  setStatusConditionalFormatting_(sheet, col('Status Verifikasi'), numRows, [
    { value: 'Verified', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT },
    { value: 'Unverified', bg: FINX_COLOR_NEUTRAL_BG, text: FINX_COLOR_NEUTRAL_TEXT },
    { value: 'Mismatch-Resolved', bg: FINX_COLOR_WARNING_BG, text: FINX_COLOR_WARNING_TEXT },
    { value: 'Perlu Review Manual', bg: FINX_COLOR_DANGER_BG, text: FINX_COLOR_DANGER_TEXT, bold: true }
  ]);
}

function formatPendingSheet_(sheet) {
  if (!sheet) return;
  const numCols = PENDING_HEADERS.length;
  const numRows = 500;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  applyBanding_(sheet, numCols, numRows);
  setColumnWidths_(sheet, [110, 220, 140, 160, 90, 260, 100, 90, 140]);

  const col = function (name) { return PENDING_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Created At'), numRows, FINX_FORMAT_DATETIME);
  sheet.getRange(2, col('Status'), numRows, 1).setHorizontalAlignment('center');
  // 'Raw Payload' is a serialized JSON blob for the automation, not meant for human reading.
  sheet.hideColumns(col('Raw Payload'));

  setStatusConditionalFormatting_(sheet, col('Status'), numRows, [
    { value: 'Waiting', bg: FINX_COLOR_WARNING_BG, text: FINX_COLOR_WARNING_TEXT, bold: true },
    { value: 'Resolved', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT },
    { value: 'Expired', bg: FINX_COLOR_NEUTRAL_BG, text: FINX_COLOR_NEUTRAL_TEXT }
  ]);
}

function formatSaldoAwalSheet_(sheet) {
  if (!sheet) return;
  const numCols = SALDO_AWAL_HEADERS.length;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  setColumnWidths_(sheet, [140, 180, 140]);
  const col = function (name) { return SALDO_AWAL_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Saldo Awal'), 20, FINX_FORMAT_RUPIAH);
  sheet.getRange(2, col('Saldo Awal'), 20, 1).setHorizontalAlignment('right');
}

function formatBudgetSheet_(sheet) {
  if (!sheet) return;
  const numCols = BUDGET_HEADERS.length;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  setColumnWidths_(sheet, [180, 160]);
  const col = function (name) { return BUDGET_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Budget Bulanan'), 30, FINX_FORMAT_RUPIAH);
  sheet.getRange(2, col('Budget Bulanan'), 30, 1).setHorizontalAlignment('right');
}

function formatLogErrorSheet_(sheet) {
  if (!sheet) return;
  const numCols = LOG_ERROR_HEADERS.length;
  const numRows = 500;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  applyBanding_(sheet, numCols, numRows);
  setColumnWidths_(sheet, [140, 110, 200, 160, 280, 90]);
  const col = function (name) { return LOG_ERROR_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Timestamp'), numRows, FINX_FORMAT_DATETIME);
  sheet.getRange(2, col('Resolved'), numRows, 1).setHorizontalAlignment('center');
  setStatusConditionalFormatting_(sheet, col('Resolved'), numRows, [
    { value: 'Y', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT },
    { value: 'N', bg: FINX_COLOR_DANGER_BG, text: FINX_COLOR_DANGER_TEXT }
  ]);
}

function formatHutangPiutangSheet_(sheet) {
  if (!sheet) return;
  const numCols = HUTANG_PIUTANG_HEADERS.length;
  const numRows = 500;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  applyBanding_(sheet, numCols, numRows);
  setColumnWidths_(sheet, [90, 110, 100, 160, 120, 110, 110, 220]);

  const col = function (name) { return HUTANG_PIUTANG_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Nominal'), numRows, FINX_FORMAT_RUPIAH);
  setNumberFormatColumn_(sheet, col('Tanggal'), numRows, FINX_FORMAT_DATE);
  setNumberFormatColumn_(sheet, col('Jatuh Tempo'), numRows, FINX_FORMAT_DATE);
  sheet.getRange(2, col('Nominal'), numRows, 1).setHorizontalAlignment('right');

  setStatusConditionalFormatting_(sheet, col('Arah'), numRows, [
    { value: 'Piutang', bg: FINX_COLOR_INFO_BG, text: FINX_COLOR_INFO_TEXT },
    { value: 'Utang', bg: FINX_COLOR_WARNING_BG, text: FINX_COLOR_WARNING_TEXT }
  ]);
  setStatusConditionalFormatting_(sheet, col('Status'), numRows, [
    { value: 'Belum Lunas', bg: FINX_COLOR_DANGER_BG, text: FINX_COLOR_DANGER_TEXT },
    { value: 'Lunas', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT }
  ]);

  // Flag overdue entries (Jatuh Tempo in the past AND still Belum Lunas) across the whole row,
  // regardless of what the Status-column rule above already colors on its own.
  const jatuhTempoLetter = columnToLetter_(col('Jatuh Tempo'));
  const statusLetter = columnToLetter_(col('Status'));
  const fullRowRange = sheet.getRange(2, 1, numRows, numCols);
  const kept = sheet.getConditionalFormatRules().filter(function (r) {
    return !r.getRanges().some(function (rg) { return rg.getColumn() === 1 && rg.getRow() === 2 && rg.getNumColumns() === numCols; });
  });
  const overdueRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($' + jatuhTempoLetter + '2<>"",$' + jatuhTempoLetter + '2<TODAY(),$' + statusLetter + '2="Belum Lunas")')
    .setBackground(FINX_COLOR_DANGER_BG)
    .setFontColor(FINX_COLOR_DANGER_TEXT)
    .setBold(true)
    .setRanges([fullRowRange])
    .build();
  sheet.setConditionalFormatRules(kept.concat([overdueRule]));
}

function formatGoalsSheet_(sheet) {
  if (!sheet) return;
  const numCols = GOALS_HEADERS.length;
  const numRows = 200;
  ensureMinColumns_(sheet, numCols);
  applyHeaderStyle_(sheet, numCols);
  applyBanding_(sheet, numCols, numRows);
  setColumnWidths_(sheet, [180, 130, 120, 130, 110, 140, 90, 160]);

  const col = function (name) { return GOALS_HEADERS.indexOf(name) + 1; };
  setNumberFormatColumn_(sheet, col('Target Nominal'), numRows, FINX_FORMAT_RUPIAH);
  setNumberFormatColumn_(sheet, col('Nominal Terkumpul'), numRows, FINX_FORMAT_RUPIAH);
  setNumberFormatColumn_(sheet, col('Tanggal Target'), numRows, FINX_FORMAT_DATE);
  setNumberFormatColumn_(sheet, col('Progress %'), numRows, FINX_FORMAT_PERCENT_SUFFIX);
  sheet.getRange(2, col('Progress Bar'), numRows, 1).setFontFamily('Courier New');

  setStatusConditionalFormatting_(sheet, col('Status'), numRows, [
    { value: 'Berjalan', bg: FINX_COLOR_NEUTRAL_BG, text: FINX_COLOR_NEUTRAL_TEXT },
    { value: 'Tercapai', bg: FINX_COLOR_SUCCESS_BG, text: FINX_COLOR_SUCCESS_TEXT, bold: true },
    { value: 'Dibatalkan', bg: FINX_COLOR_DANGER_BG, text: FINX_COLOR_DANGER_TEXT }
  ]);
}

function formatDashboardSheet_(sheet) {
  if (!sheet) return;
  ensureMinColumns_(sheet, DASHBOARD_CHART_HELPER_COL + DASHBOARD_CHART_HELPER_SPAN - 1);

  // Break apart any merge left over from a previous provisioning run first - merging a range
  // that partially overlaps an existing different merge throws in Apps Script.
  sheet.getRange(DASHBOARD_ROW_TITLE, 1, 2, 8).breakApart();

  sheet.getRange(DASHBOARD_ROW_TITLE, 1, 1, 8).merge()
    .setValue('📊 FINXXMENT DASHBOARD')
    .setBackground(FINX_COLOR_TITLE_BG)
    .setFontColor(FINX_COLOR_TITLE_TEXT)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(DASHBOARD_ROW_TITLE, 32);

  sheet.getRange(DASHBOARD_ROW_SUBTITLE, 1, 1, 8).merge()
    .setValue('Dihitung ulang otomatis tiap hari jam 06:00 (atau via menu Finxxment > Refresh Dashboard Now) - jangan diedit manual.')
    .setFontColor(FINX_COLOR_SUBTITLE_TEXT)
    .setFontStyle('italic')
    .setHorizontalAlignment('center');

  setColumnWidths_(sheet, [240, 130, 130, 130, 130]);
  sheet.setFrozenRows(2);

  // Chart QUERY helper formulas are implementation detail, not meant to be read directly.
  sheet.hideColumns(DASHBOARD_CHART_HELPER_COL, DASHBOARD_CHART_HELPER_SPAN);
}
