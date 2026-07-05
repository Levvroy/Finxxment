/**
 * Visual style for every finxxment sheet: colors, number formats, conditional formatting, and
 * per-sheet layout (column widths, banding, frozen columns/rows, tab colors, hidden helper
 * columns). Called once from provisionFinxxmentSheets() in 00-bootstrap-provision.gs - re-run
 * that function any time you want to re-apply the look (e.g. after resetting a sheet's
 * formatting by hand).
 *
 * The 'Dashboard' sheet is a bento-style card grid (see apps-script/05-dashboard-layout.gs for
 * the row/column plan): formatDashboardSheet_() draws every tile/card's border, header, and
 * number format ONCE, here. The calculation files that own each block's data
 * (20-saldo-burnrate.gs, 30-budget-vs-actual.gs, 50-hutang-piutang.gs, 60-savings-goals.gs,
 * 10-dashboard-charts.gs) never touch borders/headers themselves - they only write plain
 * values/formulas into the cells this file already formatted, so a daily refresh is cheap and
 * never disturbs the layout.
 */

// ---- Palette (kept centralized so every sheet reads consistently) ----
const FINX_COLOR_HEADER_BG = '#1F3864';
const FINX_COLOR_HEADER_TEXT = '#FFFFFF';
const FINX_COLOR_TITLE_BG = '#0B5345';
const FINX_COLOR_TITLE_TEXT = '#FFFFFF';
const FINX_COLOR_SUBTITLE_TEXT = '#666666';
const FINX_COLOR_PRIMARY_TEXT = '#0B0B0B';
const FINX_COLOR_CARD_BORDER = '#D9D9D9';

// Fixed-order accent palette for bento card/tile identity (decorative only - never used to
// encode a data series, so cycling it across cards is fine; see docs/07 for the rationale).
const FINX_ACCENT_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
function finxAccent_(i) {
  return FINX_ACCENT_COLORS[i % FINX_ACCENT_COLORS.length];
}

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

// ---- Bento grid chrome (Dashboard only) ----
//
// These draw STATIC chrome (borders, headers, tile labels, cell formatting) exactly once,
// from formatDashboardSheet_ at provisioning time. The calculation files never call these -
// they only ever write plain values into the cells these functions already formatted, so a
// daily refresh is cheap and never disturbs the layout.

