/**
 * Utang/piutang (debt & receivable) summary. Rows are added directly by n8n's /hutang command
 * branch (n8n/workflows/01-main-input-handler.json); this file only computes summaries used by
 * the Dashboard and by the daily-alerts webhook action for overdue reminders.
 *
 * Writes only values into the card formatDashboardSheet_() already drew (header, labels,
 * border, number formats) - see apps-script/05-dashboard-layout.gs.
 */

function calculateHutangPiutang() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Hutang Piutang');
  const rows = sheet.getDataRange().getValues();
  const header = rows[0];
  const arahIdx = header.indexOf('Arah');
  const nominalIdx = header.indexOf('Nominal');
  const statusIdx = header.indexOf('Status');
  const jatuhTempoIdx = header.indexOf('Jatuh Tempo');
  const namaIdx = header.indexOf('Nama Pihak');
  const idIdx = header.indexOf('ID');

  let totalPiutang = 0; // orang lain berhutang ke saya
  let totalUtang = 0;   // saya berhutang ke orang lain
  const overdue = [];
  const now = new Date();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[idIdx] || row[statusIdx] !== 'Belum Lunas') continue;
    const nominal = Number(row[nominalIdx]) || 0;
    if (row[arahIdx] === 'Piutang') totalPiutang += nominal;
    if (row[arahIdx] === 'Utang') totalUtang += nominal;

    const jatuhTempo = row[jatuhTempoIdx] ? new Date(row[jatuhTempoIdx]) : null;
    if (jatuhTempo && !isNaN(jatuhTempo.getTime()) && jatuhTempo < now) {
      overdue.push({ id: row[idIdx], arah: row[arahIdx], nama: row[namaIdx], nominal: nominal, jatuhTempo: row[jatuhTempoIdx] });
    }
  }

  const result = { totalPiutang: totalPiutang, totalUtang: totalUtang, overdue: overdue };
  writeHutangPiutangToDashboard_(result);
  return result;
}

function writeHutangPiutangToDashboard_(result) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const col = DASHBOARD_HUTANG_START_COL;

  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW, col + 5).setValue(result.totalPiutang);
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW + 1, col + 5)
    .setValue(result.totalUtang)
    .setFontColor(result.totalUtang > 0 ? FINX_COLOR_WARNING_TEXT : FINX_COLOR_PRIMARY_TEXT);

  const footnote = result.overdue.length > 0
    ? '⚠️ ' + result.overdue.length + ' entri lewat jatuh tempo'
    : 'Tidak ada yang lewat jatuh tempo';
  sheet.getRange(DASHBOARD_HUTANG_DATA_ROW + 2, col, 1, 6)
    .setValue(footnote)
    .setFontColor(result.overdue.length > 0 ? FINX_COLOR_DANGER_TEXT : FINX_COLOR_NEUTRAL_TEXT);
}
