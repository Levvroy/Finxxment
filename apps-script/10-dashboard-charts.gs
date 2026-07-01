/**
 * Builds/refreshes the Dashboard sheet: summary numbers (via calculateSaldo/calculateBurnRate/
 * calculateBudgetVsActual from the other apps-script files) plus five charts. Charts are
 * identified by a name tag stored in each chart's options so refreshDashboard() can find and
 * replace them instead of duplicating a new chart on every run.
 *
 * Trigger model (registered in 90-triggers.gs): a daily time-driven trigger calls
 * refreshDashboard() so the Dashboard reflects the latest ledger without the user opening the
 * sheet. onOpen() also adds a manual "Refresh Dashboard Now" menu item. onEdit is intentionally
 * NOT wired to a full chart rebuild here (would blow through Apps Script quotas on rapid edits)
 * — only lightweight saldo/burn-rate recalculation should hook onEdit if you want that later.
 */

const CHART_HELPER_RANGE_ROW = 30; // helper/query ranges for charts start below the summary blocks

function refreshDashboard() {
  calculateSaldo();
  calculateBurnRate();
  calculateBudgetVsActual();
  buildCashflowChart();
  buildKategoriPieChart();
  buildSumberDanaBreakdownChart();
  buildTrendLineChart(6);
  buildTop5CategoriesChart();
}

function buildCashflowChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  // Column P = Tag Bulan (YYYY-MM), pivoted by column D = Jenis (Masuk/Keluar).
  writeQueryHelper_(
    sheet, CHART_HELPER_RANGE_ROW, 1,
    "=QUERY(" + data + "!A2:Q, \"select P, sum(E) where P is not null group by P pivot D\", 1)"
  );
  replaceChart_(sheet, 'cashflow_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(CHART_HELPER_RANGE_ROW, 1, 13, 3))
      .setPosition(1, 4, 0, 0)
      .setOption('title', 'Cash Flow: Masuk vs Keluar per Bulan');
  });
}

function buildKategoriPieChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  writeQueryHelper_(
    sheet, CHART_HELPER_RANGE_ROW, 4,
    "=QUERY(" + data + "!A2:Q, \"select F, sum(E) where D = 'Keluar' and month(C) = month(today()) group by F label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'kategori_pie_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(CHART_HELPER_RANGE_ROW, 4, 14, 2))
      .setPosition(20, 4, 0, 0)
      .setOption('title', 'Breakdown per Kategori (Bulan Ini)');
  });
}

function buildSumberDanaBreakdownChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  writeQueryHelper_(
    sheet, CHART_HELPER_RANGE_ROW, 7,
    "=QUERY(" + data + "!A2:Q, \"select I, sum(E) where D = 'Keluar' and month(C) = month(today()) group by I label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'sumber_dana_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(CHART_HELPER_RANGE_ROW, 7, 7, 2))
      .setPosition(39, 4, 0, 0)
      .setOption('title', 'Breakdown per Sumber Dana (Bulan Ini)');
  });
}

function buildTrendLineChart(monthsBack) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  // Column P = Tag Bulan (YYYY-MM).
  writeQueryHelper_(
    sheet, CHART_HELPER_RANGE_ROW, 10,
    "=QUERY(" + data + "!A2:Q, \"select P, sum(E) where D = 'Keluar' group by P order by P desc limit " + monthsBack + " label sum(E) 'Keluar'\", 1)"
  );
  replaceChart_(sheet, 'trend_line_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.LINE)
      .addRange(sheet.getRange(CHART_HELPER_RANGE_ROW, 10, monthsBack + 1, 2))
      .setPosition(58, 4, 0, 0)
      .setOption('title', 'Trend Pengeluaran ' + monthsBack + ' Bulan Terakhir');
  });
}

function buildTop5CategoriesChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  writeQueryHelper_(
    sheet, CHART_HELPER_RANGE_ROW, 13,
    "=QUERY(" + data + "!A2:Q, \"select F, sum(E) where D = 'Keluar' and month(C) = month(today()) group by F order by sum(E) desc limit 5 label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'top5_kategori_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange(CHART_HELPER_RANGE_ROW, 13, 6, 2))
      .setPosition(77, 4, 0, 0)
      .setOption('title', 'Top 5 Kategori Terbesar (Bulan Ini)');
  });
}

function writeQueryHelper_(sheet, row, col, formula) {
  const range = sheet.getRange(row, col);
  range.setFormula(formula);
  return range;
}

function replaceChart_(sheet, tag, configureBuilder) {
  const charts = sheet.getCharts();
  for (let i = 0; i < charts.length; i++) {
    const options = charts[i].getOptions();
    if (options.get('finxxmentTag') === tag) {
      sheet.removeChart(charts[i]);
    }
  }
  let builder = sheet.newChart();
  builder = configureBuilder(builder);
  builder = builder.setOption('finxxmentTag', tag);
  sheet.insertChart(builder.build());
}

function getSheetName_(name) {
  // Wrapped for clarity/consistency if sheet names ever need quoting for QUERY's sheet-ref syntax.
  return "'" + name + "'";
}
