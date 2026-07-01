# Google Sheets Schema

This is the human-readable reference. The executable source of truth is
`apps-script/00-bootstrap-provision.gs` — run `provisionFinxxmentSheets()` once against a blank
spreadsheet and it creates every sheet below with the exact headers, dropdowns, and formulas.
If you ever edit this doc, update the bootstrap script to match (and vice versa).

## Sheet: `Transaksi` (main ledger)

| # | Column | Type | Notes |
|---|---|---|---|
| 1 | ID | string (UUID) | Primary key, used by `/edit` and `/undo` |
| 2 | Timestamp Input | datetime | When the system received/processed the message |
| 3 | Tanggal Transaksi | date | Actual transaction date |
| 4 | Jenis | dropdown: Keluar / Masuk | |
| 5 | Nominal | number (IDR) | |
| 6 | Kategori | dropdown, 13 fixed values | See `config/categories.json` |
| 7 | Sub-kategori | string | Optional, freer-form detail |
| 8 | Tujuan/Merchant | string | Description / recipient / merchant |
| 9 | Sumber Dana | dropdown: Cash / QRIS / Debit / E-wallet / Transfer Bank / Kredit | See `config/sumber-dana.json` |
| 10 | Nama Rekening/Wallet | string | e.g. "BCA", "GoPay" |
| 11 | Catatan | string | Free text, also used to append mismatch/date-warning annotations |
| 12 | Bukti (link) | URL | Google Drive link to the proof photo, if any |
| 13 | Status Verifikasi | dropdown: Verified / Unverified / Mismatch-Resolved / Perlu Review Manual | |
| 14 | Confidence AI | string: high / medium / low / n/a - API error | |
| 15 | Sumber Input | string: Telegram Text / Telegram Text+Foto | |
| 16 | Tag Bulan | formula (`ARRAYFORMULA` + `TEXT(...,"YYYY-MM")`) | For monthly pivots/charts |
| 17 | Tag Minggu | formula (`ARRAYFORMULA` + `WEEKNUM(...)`) | For weekly aggregation |

## Sheet: `Pending Transaksi` (clarification state store)

Added beyond the original spec to make the mismatch/clarification flow durable across
independent n8n executions — see `docs/04-mismatch-clarification-design.md`.

| Column | Notes |
|---|---|
| Chat ID | Telegram chat id this pending entry belongs to |
| Pending ID | UUID |
| Created At | ISO timestamp |
| Type | `low-confidence` / `mismatch` / `edit-needs-field` |
| Raw Payload | JSON string: everything extracted so far (text extraction, vision extraction, original message, partial edit target) |
| Question Asked | The exact clarification question sent to the user, for reference/logging |
| Status | `Waiting` / `Resolved` / `Expired` |
| Retry Count | Number of clarification attempts so far |
| Expires At | Reserved for future TTL-based cleanup |

## Sheet: `Saldo Awal`

| Column | Notes |
|---|---|
| Sumber Dana | One row per fixed sumber dana value |
| Nama Rekening/Wallet | Optional label, e.g. "BCA", "Cash Dompet" |
| Saldo Awal | Baseline balance (IDR) used as the starting point for real-time saldo calculation |

## Sheet: `Budget` (optional, used by Budget vs Actual)

| Column | Notes |
|---|---|
| Kategori | One row per fixed category |
| Budget Bulanan | Monthly budget amount (IDR); leave blank/0 if not tracked |

## Sheet: `Log Error` (recommended, for debugging the n8n workflows)

| Column | Notes |
|---|---|
| Timestamp | ISO timestamp |
| Chat ID | |
| Workflow/Node | Which workflow/node logged this |
| Error Type | `Gemini Mismatch` / `Gemini API Failure` / `Sheets Write Failure` / `Unknown` |
| Raw Payload | JSON string of the offending data |
| Resolved | Y/N |

## Sheet: `Hutang Piutang` (debt & receivable tracker)

Added to give the `Transfer/Pinjam` category structured follow-up (who owes whom, due date,
paid status), managed via the `/hutang` Telegram command.

| Column | Notes |
|---|---|
| ID | Numeric/string id |
| Tanggal | Date the entry was created |
| Arah | dropdown: `Piutang` (orang lain berhutang ke saya) / `Utang` (saya berhutang) |
| Nama Pihak | Who the debt/receivable is with |
| Nominal | IDR amount |
| Jatuh Tempo | Due date, optional |
| Status | dropdown: `Belum Lunas` / `Lunas` |
| Catatan | Free text |

## Sheet: `Tabungan Goals` (savings goal tracker)

Managed via the `/goal` command. A contribution toward a goal is just a normal `Transaksi` row
with `Kategori = Tabungan/Investasi` and `Sub-kategori` set to the goal's exact name — progress
is computed automatically, not entered by hand.

| Column | Notes |
|---|---|
| Nama Goal | Must match the `Sub-kategori` used on contributing `Transaksi` rows |
| Target Nominal | Goal amount (IDR) |
| Tanggal Target | Optional target date |
| Sumber Dana | Optional, which account the savings sit in |
| Nominal Terkumpul | Formula (`SUMIFS` against `Transaksi`), auto-computed |
| Progress % | Formula, auto-computed from Nominal Terkumpul / Target Nominal |
| Status | dropdown: `Berjalan` / `Tercapai` (auto-set at 100% by `calculateSavingsGoals()`) / `Dibatalkan` |

## Sheet: `Dashboard` (generated, not manually edited)

Not a fixed-column table — `apps-script/10-dashboard-charts.gs`, `20-saldo-burnrate.gs`,
`30-budget-vs-actual.gs`, `50-hutang-piutang.gs`, and `60-savings-goals.gs` write summary blocks
into a fixed row layout (see `apps-script/05-dashboard-layout.gs`: saldo per sumber dana, burn
rate, budget vs actual, hutang piutang totals, savings goals progress — all in columns A-E) and
five charts (cash flow, kategori pie, sumber dana pie, 6-month trend line, top-5 categories
bar), whose QUERY helper formulas live in a separate column band (from column O onward) so they
never spill into the text blocks. Refreshed daily by a time-driven trigger, or on demand via the
"Finxxment > Refresh Dashboard Now" menu item.
