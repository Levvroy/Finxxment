/**
 * Joins the 'Budget' sheet (kategori, monthly budget amount) against current-month actuals
 * from 'Transaksi' grouped by kategori, writes a comparison table to Dashboard, and flags
 * over-budget categories with conditional formatting.
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
  const startRow = DASHBOARD_ROW_BUDGET_HEADER;
  const headers = ['📐 Budget vs Actual', 'Budget', 'Actual', 'Delta', '% Terpakai'];
  sheet.getRange(startRow, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground(FINX_COLOR_SECTION_BUDGET);
  if (comparison.length > 0) {
    const range = sheet.getRange(startRow + 1, 1, comparison.length, headers.length);
    range.setValues(comparison);
    sheet.getRange(startRow + 1, 2, comparison.length, 3).setNumberFormat(FINX_FORMAT_RUPIAH).setHorizontalAlignment('right');
    sheet.getRange(startRow + 1, 5, comparison.length, 1).setNumberFormat(FINX_FORMAT_PERCENT_SUFFIX).setHorizontalAlignment('right');

    // Clear old rules touching this range, then flag over-budget rows (Delta < 0).
    const rules = sheet.getConditionalFormatRules().filter(function (r) {
      return !r.getRanges().some(function (rg) { return rg.getRow() === startRow + 1 && rg.getColumn() === 1; });
    });
    const overBudgetRange = sheet.getRange(startRow + 1, 1, comparison.length, headers.length);
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$D' + (startRow + 1) + '<0')
      .setBackground(FINX_COLOR_DANGER_BG)
      .setFontColor(FINX_COLOR_DANGER_TEXT)
      .setRanges([overBudgetRange])
      .build();
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
}
