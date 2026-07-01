# Setup Guide

Ordered runbook to turn these artifacts into a working system. Nothing here has been run yet —
follow it top to bottom the first time.

1. **Create the Google Sheet.** Make a new blank Google Sheet. Note its ID from the URL
   (`https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`) — this is `SPREADSHEET_ID`.

2. **Provision the sheet structure.** Extensions > Apps Script. Create the files under
   `apps-script/` in this repo as matching files in the Apps Script project (same filenames,
   paste the contents), plus `appsscript.json` via Project Settings > "Show appsscript.json in
   editor". Run `provisionFinxxmentSheets` once, authorize the requested scopes. Reload the
   Sheet — you should see `Transaksi`, `Pending Transaksi`, `Saldo Awal`, `Budget`,
   `Log Error`, `Hutang Piutang`, `Tabungan Goals`, `Dashboard`, a `📖 Panduan` tab pinned first
   with a full in-sheet guide, all fully formatted (colors, currency formats, conditional
   formatting — see `docs/07-sheet-formulas-and-formatting.md`), plus a new "Finxxment" menu
   (from `90-triggers.gs`'s `onOpen`).

3. **Set the webhook shared secret.** In the Apps Script project: Project Settings > Script
   Properties > Add property `SHARED_SECRET` with a random value you generate yourself. This
   becomes `APPS_SCRIPT_WEBAPP_SECRET`.

4. **Deploy the Apps Script web app.** Deploy > New deployment > type "Web app" > execute as
   "Me" > access "Anyone". Copy the `/exec` URL — this is `APPS_SCRIPT_WEBAPP_URL`.

5. **Install the daily Dashboard trigger.** From the Sheet's "Finxxment" menu, click
   "Install Triggers".

6. **Create the Telegram bot.** Message `@BotFather` on Telegram, `/newbot`, follow the
   prompts, save the token it gives you (this goes into n8n's Telegram credential, never into
   workflow JSON). Then send `@BotFather` `/setcommands` for your bot and paste:
   ```
   laporan - Ringkasan transaksi (harian/mingguan/bulanan)
   saldo - Cek saldo per sumber dana
   undo - Batalkan transaksi terakhir
   edit - Edit transaksi tertentu
   kategori - Daftar kategori yang tersedia
   hutang - Kelola utang/piutang
   goal - Kelola target tabungan
   cari - Cari transaksi
   help - Panduan penggunaan bot
   ```

7. **Get your Telegram chat id (owner whitelist).** Send your new bot any message, then check
   `https://api.telegram.org/bot<TOKEN>/getUpdates` for `message.chat.id`, or use a helper bot
   like `@userinfobot`. This is `TELEGRAM_OWNER_CHAT_ID` — the only chat id the workflows will
   respond to.

8. **Get a Gemini API key.** Google AI Studio > "Get API key". This is used by an HTTP Header
   Auth credential in n8n (header `x-goog-api-key`) or a native Gemini/PaLM credential if your
   n8n version has one.

9. **Set up Google OAuth for n8n (Sheets + Drive).** In n8n, create credentials
   `Finxxment Google Sheets` (Google Sheets OAuth2 API) and `Finxxment Google Drive` (Google
   Drive OAuth2 API), following n8n's standard Google OAuth setup (Google Cloud Console project,
   OAuth consent screen, redirect URI from n8n's credential screen).

10. **Create a private Drive folder for proof photos.** In Google Drive, make a folder, keep
    sharing private (only you), note its ID from the URL — this is `DRIVE_PROOF_FOLDER_ID`.

11. **Import the workflows into n8n**, in this order (see `n8n/README.md` for details):
    `02-clarification-handler.json`, then `01-main-input-handler.json` (paste workflow 02's id
    into workflow 01's Execute Workflow node), then optionally `03-scheduled-report.json`,
    `04-export-xlsx-berkala.json`, and `05-daily-alerts.json`.

12. **Create the 4 n8n credentials** listed in `config/env.example` with those exact names.

13. **Fill in every workflow's "Config" Set node**: `OWNER_CHAT_ID`, `SPREADSHEET_ID`,
    `DRIVE_PROOF_FOLDER_ID`, `WEBAPP_URL`, `WEBAPP_SECRET` (from steps 1, 4, 7, 10 above).

14. **Paste the Gemini prompts.** Copy the content of `n8n/prompts/gemini-text-extraction.md`
    and `gemini-vision-extraction.md` into the corresponding Gemini HTTP Request nodes in
    workflow 01 (and `gemini-scheduled-insight.md` into workflow 03, if used).

15. **Activate the workflows** and run through `docs/06-verification-checklist.md`.
