/**
 * Builds/refreshes an in-spreadsheet "📖 Panduan" (guide) tab - so anyone who opens the Sheet
 * directly (not just someone reading this repo's docs/) can understand what every sheet and
 * command does without leaving Google Sheets. Called once from provisionFinxxmentSheets() in
 * 00-bootstrap-provision.gs; safe to re-run any time (it clears and rewrites the tab, then
 * re-pins it as the first tab).
 */

const PANDUAN_SHEET_NAME = '📖 Panduan';

function provisionPanduanSheet_(ss) {
  let sheet = ss.getSheetByName(PANDUAN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PANDUAN_SHEET_NAME);
  } else {
    // clear()/clearFormats() do NOT remove merged cells, and section rows can shift between
    // runs as content changes length - break apart every merge first or a later .merge() call
    // can throw when it partially overlaps a stale merge from the previous run.
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
    sheet.clear();
    sheet.clearFormats();
    sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });
  }

  ensureMinColumns_(sheet, 3);
  sheet.setColumnWidths(1, 3, 260);
  sheet.setHiddenGridlines(true);

  sheet.getRange(1, 1, 1, 3).merge()
    .setValue('📖 PANDUAN FINXXMENT')
    .setBackground(FINX_COLOR_TITLE_BG)
    .setFontColor(FINX_COLOR_TITLE_TEXT)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  sheet.getRange(2, 1, 1, 3).merge()
    .setValue('Sistem pencatatan keuangan otomatis: Telegram (input) -> AI/Gemini (ekstraksi & verifikasi) -> Google Sheets (simpan & laporan) -> Telegram (konfirmasi). Semua sheet & command dijelaskan di bawah ini.')
    .setFontStyle('italic')
    .setFontColor(FINX_COLOR_SUBTITLE_TEXT)
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.setRowHeight(2, 40);

  let row = 4;

  row = writePanduanSection_(sheet, row, '1) DAFTAR SHEET & FUNGSINYA', ['Sheet', 'Fungsi', ''], [
    ['Transaksi', 'Buku besar utama - semua transaksi masuk/keluar tercatat otomatis dari bot Telegram.', ''],
    ['Pending Transaksi', 'Status "menunggu balasan" saat bot minta klarifikasi (nominal kurang jelas / bukti foto tidak cocok). Data teknis, tidak perlu diedit manual.', ''],
    ['Saldo Awal', 'Saldo awal tiap sumber dana (cash, rekening, e-wallet) - baseline perhitungan saldo real-time. Isi manual sekali di awal.', ''],
    ['Budget', 'Batas budget bulanan per kategori (opsional) - isi manual kalau mau pakai peringatan budget otomatis.', ''],
    ['Hutang Piutang', 'Catatan utang/piutang berikut jatuh tempo & status lunas - dikelola lewat command /hutang.', ''],
    ['Tabungan Goals', 'Target tabungan & progressnya - dikelola lewat command /goal, progress terisi otomatis.', ''],
    ['Log Error', 'Catatan kalau ada error AI/koneksi yang butuh review manual - untuk debugging.', ''],
    ['Dashboard', 'Ringkasan otomatis: saldo, burn rate, budget vs actual, hutang piutang, tabungan goals, dan 5 chart. Dihitung ulang tiap hari jam 06:00 - jangan diedit manual.', '']
  ], FINX_COLOR_HEADER_BG);

  row = writePanduanSection_(sheet, row, '2) COMMAND TELEGRAM', ['Command', 'Fungsi', 'Contoh'], [
    ['(ketik biasa)', 'Catat transaksi baru (boleh + foto bukti)', 'keluar 50000 makan siang qris'],
    ['/laporan [periode]', 'Ringkasan transaksi (minggu ini / bulan ini / bulan lalu)', '/laporan bulan ini'],
    ['/saldo', 'Cek saldo per sumber dana', '/saldo'],
    ['/undo', 'Batalkan transaksi terakhir', '/undo'],
    ['/edit [id] [field=value]', 'Edit transaksi tertentu', '/edit abc123 nominal=60000'],
    ['/kategori', 'Lihat daftar kategori & sumber dana', '/kategori'],
    ['/hutang [tambah|lunas]', 'Kelola utang/piutang', '/hutang tambah utang Budi 50000'],
    ['/goal [tambah]', 'Kelola target tabungan', '/goal tambah Kamera 5000000'],
    ['/cari <keyword>', 'Cari transaksi lama', '/cari kopi'],
    ['/help', 'Panduan singkat langsung di chat', '/help']
  ], FINX_COLOR_HEADER_BG);

  const maxLen = Math.max(CATEGORIES.length, SUMBER_DANA.length);
  const kategoriSumberRows = [];
  for (let i = 0; i < maxLen; i++) {
    kategoriSumberRows.push([CATEGORIES[i] || '', SUMBER_DANA[i] || '', '']);
  }
  row = writePanduanSection_(sheet, row, '3) KATEGORI & SUMBER DANA', ['Kategori', 'Sumber Dana', ''], kategoriSumberRows, FINX_COLOR_HEADER_BG);

  row = writePanduanLegendSection_(sheet, row);

  row = writePanduanSection_(sheet, row, '5) TIPS', ['', '', ''], [
    ['• Sheet Dashboard dihitung ulang otomatis - jangan diedit manual, perubahan akan tertimpa.', '', ''],
    ['• Untuk goal tabungan, isi Sub-kategori transaksi PERSIS SAMA dengan Nama Goal supaya progress terhitung.', '', ''],
    ['• Kolom "Raw Payload" (di Pending Transaksi) sengaja disembunyikan - itu data teknis internal.', '', ''],
    ['• Kalau ada transaksi berstatus "Perlu Review Manual", cek & edit manual - artinya AI gagal memproses otomatis.', '', ''],
    ['• Jalankan menu Finxxment > Refresh Dashboard Now kalau ingin update Dashboard tanpa menunggu jam 06:00.', '', ''],
    ['• Detail teknis (setup n8n, kredensial, dsb) ada di folder docs/ pada repository finxxment.', '', '']
  ], FINX_COLOR_HEADER_BG);

  sheet.getRange(row, 1, 1, 3).merge()
    .setValue('finxxment - dibuat & didokumentasikan otomatis. Lihat repo untuk detail teknis lengkap.')
    .setFontStyle('italic')
    .setFontColor(FINX_COLOR_NEUTRAL_TEXT)
    .setHorizontalAlignment('center');

  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
}

