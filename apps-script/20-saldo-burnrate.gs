/**
 * Saldo (balance) and burn-rate calculations, shared by the Dashboard sheet's on-screen
 * summary and the /saldo Telegram command (called via apps-script/40-webhook-api.gs so the
 * math lives in exactly one place instead of being duplicated in an n8n Code node).
 */

function calculateSaldo() {
  const ss = SpreadsheetApp.getActive();
  const saldoAwalRows = ss.getSheetByName('Saldo Awal').getDataRange().getValues();
  const transaksiRows = ss.getSheetByName('Transaksi').getDataRange().getValues();
  const tHeader = transaksiRows[0];
  const jenisIdx = tHeader.indexOf('Jenis');
  const nominalIdx = tHeader.indexOf('Nominal');
  const sumberIdx = tHeader.indexOf('Sumber Dana');

  const saldo = {};
  for (let i = 1; i < saldoAwalRows.length; i++) {
    const sumberDana = saldoAwalRows[i][0];
    if (!sumberDana) continue;
    saldo[sumberDana] = Number(saldoAwalRows[i][2]) || 0;
  }

  for (let i = 1; i < transaksiRows.length; i++) {
    const row = transaksiRows[i];
    const sumberDana = row[sumberIdx];
    if (!sumberDana) continue;
    const nominal = Number(row[nominalIdx]) || 0;
    if (!(sumberDana in saldo)) saldo[sumberDana] = 0;
    saldo[sumberDana] += row[jenisIdx] === 'Masuk' ? nominal : -nominal;
  }

  writeSaldoToDashboard_(saldo);
  return saldo;
}

function writeSaldoToDashboard_(saldo) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const startRow = DASHBOARD_ROW_SALDO_HEADER + 1;
  const startCol = 1;
  sheet.getRange(startRow - 1, startCol, 1, 2).setValues([['Saldo per Sumber Dana', 'Nilai']]).setFontWeight('bold');
  const rows = Object.entries(saldo);
  if (rows.length > 0) {
    sheet.getRange(startRow, startCol, rows.length, 2).setValues(rows);
  }
}

function calculateBurnRate() {
  const ss = SpreadsheetApp.getActive();
  const transaksiRows = ss.getSheetByName('Transaksi').getDataRange().getValues();
  const header = transaksiRows[0];
  const jenisIdx = header.indexOf('Jenis');
  const nominalIdx = header.indexOf('Nominal');
  const tanggalIdx = header.indexOf('Tanggal Transaksi');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let totalKeluarMtd = 0;

  for (let i = 1; i < transaksiRows.length; i++) {
    const row = transaksiRows[i];
    if (row[jenisIdx] !== 'Keluar') continue;
    const tanggal = new Date(row[tanggalIdx]);
    if (isNaN(tanggal.getTime()) || tanggal < monthStart) continue;
    totalKeluarMtd += Number(row[nominalIdx]) || 0;
  }

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const avgDailySpend = dayOfMonth > 0 ? Math.round(totalKeluarMtd / dayOfMonth) : 0;
  const projectedMonthEnd = avgDailySpend * daysInMonth;

  const result = { totalKeluarMtd, avgDailySpend, projectedMonthEnd, daysInMonth, dayOfMonth };
  writeBurnRateToDashboard_(result);
  return result;
}

function writeBurnRateToDashboard_(result) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const startRow = DASHBOARD_ROW_BURNRATE_HEADER;
  sheet.getRange(startRow, 1, 4, 2).setValues([
    ['Burn Rate', ''],
    ['Pengeluaran Bulan Ini (MTD)', result.totalKeluarMtd],
    ['Rata-rata Harian', result.avgDailySpend],
    ['Proyeksi Akhir Bulan', result.projectedMonthEnd]
  ]);
  sheet.getRange(startRow, 1).setFontWeight('bold');
}
