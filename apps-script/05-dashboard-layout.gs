/**
 * Bento-grid layout for the 'Dashboard' sheet. Everything visible lives on a uniform
 * 12-column grid (GRID_COLS, all the same width) so tiles/cards of different sizes still line
 * up cleanly - the defining trait of a bento layout. The static chrome (title, card borders,
 * card headers, column widths) is drawn ONCE by formatDashboardSheet_() in
 * 01-sheet-formatting.gs during provisioning; the calculation files
 * (20-saldo-burnrate.gs, 30-budget-vs-actual.gs, 50-hutang-piutang.gs, 60-savings-goals.gs,
 * 10-dashboard-charts.gs) only ever write VALUES into the cells this file names - they never
 * redraw borders/headers, so a daily refresh is cheap and never disturbs the layout.
 *
 * Chart QUERY helper formulas live in a totally separate, hidden column band well to the right
 * of the visible grid (DASHBOARD_CHART_HELPER_COL onward) so they can never collide with it.
 */

const DASHBOARD_GRID_COLS = 12;
const DASHBOARD_COL_WIDTH = 95;

const DASHBOARD_ROW_TITLE = 1;
const DASHBOARD_ROW_SUBTITLE = 2;

// ---- KPI row 1: 4 hero tiles (Total Saldo, MTD spend, Avg Daily, Projection), 3 cols each ----
const DASHBOARD_KPI1_LABEL_ROW = 4;
const DASHBOARD_KPI1_VALUE_ROW = 5;
const DASHBOARD_KPI1_FOOT_ROW = 6;
const DASHBOARD_KPI1_TILE_COLS = 3;
const DASHBOARD_KPI1_STARTS = [1, 4, 7, 10];

// ---- KPI row 2: up to 6 tiles (Saldo per Sumber Dana), 2 cols each ----
const DASHBOARD_KPI2_LABEL_ROW = 8;
const DASHBOARD_KPI2_VALUE_ROW = 9;
const DASHBOARD_KPI2_FOOT_ROW = 10;
const DASHBOARD_KPI2_TILE_COLS = 2;
const DASHBOARD_KPI2_STARTS = [1, 3, 5, 7, 9, 11];

// ---- Hero chart card: Cash Flow, full width (12 cols) ----
const DASHBOARD_HERO_HEADER_ROW = 12;
const DASHBOARD_HERO_BODY_ROW = 13;
const DASHBOARD_HERO_BODY_ROWS = 14;

// ---- Chart row 2: Kategori Pie (cols 1-6) | Sumber Dana Pie (cols 7-12) ----
const DASHBOARD_CHARTROW2_HEADER_ROW = 28;
const DASHBOARD_CHARTROW2_BODY_ROW = 29;
const DASHBOARD_CHARTROW2_BODY_ROWS = 14;

// ---- Chart row 3: Trend Line (cols 1-6) | Top 5 Kategori (cols 7-12) ----
const DASHBOARD_CHARTROW3_HEADER_ROW = 44;
const DASHBOARD_CHARTROW3_BODY_ROW = 45;
const DASHBOARD_CHARTROW3_BODY_ROWS = 14;

// ---- Budget vs Actual: wide table card, full width (12 cols), table itself uses cols 1-5 ----
const DASHBOARD_BUDGET_HEADER_ROW = 60;
const DASHBOARD_BUDGET_TABLE_HEADER_ROW = 61;
const DASHBOARD_BUDGET_DATA_ROW = 62;
const DASHBOARD_BUDGET_MAX_ROWS = 13;
const DASHBOARD_BUDGET_COLS = 5;

// ---- Hutang Piutang (cols 1-6) | Tabungan Goals (cols 7-12), side by side ----
const DASHBOARD_CARDS3_HEADER_ROW = 76;
const DASHBOARD_HUTANG_START_COL = 1;
const DASHBOARD_HUTANG_DATA_ROW = 77;
const DASHBOARD_HUTANG_CARD_ROWS = 4; // header + 3 metric/footnote rows

const DASHBOARD_GOALS_START_COL = 7;
const DASHBOARD_GOALS_TABLE_HEADER_ROW = 77;
const DASHBOARD_GOALS_DATA_ROW = 78;
const DASHBOARD_GOALS_MAX_ROWS = 15;
const DASHBOARD_GOALS_COLS = 6;

// ---- Chart QUERY helpers - hidden, well clear of the visible 12-column grid ----
const DASHBOARD_CHART_HELPER_ROW = 2;
const DASHBOARD_CHART_HELPER_COL = 16;
const DASHBOARD_CHART_HELPER_SPAN = 14;
