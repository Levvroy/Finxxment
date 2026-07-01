# Verification Checklist

## What was verified when these artifacts were authored (no live n8n/bot/Sheet existed)

- All 4 files under `n8n/workflows/*.json` and all `config/*.json` files parse as valid JSON
  (`python3 -m json.tool`).
- Every node name referenced in each workflow's `connections` block exists in that workflow's
  `nodes` array (no dangling wires).
- Grep across `n8n/` and `apps-script/` for secret-shaped strings (long base64/hex, Telegram
  bot-token pattern `\d+:[A-Za-z0-9_-]{35}`, Gemini `AIza...` keys) turned up none — only
  `REPLACE_ME_*` / `PLACEHOLDER` placeholders are committed.
- Every `.gs` file under `apps-script/` passes a `node --check` syntax smoke test (copied to a
  scratch `.js` file first, not run against the real repo).
- The category list is identical (same 13 items) across `config/categories.json`,
  `n8n/prompts/gemini-text-extraction.md`, and the `CATEGORIES` array in
  `apps-script/00-bootstrap-provision.gs`.

None of this proves the system actually works end to end — that requires real credentials and
a running n8n instance, which is out of scope for this session.

## Manual test checklist (run this after completing `docs/02-setup-guide.md`)

- [ ] Send `/help` — bot replies with the static usage text.
- [ ] Send `/kategori` — bot replies with the category/sumber-dana list.
- [ ] Send a clear, high-confidence transaction (e.g. "keluar 50000 makan siang qris") —
  confirm a row appears in `Transaksi` with all columns populated correctly and the
  confirmation message matches the format `Tercatat: Rp<nominal> - <tujuan> - <sumber_dana> -
  <tanggal>`.
- [ ] Send an ambiguous message with no nominal (e.g. "abis makan tadi") — confirm the bot asks
  for clarification, a `Pending Transaksi` row is created with `Type=low-confidence` and
  `Status=Waiting`; reply with just a number — confirm the transaction completes and the
  pending row flips to `Resolved`.
- [ ] Send text + a proof photo where the amounts match — confirm `Status Verifikasi=Verified`,
  a Drive link is present, and the photo actually lands in the private folder (not a public
  one).
- [ ] Send text + a proof photo with a deliberately different amount — confirm the mismatch
  clarification message appears, no row is written to `Transaksi` yet, and no
  `Pending Transaksi` row is left dangling after you resolve it (reply "teks", "bukti", or a
  corrected number).
- [ ] Temporarily break the Gemini credential (e.g. revoke the API key) and send a transaction
  — confirm it still lands in `Transaksi` with `Status Verifikasi=Perlu Review Manual` instead
  of silently failing or the message being dropped.
- [ ] Send two transactions in one message (e.g. "keluar 20000 parkir sama 15000 minum") —
  confirm two separate rows are created.
- [ ] Send `/saldo` — confirm the reply shows a plausible balance per sumber dana.
- [ ] Send `/laporan bulan ini` — confirm totals and top categories look right against what's
  actually in `Transaksi`.
- [ ] Send `/undo` — confirm the most recent row is removed and the bot confirms which one.
- [ ] Send `/edit <id> nominal=60000` — confirm the target row updates; send `/edit <id>` with
  no fields — confirm the bot asks what to change, then resolve it via a follow-up reply.
- [ ] Open the Sheet, run "Finxxment > Refresh Dashboard Now" — confirm all 5 charts render
  and the saldo/burn-rate/budget-vs-actual numbers look sane.
- [ ] Wait for (or manually trigger) `03-scheduled-report.json` and `04-export-xlsx-berkala.json`
  — confirm Telegram receives the recap message and the `.xlsx` document respectively.
- [ ] From a chat id that is *not* the whitelisted owner, send any message — confirm the bot
  gives no reply at all and nothing is written anywhere.
- [ ] Set a low `Budget Bulanan` for one category, then log a transaction that pushes it past
  80% and another past 100% — confirm an immediate Telegram warning fires each time (not just
  on `/laporan`).
- [ ] `/hutang tambah utang Budi 50000 2026-06-01` (a past date) — confirm a row appears in
  `Hutang Piutang` with `Status=Belum Lunas`; send `/hutang` — confirm it's listed; send
  `/hutang lunas <id>` — confirm status flips to `Lunas`.
- [ ] `/goal tambah Kamera 5000000` — confirm a row appears in `Tabungan Goals`; log a
  transaction with `Kategori=Tabungan/Investasi` and `Sub-kategori=Kamera` — confirm
  `Nominal Terkumpul`/`Progress %` update automatically; send `/goal` — confirm the progress
  message reflects it.
- [ ] `/cari <keyword yang ada di transaksi lama>` — confirm matching rows come back.
- [ ] Wait for (or manually trigger) `05-daily-alerts.json` with at least one over-budget
  category or overdue hutang piutang entry present — confirm a summary message arrives; with
  none present, confirm it stays silent.
