/**
 * Builds/refreshes the Dashboard sheet: summary numbers (via calculateSaldo/calculateBurnRate/
 * calculateBudgetVsActual/calculateHutangPiutang/calculateSavingsGoals from the other
 * apps-script files) plus five charts, positioned inside the bento card slots
 * formatDashboardSheet_() already drew (see apps-script/05-dashboard-layout.gs). Charts are
 * identified by a name tag stored in each chart's options so refreshDashboard() can find and
 * replace them instead of duplicating a new chart on every run. Each chart's own title is
 * intentionally blank - the card header above it already carries the title, and a second title
 * inside the chart would just repeat it.
 *
 * The QUERY helper formulas that feed the charts live in a separate, hidden column band
 * (DASHBOARD_CHART_HELPER_COL onward) so their multi-row spill never collides with the visible
 * grid regardless of how much history accumulates.
 *
 * Trigger model (registered in 90-triggers.gs): a daily time-driven trigger calls
 * refreshDashboard() so the Dashboard reflects the latest ledger without the user opening the
 * sheet. onOpen() also adds a manual "Refresh Dashboard Now" menu item. onEdit is intentionally
 * NOT wired to a full chart rebuild here (would blow through Apps Script quotas on rapid edits)
 * — only lightweight saldo/burn-rate recalculation should hook onEdit if you want that later.
 */

// Functions, not top-level consts: Apps Script doesn't guarantee file load order, so a
// top-level `const X = DASHBOARD_GRID_COLS * ...` here could evaluate before
// 05-dashboard-layout.gs's top-level consts exist. Computing these lazily, inside a function
// body, is safe because by the time any function actually runs, every file has already loaded.
function dashboardChartFullWidth_() { return DASHBOARD_GRID_COLS * DASHBOARD_COL_WIDTH - 20; }
function dashboardChartHalfWidth_() { return 6 * DASHBOARD_COL_WIDTH - 20; }
const DASHBOARD_CHART_HEIGHT = 280;

function refreshDashboard() {
  calculateSaldo();
  calculateBurnRate();
  calculateBudgetVsActual();
  calculateHutangPiutang();
  calculateSavingsGoals();
  buildCashflowChart();
  buildKategoriPieChart();
  buildSumberDanaBreakdownChart();
  buildTrendLineChart(6);
  buildTop5CategoriesChart();
}

function buildCashflowChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  const col = DASHBOARD_CHART_HELPER_COL;
  // Column P = Tag Bulan (YYYY-MM), pivoted by column D = Jenis (Masuk/Keluar).
  // "P != ''" (not "is not null"): Tag Bulan is an ARRAYFORMULA that returns a literal empty
  // string "" for every unused pre-provisioned row, and QUERY treats a formula-produced ""
  // as a real (non-null) value - "is not null" would wrongly include hundreds of blank rows
  // as a spurious "(empty)" group in the chart.
  writeQueryHelper_(
    sheet, DASHBOARD_CHART_HELPER_ROW, col,
    "=QUERY(" + data + "!A2:Q, \"select P, sum(E) where P != '' group by P pivot D\", 1)"
  );
  replaceChart_(sheet, 'cashflow_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(DASHBOARD_CHART_HELPER_ROW, col, 13, 3))
      .setPosition(DASHBOARD_HERO_BODY_ROW, 1, 4, 4)
      .setOption('title', '')
      .setOption('width', dashboardChartFullWidth_())
      .setOption('height', DASHBOARD_CHART_HEIGHT);
  });
}

function buildKategoriPieChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  const col = DASHBOARD_CHART_HELPER_COL + 3;
  // Both month(C) and year(C) must match "today" - month(C) alone would also match this same
  // calendar month from a previous year once more than ~12 months of history exist.
  writeQueryHelper_(
    sheet, DASHBOARD_CHART_HELPER_ROW, col,
    "=QUERY(" + data + "!A2:Q, \"select F, sum(E) where D = 'Keluar' and month(C) = month(today()) and year(C) = year(today()) group by F label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'kategori_pie_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(DASHBOARD_CHART_HELPER_ROW, col, 14, 2))
      .setPosition(DASHBOARD_CHARTROW2_BODY_ROW, 1, 4, 4)
      .setOption('title', '')
      .setOption('width', dashboardChartHalfWidth_())
      .setOption('height', DASHBOARD_CHART_HEIGHT);
  });
}

function buildSumberDanaBreakdownChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  const col = DASHBOARD_CHART_HELPER_COL + 6;
  writeQueryHelper_(
    sheet, DASHBOARD_CHART_HELPER_ROW, col,
    "=QUERY(" + data + "!A2:Q, \"select I, sum(E) where D = 'Keluar' and month(C) = month(today()) and year(C) = year(today()) group by I label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'sumber_dana_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(DASHBOARD_CHART_HELPER_ROW, col, 7, 2))
      .setPosition(DASHBOARD_CHARTROW2_BODY_ROW, 7, 4, 4)
      .setOption('title', '')
      .setOption('width', dashboardChartHalfWidth_())
      .setOption('height', DASHBOARD_CHART_HEIGHT);
  });
}

function buildTrendLineChart(monthsBack) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  const col = DASHBOARD_CHART_HELPER_COL + 9;
  // Column P = Tag Bulan (YYYY-MM).
  writeQueryHelper_(
    sheet, DASHBOARD_CHART_HELPER_ROW, col,
    "=QUERY(" + data + "!A2:Q, \"select P, sum(E) where D = 'Keluar' group by P order by P desc limit " + monthsBack + " label sum(E) 'Keluar'\", 1)"
  );
  replaceChart_(sheet, 'trend_line_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.LINE)
      .addRange(sheet.getRange(DASHBOARD_CHART_HELPER_ROW, col, monthsBack + 1, 2))
      .setPosition(DASHBOARD_CHARTROW3_BODY_ROW, 1, 4, 4)
      .setOption('title', '')
      .setOption('width', dashboardChartHalfWidth_())
      .setOption('height', DASHBOARD_CHART_HEIGHT);
  });
}

function buildTop5CategoriesChart() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dashboard');
  const data = getSheetName_('Transaksi');
  const col = DASHBOARD_CHART_HELPER_COL + 12;
  writeQueryHelper_(
    sheet, DASHBOARD_CHART_HELPER_ROW, col,
    "=QUERY(" + data + "!A2:Q, \"select F, sum(E) where D = 'Keluar' and month(C) = month(today()) and year(C) = year(today()) group by F order by sum(E) desc limit 5 label sum(E) 'Total'\", 1)"
  );
  replaceChart_(sheet, 'top5_kategori_chart', function (builder) {
    return builder.setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange(DASHBOARD_CHART_HELPER_ROW, col, 6, 2))
      .setPosition(DASHBOARD_CHARTROW3_BODY_ROW, 7, 4, 4)
      .setOption('title', '')
      .setOption('width', dashboardChartHalfWidth_())
      .setOption('height', DASHBOARD_CHART_HEIGHT);
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
