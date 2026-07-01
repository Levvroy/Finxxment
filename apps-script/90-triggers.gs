/**
 * Trigger + menu registration. Run installTriggers() once manually (or via the menu it
 * creates) to register the daily Dashboard refresh. onOpen() builds a custom menu for the
 * common manual actions so you don't need to open the Apps Script editor day-to-day.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Finxxment')
    .addItem('Run Bootstrap Provisioning', 'provisionFinxxmentSheets')
    .addItem('Buka Panduan', 'openPanduanSheet_')
    .addSeparator()
    .addItem('Refresh Dashboard Now', 'refreshDashboard')
    .addItem('Recalculate Saldo', 'calculateSaldo')
    .addItem('Recalculate Budget vs Actual', 'calculateBudgetVsActual')
    .addItem('Recalculate Hutang Piutang', 'calculateHutangPiutang')
    .addItem('Recalculate Tabungan Goals', 'calculateSavingsGoals')
    .addSeparator()
    .addItem('Re-apply Formatting', 'formatAllSheets_')
    .addItem('Install Triggers', 'installTriggers')
    .addToUi();
}

function openPanduanSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(PANDUAN_SHEET_NAME);
  if (sheet) ss.setActiveSheet(sheet);
}

function installTriggers() {
  removeExistingTriggers_('refreshDashboard');

  ScriptApp.newTrigger('refreshDashboard')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  SpreadsheetApp.getUi().alert('finxxment: daily 06:00 Dashboard refresh trigger installed.');
}

function removeExistingTriggers_(handlerFunctionName) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handlerFunctionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
