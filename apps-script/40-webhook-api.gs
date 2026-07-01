/**
 * Web App endpoint callable from n8n's HTTP Request nodes, so balance/report/pending-lookup
 * math lives in one place (Apps Script) instead of being duplicated in n8n Code nodes.
 *
 * Deploy: Extensions > Apps Script > Deploy > New deployment > type "Web app",
 * execute as "Me", access "Anyone" (auth is enforced by the shared-secret check below, since
 * Apps Script web apps can't easily do bearer-token auth otherwise). Copy the resulting /exec
 * URL into every workflow's Config node as WEBAPP_URL.
 *
 * Before deploying, set a Script Property named SHARED_SECRET (Project Settings > Script
 * Properties) — do NOT hardcode the secret here. It must match APPS_SCRIPT_WEBAPP_SECRET in
 * config/env.example / each workflow's Config node.
 */

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  const params = (e && e.parameter) || {};
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!expectedSecret || params.secret !== expectedSecret) {
    return jsonResponse_({ error: 'unauthorized' }, 401);
  }

  try {
    switch (params.action) {
      case 'saldo':
        return jsonResponse_({ saldoPerSumberDana: calculateSaldo() });
      case 'burnRate':
        return jsonResponse_(calculateBurnRate());
      case 'laporan':
        return jsonResponse_(buildLaporanPayload_(params.period || 'bulan_ini'));
      case 'pendingLookup':
        return jsonResponse_(lookupPending_(params.chatId));
      default:
        return jsonResponse_({ error: 'unknown action: ' + params.action }, 400);
    }
  } catch (err) {
    logError_(params, err);
    return jsonResponse_({ error: String(err) }, 500);
  }
}

function jsonResponse_(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output; // Apps Script web apps can't set arbitrary HTTP status codes; statusCode is informational only, callers should check the "error" field.
}

function buildLaporanPayload_(period) {
  const ss = SpreadsheetApp.getActive();
  const rows = ss.getSheetByName('Transaksi').getDataRange().getValues();
  const header = rows[0];
  const jenisIdx = header.indexOf('Jenis');
  const nominalIdx = header.indexOf('Nominal');
  const kategoriIdx = header.indexOf('Kategori');
  const tanggalIdx = header.indexOf('Tanggal Transaksi');

  const now = new Date();
  const filtered = rows.slice(1).filter(function (row) {
    const d = new Date(row[tanggalIdx]);
    if (isNaN(d.getTime())) return false;
    if (period === 'minggu_ini') {
      const diffDays = (now - d) / 86400000;
      return diffDays >= 0 && diffDays <= 7;
    }
    if (period === 'bulan_lalu') {
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      return d.getMonth() === lastMonth;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalMasuk = filtered.filter(function (r) { return r[jenisIdx] === 'Masuk'; })
    .reduce(function (s, r) { return s + (Number(r[nominalIdx]) || 0); }, 0);
  const totalKeluar = filtered.filter(function (r) { return r[jenisIdx] === 'Keluar'; })
    .reduce(function (s, r) { return s + (Number(r[nominalIdx]) || 0); }, 0);

  const byKategori = {};
  filtered.filter(function (r) { return r[jenisIdx] === 'Keluar'; }).forEach(function (r) {
    const k = r[kategoriIdx];
    byKategori[k] = (byKategori[k] || 0) + (Number(r[nominalIdx]) || 0);
  });
  const topKategori = Object.entries(byKategori).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);

  return { period: period, totalMasuk: totalMasuk, totalKeluar: totalKeluar, topKategori: topKategori };
}

function lookupPending_(chatId) {
  const rows = SpreadsheetApp.getActive().getSheetByName('Pending Transaksi').getDataRange().getValues();
  const header = rows[0];
  const chatIdIdx = header.indexOf('Chat ID');
  const statusIdx = header.indexOf('Status');

  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (String(row[chatIdIdx]) === String(chatId) && row[statusIdx] === 'Waiting') {
      const obj = {};
      header.forEach(function (h, idx) { obj[h] = row[idx]; });
      return obj;
    }
  }
  return { status: 'None' };
}

function logError_(params, err) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Log Error');
  if (!sheet) return;
  sheet.appendRow([
    new Date().toISOString(),
    params.chatId || '',
    'apps-script/40-webhook-api.gs',
    'Webhook Error',
    JSON.stringify(params),
    'N'
  ]);
}
