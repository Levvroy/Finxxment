/**
 * Shared row/column layout for the 'Dashboard' sheet, so the summary-writer functions spread
 * across 10-dashboard-charts.gs, 20-saldo-burnrate.gs, 30-budget-vs-actual.gs,
 * 50-hutang-piutang.gs, and 60-savings-goals.gs never overwrite each other.
 *
 * Text summary blocks are stacked in columns A-E (1-5), top to bottom, each with a fixed
 * header row and enough room below it for its worst case (e.g. Budget vs Actual reserves 13
 * rows for the 13 fixed categories). Chart QUERY helper formulas live in a completely separate
 * column band (starting at column O / 15) so their multi-row spill ranges can never collide
 * with the text blocks regardless of how many rows either side actually uses.
 */

const DASHBOARD_ROW_SALDO_HEADER = 1;      // rows 1-7 (title + up to 6 sumber dana)
const DASHBOARD_ROW_BURNRATE_HEADER = 9;   // rows 9-12 (title + 3 metrics)
const DASHBOARD_ROW_BUDGET_HEADER = 14;    // rows 14-27 (title + up to 13 categories)
const DASHBOARD_ROW_HUTANG_HEADER = 29;    // rows 29-31 (title + 2 metrics)
const DASHBOARD_ROW_GOALS_HEADER = 33;     // rows 33+ (title + one row per goal)

const DASHBOARD_CHART_HELPER_ROW = 2;
const DASHBOARD_CHART_HELPER_COL = 15;     // column O onward - clear of every text block above
