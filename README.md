# Finxxment

Personal finance automation: Telegram bot input → Gemini AI extraction/verification → Google
Sheets storage & dashboard → Telegram confirmation, orchestrated in n8n.

```
Telegram Bot (input) → AI Verification (Gemini) → Google Sheets (storage + report) → Telegram Bot (confirmation)
```

This repo contains the importable/reviewable artifacts for the system — n8n workflow exports,
Google Apps Script, and setup docs — not a running deployment. Nothing here talks to a real
Telegram bot, Gemini key, or Google account until you provision them yourself.

## Start here

1. **`docs/00-overview-architecture.md`** — how the pieces fit together.
2. **`docs/02-setup-guide.md`** — step-by-step: Google Sheet, Apps Script, Telegram bot,
   Gemini key, n8n credentials, importing workflows.
3. **`docs/05-build-order-fase-1-to-5.md`** — bring the system up incrementally, phase by
   phase, instead of all at once.
4. **`docs/06-verification-checklist.md`** — what to test once it's live.
5. **`docs/07-sheet-formulas-and-formatting.md`** — the Sheet's visual design and a set of real
   formula bugs found and fixed (read this before adding a new computed column).

## Layout

| Path | Contents |
|---|---|
| `n8n/workflows/` | 5 n8n workflow JSON exports (main input handler, clarification handler, scheduled report, monthly xlsx export, daily proactive alerts) |
| `n8n/prompts/` | Gemini prompt text, pasted into the corresponding n8n nodes |
| `apps-script/` | Sheets-side automation: bootstrap provisioning, visual formatting, the in-sheet Panduan tab, dashboard layout/charts, saldo/burn-rate, budget vs actual, hutang piutang, savings goals, a webhook API n8n calls into, and trigger/menu registration |
| `config/` | Canonical category/sumber-dana lists and tolerance settings (also duplicated into prompts and Apps Script — see `docs/03-category-sumber-dana-config.md`) |
| `docs/` | Architecture, Sheets schema, setup guide, category config notes, the mismatch/clarification state-machine design, sheet formulas & formatting rationale, build order, and the verification checklist |

## Feature summary

- **Input**: natural-language text, text + proof photo, multi-transaction messages, shorthand
  nominal ("50rb"/"50k"/"1jt")
- **AI verification**: Gemini text extraction + Gemini Vision cross-check of proof photos, with
  a clarification flow for low-confidence or mismatched data, and a never-lose-data fallback if
  Gemini itself fails
- **Commands**: `/laporan`, `/saldo`, `/undo`, `/edit`, `/kategori`, `/hutang`, `/goal`,
  `/cari`, `/help`
- **Reporting**: cash flow, category/sumber-dana breakdown, real-time saldo, 6-month trend,
  top-5 categories, burn rate + month-end projection, budget vs actual — all on an
  auto-refreshing Dashboard sheet
- **Proactive alerts**: instant Telegram warning when a transaction pushes a category past
  80%/100% of its budget, plus an optional daily digest of every over-budget category and
  overdue Hutang Piutang entry
- **Debt & receivable tracking**: `/hutang` for utang/piutang with due dates and paid status
- **Savings goals**: `/goal` with progress computed automatically from tagged transactions
- **Automation extras**: unprompted weekly/monthly recap, monthly `.xlsx` export
- **Security**: owner-chat-id whitelist, private Drive folder for proof photos, all secrets in
  n8n Credentials (never hardcoded)
- **Presentation**: every sheet is fully formatted (colored headers, Rupiah/date/percent number
  formats, conditional-formatting status colors, row banding, a text progress bar for savings
  goals) and a `📖 Panduan` guide tab is pinned as the first tab explaining every sheet and
  command in-place — see `docs/07-sheet-formulas-and-formatting.md`

## Fixed categories & payment sources

Categories: Makan & Minum, Transportasi, Kos/Tempat Tinggal, Kuliah/Akademik, Produksi/Event,
Peralatan, Hiburan/Hobi, Kopi/Espresso Setup, Kesehatan, Belanja Pribadi, Transfer/Pinjam,
Tabungan/Investasi, Lain-lain.

Sumber dana: Cash, QRIS, Debit, E-wallet, Transfer Bank, Kredit.

See `config/categories.json` / `config/sumber-dana.json` for the machine-readable versions.
