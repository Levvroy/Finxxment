/**
 * Savings goal summary for the Dashboard and the /goal command. Progress ("Nominal Terkumpul",
 * "Progress %") is computed by formulas already written into the 'Tabungan Goals' sheet by
 * apps-script/00-bootstrap-provision.gs (applyGoalsFormulas_) — this file just reads them back
 * to write a compact summary block and flags goals that just crossed 100%.
 */

function calculateSavingsGoals() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Tabungan Goals');
  const rows = sheet.getDataRange().getValues();
  const header = rows[0];
  const namaIdx = header.indexOf('Nama Goal');
  const targetIdx = header.indexOf('Target Nominal');
  const terkumpulIdx = header.indexOf('Nominal Terkumpul');
  const progressIdx = header.indexOf('Progress %');
  const statusIdx = header.indexOf('Status');

  const goals = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[namaIdx]) continue;
    goals.push({
      nama: row[namaIdx],
      target: Number(row[targetIdx]) || 0,
      terkumpul: Number(row[terkumpulIdx]) || 0,
      progress: Number(row[progressIdx]) || 0,
      status: row[statusIdx] || 'Berjalan'
    });

    // Auto-flip Status to "Tercapai" once progress hits 100%, without clobbering "Dibatalkan".
    if (row[progressIdx] >= 100 && row[statusIdx] === 'Berjalan') {
      sheet.getRange(i + 1, statusIdx + 1).setValue('Tercapai');
      goals[goals.length - 1].status = 'Tercapai';
    }
  }

  writeGoalsToDashboard_(goals);
  return { goals: goals };
}

function writeGoalsToDashboard_(goals) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const startRow = DASHBOARD_ROW_GOALS_HEADER;
  const headers = ['Tabungan Goals', 'Target', 'Terkumpul', 'Progress', 'Status'];
  sheet.getRange(startRow, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (goals.length > 0) {
    const values = goals.map(function (g) { return [g.nama, g.target, g.terkumpul, g.progress + '%', g.status]; });
    sheet.getRange(startRow + 1, 1, values.length, headers.length).setValues(values);
  }
}
