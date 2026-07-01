# Build Order — Fase 1 to 5

Maps the original roadmap's phases to concrete deliverables already in this repo, and what
"only run this phase" looks like in n8n if you want to bring the system up incrementally
instead of activating everything at once.

## Fase 1 — Foundation
- [x] Google Sheets structure + saldo awal → `apps-script/00-bootstrap-provision.gs` (run
  `provisionFinxxmentSheets`)
- [ ] Telegram bot token via BotFather → `docs/02-setup-guide.md` step 6
- [ ] n8n instance + credentials → `docs/02-setup-guide.md` steps 9, 12

## Fase 2 — Core Flow (simple text-only, no photo verification yet)
- [x] Workflow built: `n8n/workflows/01-main-input-handler.json`
- To test *only* this phase: in the imported workflow, temporarily disable/bypass the
  "IF Has Photo" → Gemini Vision → "Code: Compare Text vs Vision" → "IF Mismatch" chain (right
  after "IF Confidence Low") so every transaction with a photo still routes straight to
  "Code: Build Row Object" as if `hasPhoto` were false. Re-enable for Fase 3.
- Test end-to-end: send a handful of plain-text transactions, confirm rows land in `Transaksi`
  with a Telegram confirmation each time.

## Fase 3 — AI Verification
- [x] Photo handling + Gemini Vision + compare logic already wired into workflow 01 (nodes:
  "Telegram: Get File" → "Gemini: Vision Extraction" → "Code: Compare Text vs Vision" →
  "IF Mismatch").
- [x] Clarification/mismatch state machine → `n8n/workflows/02-clarification-handler.json`,
  design in `docs/04-mismatch-clarification-design.md`.
- Test: send text + photo where amounts match (should verify cleanly); send text + photo with
  a deliberately wrong nominal (should trigger the mismatch clarification flow).

## Fase 4 — Reporting
- [x] Dashboard sheet with charts/pivots → `apps-script/10-dashboard-charts.gs`,
  `20-saldo-burnrate.gs`, `30-budget-vs-actual.gs`, installed via `apps-script/90-triggers.gs`.
- [x] `/laporan`, `/saldo` commands → branches in `n8n/workflows/01-main-input-handler.json`.

## Fase 5 — Polish
- [x] `/undo`, `/edit` → branches in workflow 01, edit-needs-field clarification in workflow 02.
- [x] Error logging → `Log Error` sheet (schema in `docs/01-sheets-schema.md`), written by both
  the Gemini-failure fallback branch in workflow 01 and `logError_` in
  `apps-script/40-webhook-api.gs`.
- [x] (Optional) Scheduled report → `n8n/workflows/03-scheduled-report.json`.
- [x] (Optional) Monthly xlsx export → `n8n/workflows/04-export-xlsx-berkala.json`.

All artifacts for all 5 phases already exist in this repo — the checklist above is about
*activation order* if you want to bring the system up gradually and test each layer before
turning on the next, not about what still needs to be written.

## Fase 6 — Extended Features (added after the original 5-phase roadmap)

Not in the original brief, added because they close real gaps in day-to-day personal finance
management once the core loop (Fase 1-5) is working:

- [x] **Proactive budget alerts** — a parallel branch in
  `n8n/workflows/01-main-input-handler.json` (nodes "HTTP: Budget Check" → "IF Budget Alert" →
  "Telegram: Send Budget Alert") warns the user immediately when a transaction pushes a
  category to 80%/100% of its monthly budget, instead of only showing up on `/laporan` or the
  Dashboard.
- [x] **Hutang/Piutang (debt & receivable) tracker** — `Hutang Piutang` sheet +
  `/hutang [tambah|lunas ...]` command + `apps-script/50-hutang-piutang.gs`, giving the existing
  `Transfer/Pinjam` category actual follow-up: who owes whom, due dates, paid status.
- [x] **Savings goals** — `Tabungan Goals` sheet + `/goal [tambah ...]` command +
  `apps-script/60-savings-goals.gs`; progress is derived automatically from `Transaksi` rows
  (no manual "add contribution" bookkeeping).
- [x] **Transaction search** — `/cari <keyword>` command, backed by the `search` action in
  `apps-script/40-webhook-api.gs`.
- [x] **Daily proactive alerts workflow** — `n8n/workflows/05-daily-alerts.json`, a Cron that
  calls the `dailyAlerts` webhook action (every budget already over threshold + every overdue
  Hutang Piutang entry) and messages the user only if there's something to flag.

Test: create a low budget for a category and log a transaction that exceeds 80% of it — confirm
an immediate Telegram warning; add a `/hutang tambah utang Budi 50000 2026-06-01` entry with a
past due date and wait for (or manually trigger) workflow 05 — confirm it's flagged as overdue;
create a `/goal tambah Kamera 5000000`, log a transaction with `Kategori=Tabungan/Investasi` and
`Sub-kategori=Kamera`, then `/goal` — confirm progress reflects it.
