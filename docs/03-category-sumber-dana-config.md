# Category & Sumber Dana Config

The fixed category and sumber-dana lists are duplicated in three places, on purpose, because
neither n8n Code nodes nor Apps Script can read arbitrary repo files at runtime:

1. **`config/categories.json`** / **`config/sumber-dana.json`** — the canonical reference,
   including subkategori hints and keyword aliases used for documentation and any future
   tooling that *can* read the repo (e.g. a build script).
2. **`n8n/prompts/gemini-text-extraction.md`** — the same labels, inlined into the prompt text
   pasted into the Gemini Text-Extraction node, so the model knows the exact fixed vocabulary
   to map user input onto.
3. **`apps-script/00-bootstrap-provision.gs`** — the same labels, hardcoded as the `CATEGORIES`
   and `SUMBER_DANA` arrays used to build the `Kategori` / `Sumber Dana` dropdown validation on
   the `Transaksi` sheet, and to seed the `Budget` / `Saldo Awal` sheets.

**When adding, renaming, or removing a category or sumber dana value, update all three
locations together**, then re-run `provisionFinxxmentSheets()` (it's idempotent — re-running
won't duplicate sheets, but changing the hardcoded arrays and re-running does update the
dropdown validation ranges) and re-paste the updated prompt into the n8n node.

The static `/kategori` command reply in `n8n/workflows/01-main-input-handler.json` (node
"Telegram: Send Kategori List") is also a plain string mirroring these lists — a fourth spot,
but a low-risk one since it's just informational text with no validation behavior tied to it.
