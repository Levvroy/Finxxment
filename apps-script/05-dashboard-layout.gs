/**
 * Shared row/column layout for the 'Dashboard' sheet, so the summary-writer functions spread
 * across 10-dashboard-charts.gs, 20-saldo-burnrate.gs, 30-budget-vs-actual.gs,
 * 50-hutang-piutang.gs, and 60-savings-goals.gs never overwrite each other.
 *
 * Rows 1-2 are a title banner (written once by apps-script/01-sheet-formatting.gs during
 * provisioning, not on every refresh). Text summary blocks are stacked below it in columns
 * A-E (1-5), top to bottom, each with a fixed header row and enough room below it for its
 * worst case (e.g. Budget vs Actual reserves 13 rows for the 13 fixed categories). Chart QUERY
 * helper formulas live in a completely separate column band (starting at column O / 15) so
 * their multi-row spill ranges can never collide with the text blocks regardless of how many
 * rows either side actually uses.
 */

const DASHBOARD_ROW_TITLE = 1;             // row 1: "FINXXMENT DASHBOARD" banner
const DASHBOARD_ROW_SUBTITLE = 2;          // row 2: last-refreshed / do-not-edit note

const DASHBOARD_ROW_SALDO_HEADER = 4;      // rows 4-10 (title + up to 6 sumber dana)
const DASHBOARD_ROW_BURNRATE_HEADER = 12;  // rows 12-15 (title + 3 metrics)
const DASHBOARD_ROW_BUDGET_HEADER = 17;    // rows 17-30 (title + up to 13 categories)
const DASHBOARD_ROW_HUTANG_HEADER = 32;    // rows 32-34 (title + 2 metrics)
const DASHBOARD_ROW_GOALS_HEADER = 36;     // rows 36+ (title + one row per goal)

const DASHBOARD_CHART_HELPER_ROW = 2;
const DASHBOARD_CHART_HELPER_COL = 15;     // column O onward - clear of every text block above
const DASHBOARD_CHART_HELPER_SPAN = 14;    // total columns reserved for all 5 charts' helpers, kept hidden