function drawBentoCardBorder_(sheet, startRow, startCol, numRows, numCols) {
  sheet.getRange(startRow, startCol, numRows, numCols)
    .setBorder(true, true, true, true, false, false, FINX_COLOR_CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Same as drawBentoCardBorder_ but explicitly omits the top edge - use this for a card's BODY
 * box when a drawBentoCardHeader_ sits directly above it. The header already draws a colored
 * accent line along that shared boundary; drawing a plain gray top border on the body range
 * right after would silently overwrite that accent line (last write to a shared cell edge
 * wins), so the body box only ever contributes its left/right/bottom sides.
 */
function drawBentoCardBodyBorder_(sheet, startRow, startCol, numRows, numCols) {
  sheet.getRange(startRow, startCol, numRows, numCols)
    .setBorder(false, true, true, true, false, false, FINX_COLOR_CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

/** A full-width (or half-width) card header: title bar with a colored accent underline. */
function drawBentoCardHeader_(sheet, row, startCol, numCols, title, accentColor) {
  const range = sheet.getRange(row, startCol, 1, numCols);
  if (numCols > 1) range.merge();
  range.setValue(title)
    .setBackground(FINX_COLOR_NEUTRAL_BG)
    .setFontColor(FINX_COLOR_PRIMARY_TEXT)
    .setFontWeight('bold')
    .setFontSize(11)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sheet.getRange(row, startCol, 1, numCols)
    .setBorder(true, true, null, true, null, null, FINX_COLOR_CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(row, startCol, 1, numCols)
    .setBorder(null, null, true, null, null, null, accentColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(row, 26);
}

/** A card header PLUS the bordered body box beneath it, in one call - for cards whose body is
 * plain cells (tables, metric lists) rather than a floating chart. */
function drawBentoCard_(sheet, headerRow, startCol, numCols, bodyRows, title, accentColor) {
  drawBentoCardHeader_(sheet, headerRow, startCol, numCols, title, accentColor);
  if (bodyRows > 0) {
    drawBentoCardBodyBorder_(sheet, headerRow + 1, startCol, bodyRows, numCols);
  }
}

/**
 * A stat tile: label row (small, muted, uppercase) + value row (large, bold) + footnote row
 * (small, muted) - the figure contract from the dataviz skill's stat-tile spec. Only draws
 * chrome; calculateSaldo()/calculateBurnRate() fill in the value/footnote text later.
 */
function drawBentoTile_(sheet, labelRow, valueRow, footRow, startCol, numCols, label, accentColor) {
  drawBentoCardBorder_(sheet, labelRow, startCol, footRow - labelRow + 1, numCols);

  const labelRange = sheet.getRange(labelRow, startCol, 1, numCols);
  if (numCols > 1) labelRange.merge();
  labelRange.setValue(label.toUpperCase())
    .setFontColor(FINX_COLOR_NEUTRAL_TEXT)
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  sheet.getRange(labelRow, startCol, 1, numCols)
    .setBorder(true, null, null, null, null, null, accentColor, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.setRowHeight(labelRow, 22);

  const valueRange = sheet.getRange(valueRow, startCol, 1, numCols);
  if (numCols > 1) valueRange.merge();
  valueRange.setFontSize(18)
    .setFontWeight('bold')
    .setFontColor(FINX_COLOR_PRIMARY_TEXT)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(valueRow, 32);

  const footRange = sheet.getRange(footRow, startCol, 1, numCols);
  if (numCols > 1) footRange.merge();
  footRange.setFontColor(FINX_COLOR_NEUTRAL_TEXT).setFontSize(9)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(footRow, 18);
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

/**
 * Draws the entire bento-grid chrome ONCE: title, a uniform 12-column grid, every tile/card
 * border+header+label, and pre-set number formats on every value cell - see
 * apps-script/05-dashboard-layout.gs for the row/column plan. The calculation files
 * (20/30/50/60-*.gs, 10-dashboard-charts.gs) only ever write plain values/formulas into the
 * cells named there; they never touch borders or headers, so a daily refresh never disturbs
 * the layout and this function only needs to run once at provisioning time.
 */
function formatDashboardSheet_(sheet) {
  if (!sheet) return;
  const totalCols = DASHBOARD_CHART_HELPER_COL + DASHBOARD_CHART_HELPER_SPAN - 1;
  ensureMinColumns_(sheet, totalCols);

  // Break apart every merge left over from a previous run first - merging a range that
  // partially overlaps an existing different merge throws in Apps Script, and this layout has
  // changed shape across versions.
  const lastRow = Math.max(sheet.getMaxRows(), 100);
  sheet.getRange(1, 1, lastRow, totalCols).breakApart();
  sheet.getRange(1, 1, lastRow, totalCols).clearFormat();

  // ---- Title banner ----
  sheet.getRange(DASHBOARD_ROW_TITLE, 1, 1, DASHBOARD_GRID_COLS).merge()
    .setValue('📊 FINXXMENT DASHBOARD')
    .setBackground(FINX_COLOR_TITLE_BG)
    .setFontColor(FINX_COLOR_TITLE_TEXT)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(DASHBOARD_ROW_TITLE, 36);

  sheet.getRange(DASHBOARD_ROW_SUBTITLE, 1, 1, DASHBOARD_GRID_COLS).merge()
    .setValue('Dihitung ulang otomatis tiap hari jam 06:00 (atau via menu Finxxment > Refresh Dashboard Now) - jangan diedit manual.')
    .setFontColor(FINX_COLOR_SUBTITLE_TEXT)
    .setFontStyle('italic')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(DASHBOARD_ROW_SUBTITLE, 22);

  setColumnWidths_(sheet, new Array(DASHBOARD_GRID_COLS).fill(DASHBOARD_COL_WIDTH));
  sheet.setFrozenRows(2);
  sheet.setHiddenGridlines(true);

  // ---- KPI row 1: hero tiles ----
  const kpi1 = [
    { label: 'Total Saldo' },
    { label: 'Pengeluaran Bulan Ini (MTD)' },
    { label: 'Rata-rata Harian' },
    { label: 'Proyeksi Akhir Bulan' }
  ];
  kpi1.forEach(function (tile, i) {
    drawBentoTile_(sheet, DASHBOARD_KPI1_LABEL_ROW, DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_FOOT_ROW,
      DASHBOARD_KPI1_STARTS[i], DASHBOARD_KPI1_TILE_COLS, tile.label, finxAccent_(i));
    sheet.getRange(DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_STARTS[i]).setNumberFormat(FINX_FORMAT_RUPIAH);
  });

  // ---- KPI row 2: one tile per sumber dana ----
  SUMBER_DANA.forEach(function (nama, i) {
    if (i >= DASHBOARD_KPI2_STARTS.length) return;
    drawBentoTile_(sheet, DASHBOARD_KPI2_LABEL_ROW, DASHBOARD_KPI2_VALUE_ROW, DASHBOARD_KPI2_FOOT_ROW,
      DASHBOARD_KPI2_STARTS[i], DASHBOARD_KPI2_TILE_COLS, nama, finxAccent_(i + 4));
    sheet.getRange(DASHBOARD_KPI2_VALUE_ROW, DASHBOARD_KPI2_STARTS[i]).setNumberFormat(FINX_FORMAT_RUPIAH);
  });

  // ---- Hero chart card: Cash Flow (full width) ----
  drawBentoCardHeader_(sheet, DASHBOARD_HERO_HEADER_ROW, 1, DASHBOARD_GRID_COLS,
    '💰 Cash Flow: Masuk vs Keluar per Bulan', finxAccent_(0));
  drawBentoCardBodyBorder_(sheet, DASHBOARD_HERO_BODY_ROW, 1, DASHBOARD_HERO_BODY_ROWS, DASHBOARD_GRID_COLS);

  // ---- Chart row 2: Kategori Pie | Sumber Dana Pie ----
  drawBentoCardHeader_(sheet, DASHBOARD_CHARTROW2_HEADER_ROW, 1, 6, '🍩 Breakdown per Kategori (Bulan Ini)', finxAccent_(1));
  drawBentoCardBodyBorder_(sheet, DASHBOARD_CHARTROW2_BODY_ROW, 1, DASHBOARD_CHARTROW2_BODY_ROWS, 6);
  drawBentoCardHeader_(sheet, DASHBOARD_CHARTROW2_HEADER_ROW, 7, 6, '🍩 Breakdown per Sumber Dana (Bulan Ini)', finxAccent_(2));
  drawBentoCardBodyBorder_(sheet, DASHBOARD_CHARTROW2_BODY_ROW, 7, DASHBOARD_CHARTROW2_BODY_ROWS, 6);

  // ---- Chart row 3: Trend Line | Top 5 Kategori ----
  drawBentoCardHeader_(sheet, DASHBOARD_CHARTROW3_HEADER_ROW, 1, 6, '📉 Trend 6 Bulan Terakhir', finxAccent_(3));
  drawBentoCardBodyBorder_(sheet, DASHBOARD_CHARTROW3_BODY_ROW, 1, DASHBOARD_CHARTROW3_BODY_ROWS, 6);
  drawBentoCardHeader_(sheet, DASHBOARD_CHARTROW3_HEADER_ROW, 7, 6, '🏆 Top 5 Kategori (Bulan Ini)', finxAccent_(4));
  drawBentoCardBodyBorder_(sheet, DASHBOARD_CHARTROW3_BODY_ROW, 7, DASHBOARD_CHARTROW3_BODY_ROWS, 6);

  // ---- Budget vs Actual: wide table card ----
  const budgetBodyRows = 1 + DASHBOARD_BUDGET_MAX_ROWS; // table header + data rows
  drawBentoCard_(sheet, DASHBOARD_BUDGET_HEADER_ROW, 1, DASHBOARD_GRID_COLS, budgetBodyRows,
    '📐 Budget vs Actual', finxAccent_(5));
  const budgetHeaders = ['Kategori', 'Budget', 'Actual', 'Delta', '% Terpakai'];
  sheet.getRange(DASHBOARD_BUDGET_TABLE_HEADER_ROW, 1, 1, DASHBOARD_BUDGET_COLS).setValues([budgetHeaders])
    .setFontWeight('bold').setBackground(FINX_COLOR_NEUTRAL_BG).setFontColor(FINX_COLOR_PRIMARY_TEXT);
  sheet.getRange(DASHBOARD_BUDGET_DATA_ROW, 2, DASHBOARD_BUDGET_MAX_ROWS, 3).setNumberFormat(FINX_FORMAT_RUPIAH);
  sheet.getRange(DASHBOARD_BUDGET_DATA_ROW, 5, DASHBOARD_BUDGET_MAX_ROWS, 1).setNumberFormat(FINX_FORMAT_PERCENT_SUFFIX);

  // ---- Hutang Piutang (left) | Tabungan Goals (right) ----
  drawBentoCard_(sheet, DASHBOARD_CARDS3_HEADER_ROW, DASHBOARD_HUTANG_START_COL, 6, DASHBOARD_HUTANG_CARD_ROWS - 1,
    '🤝 Hutang Piutang', finxAccent_(6));
  // Label text is a single unmerged cell that visually overflows across the blank cells to its
  // right (standard Sheets behavior) - the value lives in its own dedicated cell at the card's
  // right edge so it can be right-aligned cleanly, rather than an unmerged multi-column span
  // where only the first cell would ever hold a value.
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW, DASHBOARD_HUTANG_START_COL).setValue('Total Piutang (orang berhutang ke saya)');
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW, DASHBOARD_HUTANG_START_COL + 5).setNumberFormat(FINX_FORMAT_RUPIAH).setHorizontalAlignment('right');
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW + 1, DASHBOARD_HUTANG_START_COL).setValue('Total Utang (saya berhutang)');
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW + 1, DASHBOARD_HUTANG_START_COL + 5).setNumberFormat(FINX_FORMAT_RUPIAH).setHorizontalAlignment('right');
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW + 2, DASHBOARD_HUTANG_START_COL, 1, 6)
    .setFontColor(FINX_COLOR_NEUTRAL_TEXT).setFontStyle('italic').setFontSize(9);

  const goalsBodyRows = 1 + DASHBOARD_GOALS_MAX_ROWS;
  drawBentoCard_(sheet, DASHBOARD_CARDS3_HEADER_ROW, DASHBOARD_GOALS_START_COL, 6, goalsBodyRows,
    '🎯 Tabungan Goals', finxAccent_(7));
  const goalsHeaders = ['Nama Goal', 'Target', 'Terkumpul', 'Progress', 'Status', 'Bar'];
  sheet.getRange(DASHBOARD_GOALS_TABLE_HEADER_ROW, DASHBOARD_GOALS_START_COL, 1, DASHBOARD_GOALS_COLS).setValues([goalsHeaders])
    .setFontWeight('bold').setBackground(FINX_COLOR_NEUTRAL_BG).setFontColor(FINX_COLOR_PRIMARY_TEXT);
  sheet.getRange(DASHBOARD_GOALS_DATA_ROW, DASHBOARD_GOALS_START_COL + 1, DASHBOARD_GOALS_MAX_ROWS, 2).setNumberFormat(FINX_FORMAT_RUPIAH);
  sheet.getRange(DASHBOARD_GOALS_DATA_ROW, DASHBOARD_GOALS_START_COL + 3, DASHBOARD_GOALS_MAX_ROWS, 1).setNumberFormat(FINX_FORMAT_PERCENT_SUFFIX);
  sheet.getRange(DASHBOARD_GOALS_DATA_ROW, DASHBOARD_GOALS_START_COL + 5, DASHBOARD_GOALS_MAX_ROWS, 1).setFontFamily('Courier New');

  // Chart QUERY helper formulas are implementation detail, not meant to be read directly.
  sheet.hideColumns(DASHBOARD_CHART_HELPER_COL, DASHBOARD_CHART_HELPER_SPAN);
}