/**
 * Writes one titled, bordered mini-table starting at `startRow` and returns the row number
 * where the next section should start (title row + optional header row + data rows + 1 blank
 * spacer row).
 */
function writePanduanSection_(sheet, startRow, title, tableHeaders, tableRows, titleColor) {
  const numCols = 3;
  sheet.getRange(startRow, 1, 1, numCols).merge()
    .setValue(title)
    .setBackground(titleColor)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(11)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 26);

  let cursor = startRow + 1;
  const hasHeaderLabels = tableHeaders.some(function (h) { return h !== ''; });
  if (hasHeaderLabels) {
    sheet.getRange(cursor, 1, 1, numCols).setValues([tableHeaders])
      .setFontWeight('bold').setBackground(FINX_COLOR_NEUTRAL_BG);
    cursor += 1;
  }
  if (tableRows.length > 0) {
    sheet.getRange(cursor, 1, tableRows.length, numCols).setValues(tableRows).setWrap(true);
    cursor += tableRows.length;
  }

  sheet.getRange(startRow, 1, cursor - startRow, numCols)
    .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
  return cursor + 1;
}

function writePanduanLegendSection_(sheet, startRow) {
  const rows = [
    ['Status Verifikasi', 'Verified', 'Ada bukti foto & cocok dengan teks', FINX_COLOR_SUCCESS_BG, FINX_COLOR_SUCCESS_TEXT],
    ['Status Verifikasi', 'Unverified', 'Tanpa bukti foto (input teks saja)', FINX_COLOR_NEUTRAL_BG, FINX_COLOR_NEUTRAL_TEXT],
    ['Status Verifikasi', 'Mismatch-Resolved', 'Sempat beda antara teks & bukti, sudah diklarifikasi', FINX_COLOR_WARNING_BG, FINX_COLOR_WARNING_TEXT],
    ['Status Verifikasi', 'Perlu Review Manual', 'AI gagal memproses - cek & lengkapi manual', FINX_COLOR_DANGER_BG, FINX_COLOR_DANGER_TEXT],
    ['Hutang Piutang: Status', 'Belum Lunas', 'Masih ada tagihan berjalan', FINX_COLOR_DANGER_BG, FINX_COLOR_DANGER_TEXT],
    ['Hutang Piutang: Status', 'Lunas', 'Sudah selesai dibayar', FINX_COLOR_SUCCESS_BG, FINX_COLOR_SUCCESS_TEXT],
    ['Tabungan Goals: Status', 'Berjalan', 'Masih dalam proses menabung', FINX_COLOR_NEUTRAL_BG, FINX_COLOR_NEUTRAL_TEXT],
    ['Tabungan Goals: Status', 'Tercapai', 'Target sudah tercapai (otomatis berubah saat 100%)', FINX_COLOR_SUCCESS_BG, FINX_COLOR_SUCCESS_TEXT],
    ['Tabungan Goals: Status', 'Dibatalkan', 'Goal dibatalkan manual', FINX_COLOR_DANGER_BG, FINX_COLOR_DANGER_TEXT]
  ];

  const numCols = 3;
  sheet.getRange(startRow, 1, 1, numCols).merge()
    .setValue('4) LEGENDA STATUS & WARNA')
    .setBackground(FINX_COLOR_HEADER_BG)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(11);
  sheet.setRowHeight(startRow, 26);

  let cursor = startRow + 1;
  sheet.getRange(cursor, 1, 1, numCols).setValues([['Kolom', 'Nilai', 'Arti']])
    .setFontWeight('bold').setBackground(FINX_COLOR_NEUTRAL_BG);
  cursor += 1;

  rows.forEach(function (r) {
    sheet.getRange(cursor, 1, 1, numCols).setValues([[r[0], r[1], r[2]]]).setWrap(true);
    sheet.getRange(cursor, 2, 1, 1).setBackground(r[3]).setFontColor(r[4]).setFontWeight('bold').setHorizontalAlignment('center');
    cursor += 1;
  });

  sheet.getRange(startRow, 1, cursor - startRow, numCols)
    .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
  return cursor + 1;
}
