# n8n Workflows

Four workflow exports, meant to be imported into your own n8n instance (n8n > Workflows >
Import from File). None of these are active/tested — they were authored without a live n8n
instance or real credentials, so treat them as a strong starting point to review and adjust in
the n8n editor, not a guaranteed one-click deploy. See `docs/06-verification-checklist.md` for
what to manually test after import.

## Import order

1. **`01-main-input-handler.json`** — the main bot logic (Telegram trigger, command routing,
   transaction extraction, photo verification, Sheets writes, Telegram replies).
2. **`02-clarification-handler.json`** — sub-workflow invoked by workflow 01's
   "Execute Workflow: Clarification Handler" node whenever a chat has an open row in the
   `Pending Transaksi` sheet. Import this *before* wiring workflow 01's Execute Workflow node,
   so you can copy its workflow id into workflow 01's `workflowId` field
   (`REPLACE_ME_WORKFLOW_02_ID`).
3. **`03-scheduled-report.json`** — optional weekly/monthly unprompted recap (Fase 5 / optional
   per the roadmap).
4. **`04-export-xlsx-berkala.json`** — optional monthly `.xlsx` export sent as a Telegram
   document (Fase 5 / optional per the roadmap).
5. **`05-daily-alerts.json`** — optional daily proactive check (budget categories already at/
   over threshold, overdue Hutang Piutang entries), sent unprompted if there's anything to flag.

## Required credentials

Create these in n8n's own Credentials store (never paste tokens into node parameters). Names
must match what's referenced in the workflow JSON's `credentials` blocks, and are listed in
`config/env.example`:

| Credential name | Type | Used for |
|---|---|---|
| `Finxxment Telegram Bot` | Telegram API | Trigger + all Telegram send/get-file nodes |
| `Finxxment Gemini API` | HTTP Header Auth (`x-goog-api-key`) or Google PaLM/Gemini credential if your n8n version has a native node | Text/vision extraction, scheduled insight |
| `Finxxment Google Sheets` | Google Sheets OAuth2 | All Sheets read/append/update/delete nodes |
| `Finxxment Google Drive` | Google Drive OAuth2 | Proof-photo upload, monthly xlsx export |

## Every workflow starts with a "Config" node

Each workflow's first (or near-first) node is a `Set` node named **Config** holding
non-secret values as plain fields: `SPREADSHEET_ID`, `OWNER_CHAT_ID`, `DRIVE_PROOF_FOLDER_ID`,
`WEBAPP_URL`, `WEBAPP_SECRET`. Downstream nodes reference these via
`{{$node["Config"].json.FIELD_NAME}}` instead of hardcoding values in every node. After
importing, open each workflow's Config node and replace every `REPLACE_ME_*` placeholder — see
`docs/02-setup-guide.md` for where each value comes from.

## Why a separate clarification workflow

n8n's Telegram Trigger starts a brand-new, independent execution for every incoming message —
there's no built-in way to pause execution 1 and resume it when the user's *next* message
arrives. Workflow 01 checks a `Pending Transaksi` sheet (via the Apps Script web app) for an
open entry before routing a message anywhere else; if one exists, it calls workflow 02 instead
of normal command/transaction handling. Full design and state diagram:
`docs/04-mismatch-clarification-design.md`.

## Gemini prompts live in `n8n/prompts/`

The HTTP Request nodes that call Gemini reference prompt text that should be pasted from
`n8n/prompts/*.md` into the node (or into a Config field the node reads). They aren't fetched
at runtime. If you edit a prompt, remember to re-paste it into the corresponding node.

## `/undo` and `/edit` notes

- `/undo`'s "Sheets: Find Last Row" node reads the whole `Transaksi` sheet; pick the last item
  (`$input.all().pop()`) before the delete step — add a small Code node if your n8n Google
  Sheets node version doesn't already return `row_number` per row.
- `/edit <id> field=value` writes directly; `/edit <id>` with no fields creates a
  `Pending Transaksi` row (type `edit-needs-field`) and asks what to change, resolved by
  workflow 02.

## `/hutang`, `/goal`, `/cari`, and the proactive budget alert

- `/hutang` (list), `/hutang tambah <piutang|utang> <nama> <nominal> [jatuh_tempo]`, and
  `/hutang lunas <id>` manage the `Hutang Piutang` sheet directly from Telegram — see
  `docs/01-sheets-schema.md`.
- `/goal` (list progress) and `/goal tambah <nama> <target> [tanggal_target]` manage the
  `Tabungan Goals` sheet. Progress isn't entered manually: log a normal transaction with
  `Kategori = Tabungan/Investasi` and `Sub-kategori` matching the goal's exact name, and the
  goal's `Nominal Terkumpul`/`Progress %` formulas (from `apps-script/00-bootstrap-provision.gs`)
  pick it up automatically.
- `/cari <keyword>` searches `Tujuan/Merchant` and `Catatan` on `Transaksi` via
  `apps-script/40-webhook-api.gs`'s `search` action.
- After every successful `Google Sheets: Append Row` in the transaction branch, a parallel
  "HTTP: Budget Check" call warns the user immediately if that category just crossed 80%/100%
  of its monthly budget, instead of only surfacing it on the next `/laporan` or Dashboard
  refresh.
