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

## Layout

| Path | Contents |
|---|---|
| `n8n/workflows/` | 4 n8n workflow JSON exports (main input handler, clarification handler, scheduled report, monthly xlsx export) |
| `n8n/prompts/` | Gemini prompt text, pasted into the corresponding n8n nodes |
| `apps-script/` | Sheets-side automation: bootstrap provisioning, dashboard charts, saldo/burn-rate, budget vs actual, a small webhook API n8n calls into, and trigger/menu registration |
| `config/` | Canonical category/sumber-dana lists and tolerance settings (also duplicated into prompts and Apps Script — see `docs/03-category-sumber-dana-config.md`) |
| `docs/` | Architecture, Sheets schema, setup guide, category config notes, the mismatch/clarification state-machine design, build order, and the verification checklist |

## Fixed categories & payment sources

Categories: Makan & Minum, Transportasi, Kos/Tempat Tinggal, Kuliah/Akademik, Produksi/Event,
Peralatan, Hiburan/Hobi, Kopi/Espresso Setup, Kesehatan, Belanja Pribadi, Transfer/Pinjam,
Tabungan/Investasi, Lain-lain.

Sumber dana: Cash, QRIS, Debit, E-wallet, Transfer Bank, Kredit.

See `config/categories.json` / `config/sumber-dana.json` for the machine-readable versions.
