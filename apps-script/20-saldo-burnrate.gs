/**
 * Saldo (balance) and burn-rate calculations, shared by the Dashboard sheet's on-screen
 * summary and the /saldo Telegram command (called via apps-script/40-webhook-api.gs so the
 * math lives in exactly one place instead of being duplicated in an n8n Code node).
 *
 * Writes only VALUES into the KPI tiles formatDashboardSheet_() already drew (see
 * apps-script/05-dashboard-layout.gs) - never touches borders/labels/number formats here.
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

  const total = SUMBER_DANA.reduce(function (sum, nama) { return sum + (saldo[nama] || 0); }, 0);
  writeTileValue_(sheet, DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_STARTS[0], total);

  SUMBER_DANA.forEach(function (nama, i) {
    if (i >= DASHBOARD_KPI2_STARTS.length) return;
    const value = saldo[nama] || 0;
    writeTileValue_(sheet, DASHBOARD_KPI2_VALUE_ROW, DASHBOARD_KPI2_STARTS[i], value);
  });
}

/** Writes a tile's value, coloring it red when negative - the tile's chrome (font size, bold,
 * number format) was already set once by drawBentoTile_ in 01-sheet-formatting.gs. */
function writeTileValue_(sheet, row, col, value) {
  sheet.getRange(row, col)
    .setValue(value)
    .setFontColor(value < 0 ? FINX_COLOR_DANGER_TEXT : FINX_COLOR_PRIMARY_TEXT);
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
  writeTileValue_(sheet, DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_STARTS[1], result.totalKeluarMtd);
  writeTileValue_(sheet, DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_STARTS[2], result.avgDailySpend);
  writeTileValue_(sheet, DASHBOARD_KPI1_VALUE_ROW, DASHBOARD_KPI1_STARTS[3], result.projectedMonthEnd);

  sheet.getRange(DASHBOARD_KPI1_FOOT_ROW, DASHBOARD_KPI1_STARTS[2])
    .setValue('hari ke-' + result.dayOfMonth + ' dari ' + result.daysInMonth);
}
