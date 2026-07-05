/**
 * Joins the 'Budget' sheet (kategori, monthly budget amount) against current-month actuals
 * from 'Transaksi' grouped by kategori, writes a comparison table to Dashboard, and flags
 * over-budget categories with conditional formatting.
 *
 * Writes only the table's DATA rows into the card formatDashboardSheet_() already drew (header
 * row + border box + number formats) - see apps-script/05-dashboard-layout.gs.
 */

function calculateBudgetVsActual() {
  const ss = SpreadsheetApp.getActive();
  const budgetRows = ss.getSheetByName('Budget').getDataRange().getValues();
  const transaksiRows = ss.getSheetByName('Transaksi').getDataRange().getValues();
  const tHeader = transaksiRows[0];
  const jenisIdx = tHeader.indexOf('Jenis');
  const nominalIdx = tHeader.indexOf('Nominal');
  const kategoriIdx = tHeader.indexOf('Kategori');
  const tanggalIdx = tHeader.indexOf('Tanggal Transaksi');

  const now = new Date();
  const actualByKategori = {};
  for (let i = 1; i < transaksiRows.length; i++) {
    const row = transaksiRows[i];
    if (row[jenisIdx] !== 'Keluar') continue;
    const tanggal = new Date(row[tanggalIdx]);
    if (isNaN(tanggal.getTime()) || tanggal.getMonth() !== now.getMonth() || tanggal.getFullYear() !== now.getFullYear()) continue;
    const kategori = row[kategoriIdx];
    actualByKategori[kategori] = (actualByKategori[kategori] || 0) + (Number(row[nominalIdx]) || 0);
  }

  const comparison = [];
  for (let i = 1; i < budgetRows.length; i++) {
    const kategori = budgetRows[i][0];
    if (!kategori) continue;
    const budget = Number(budgetRows[i][1]) || 0;
    const actual = actualByKategori[kategori] || 0;
    const delta = budget - actual;
    const percentUsed = budget > 0 ? Math.round((actual / budget) * 100) : 0;
    comparison.push([kategori, budget, actual, delta, percentUsed]);
  }

  writeBudgetComparisonToDashboard_(comparison);
  return comparison;
}

function writeBudgetComparisonToDashboard_(comparison) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const startRow = DASHBOARD_BUDGET_DATA_ROW;
  const numCols = DASHBOARD_BUDGET_COLS;
  const maxRows = DASHBOARD_BUDGET_MAX_ROWS;

  // Clear the whole reserved area first so a shrinking category list doesn't leave stale rows.
  sheet.getRange(startRow, 1, maxRows, numCols).clearContent();

  if (comparison.length > 0) {
    const rowCount = Math.min(comparison.length, maxRows);
    sheet.getRange(startRow, 1, rowCount, numCols).setValues(comparison.slice(0, rowCount));

    // Clear old rules touching this range, then flag over-budget rows (Delta < 0) - but only
    // for categories that actually HAVE a budget set ($B>0). Budget seeds empty by default
    // (seedBudget_), so without the $B>0 guard, any spending at all in an unconfigured
    // category would show Delta = 0-actual < 0 and get flagged red on a fresh setup.
    const rules = sheet.getConditionalFormatRules().filter(function (r) {
      return !r.getRanges().some(function (rg) { return rg.getRow() === startRow && rg.getColumn() === 1; });
    });
    const overBudgetRange = sheet.getRange(startRow, 1, maxRows, numCols);
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A' + startRow + '<>"",$B' + startRow + '>0,$D' + startRow + '<0)')
      .setBackground(FINX_COLOR_DANGER_BG)
      .setFontColor(FINX_COLOR_DANGER_TEXT)
      .setRanges([overBudgetRange])
      .build();
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
}
