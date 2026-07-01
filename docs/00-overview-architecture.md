# Overview & Architecture

finxxment automates personal-finance tracking end to end:

```
Telegram Bot (input)
      -> AI Verification (Gemini: text extraction + optional photo/vision cross-check)
      -> Google Sheets (storage + report)
      -> Telegram Bot (confirmation / clarification)
```

All orchestration runs in n8n. Nothing in this repo talks to a live n8n instance, bot, or
Google account yet — see `docs/02-setup-guide.md` for turning these artifacts into a running
system.

## Components and where they live in this repo

| Component | Responsibility | Repo location |
|---|---|---|
| Telegram Bot | Receives text/photo input and commands | Configured via BotFather; consumed by `n8n/workflows/01-main-input-handler.json`'s Telegram Trigger |
| AI Verifier | Extracts structured data from text, OCRs proof photos, cross-checks the two | Gemini HTTP calls inside workflow 01; prompts in `n8n/prompts/` |
| Orchestrator | Routing, validation, transformation, retries | `n8n/workflows/*.json` |
| Pending-state store | Durable "waiting on user reply" memory across independent n8n executions | `Pending Transaksi` sheet (schema: `docs/01-sheets-schema.md`), consumed by `n8n/workflows/02-clarification-handler.json` |
| Database | Transaction ledger + starting balances + budget | Google Sheets, provisioned by `apps-script/00-bootstrap-provision.gs` |
| Report Engine | Charts, saldo, burn rate, budget vs actual | `apps-script/10-dashboard-charts.gs`, `20-saldo-burnrate.gs`, `30-budget-vs-actual.gs` |
| Notifier | Sends confirmations/reports/errors back to the user | Telegram nodes throughout the n8n workflows |

## High-level message flow

1. **Telegram Trigger** fires on every incoming message (workflow 01).
2. **Owner whitelist check** — non-whitelisted chat ids are silently ignored (security
   requirement, see `docs/02-setup-guide.md` and spec section 8).
3. **Pending check** — if this chat has an open clarification waiting (`Pending Transaksi`
   sheet, looked up via `apps-script/40-webhook-api.gs`), control passes to workflow 02 instead
   of normal routing. Full design: `docs/04-mismatch-clarification-design.md`.
4. **Command routing** — `/laporan`, `/saldo`, `/undo`, `/edit`, `/kategori`, `/help`, or (the
   default) a plain transaction message.
5. **Transaction path** — Gemini extracts structured data from the text; if a photo is
   attached, Gemini Vision extracts proof data and a Code node compares the two within
   tolerance (`config/mismatch-tolerance.json`). Matches get written to `Transaksi`;
   mismatches or low-confidence extractions create a `Pending Transaksi` row and ask the user
   to clarify; Gemini failures still get written with a "Perlu Review Manual" status so no data
   is lost.
6. **Reporting** — `/laporan` and `/saldo` read/aggregate the ledger (or call the Apps Script
   web app); the Dashboard sheet keeps its own charts refreshed on a daily trigger
   (`apps-script/90-triggers.gs`) independent of any Telegram interaction.
7. **Optional workflows** — `03-scheduled-report.json` sends an unprompted weekly/monthly
   recap; `04-export-xlsx-berkala.json` sends a monthly `.xlsx` export.

See `docs/05-build-order-fase-1-to-5.md` for how to bring this up incrementally rather than all
at once.
