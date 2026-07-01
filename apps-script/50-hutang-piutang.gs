/**
 * Utang/piutang (debt & receivable) summary. Rows are added directly by n8n's /hutang command
 * branch (n8n/workflows/01-main-input-handler.json); this file only computes summaries used by
 * the Dashboard and by the daily-alerts webhook action for overdue reminders.
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
  const startRow = DASHBOARD_ROW_HUTANG_HEADER;
  sheet.getRange(startRow, 1, 3, 2).setValues([
    ['🤝 Hutang Piutang', ''],
    ['Total Piutang (orang berhutang ke saya)', result.totalPiutang],
    ['Total Utang (saya berhutang)', result.totalUtang]
  ]);
  sheet.getRange(startRow, 1, 1, 2).setFontWeight('bold').setBackground(FINX_COLOR_SECTION_HUTANG);
  sheet.getRange(startRow + 1, 2, 2, 1).setNumberFormat(FINX_FORMAT_RUPIAH).setHorizontalAlignment('right');
}
