# Mismatch / Clarification Design

## The problem

n8n's Telegram Trigger starts a brand-new, independent execution for every incoming message.
There is no built-in way to pause execution A (processing "keluar 50000 makan siang qris")
and resume it when the user's *next* message arrives — that next message triggers a completely
separate execution B with no memory of A.

But the bot needs exactly that: when the AI extraction is low-confidence, or a photo mismatch
is detected, or `/edit <id>` is sent with no fields, the bot must ask a question and then
interpret the user's *next* message as the answer to that specific question — not as a new
transaction or command.

## The solution: a durable "Pending Transaksi" sheet

Since there's no Redis/Postgres provisioned (nothing beyond n8n + Google Sheets + Telegram +
Gemini), the pending/waiting state is stored as rows in a dedicated sheet, keyed by chat id.
Schema: `docs/01-sheets-schema.md` → `Pending Transaksi`.

## State diagram

```
                 ┌──────────────┐
   new message → │ has pending  │ ── no ──→ normal command/transaction routing
                 │ row for this │
                 │   chat id?   │
                 └──────┬───────┘
                        │ yes
                        ▼
              ┌───────────────────┐
              │ 02-clarification- │
              │ handler.json       │
              └─────────┬─────────┘
                        │
         ┌──────────────┼──────────────────┐
         ▼              ▼                  ▼
   low-confidence     mismatch      edit-needs-field
         │              │                  │
         ▼              ▼                  ▼
   interpret reply  interpret reply   interpret "field=value"
   (fill missing     ("teks"/"bukti"/  reply
   nominal/field)     corrected number)
         │              │                  │
         └──────┬───────┴──────────┬───────┘
                ▼ resolved          ▼ not resolved
        write/patch Transaksi   increment Retry Count
        row, mark Pending       │
        Status=Resolved         ▼
        Telegram: confirm    retryCount >= MAX_RETRIES (3)?
                                │              │
                            yes │              │ no
                                ▼              ▼
                        mark Pending      Telegram: ask again
                        Status=Expired    (same pending row)
                        Telegram: tell
                        user to re-enter
```

## Sequence, main workflow (`01-main-input-handler.json`)

1. Telegram Trigger fires.
2. Owner whitelist IF (non-owner → silently ignored).
3. **HTTP Request: Check Pending** calls `apps-script/40-webhook-api.gs`
   `?action=pendingLookup&chatId=<id>`, which scans `Pending Transaksi` for the newest row with
   that chat id and `Status = Waiting`.
4. **IF Has Pending** — true branch → **Execute Workflow: Clarification Handler**, passing
   `{chatId, incomingText: message.text, pendingRow}`. False branch → normal `Switch: Route
   Message` (commands / plain transaction).

## Sequence, clarification workflow (`02-clarification-handler.json`)

1. **Execute Workflow Trigger** receives `{chatId, incomingText, pendingRow}`.
2. **Switch: Pending Type** on `pendingRow.Type`.
3. Each branch's Code node (`Code: Interpret Low-Confidence Reply` / `...Mismatch Reply` /
   `...Edit Reply`) parses `incomingText` against the specific question that was asked
   (stored in `pendingRow['Raw Payload']` / `Question Asked`), and returns `resolved: true/false`
   plus a patched `payload`.
4. **IF Resolved** — true → finalize:
   - low-confidence / mismatch → **Code: Finalize Transaksi Row** → append to `Transaksi` →
     mark the `Pending Transaksi` row `Status=Resolved` → Telegram confirmation.
   - edit-needs-field → **Sheets: Update Edited Row** directly (matching on `ID`) → mark
     `Pending Transaksi` row `Status=Resolved` → Telegram confirmation.
5. **IF Resolved** — false → **Code: Increment Retry / Check Cap**:
   - `forceExpire` (unrecognized pending type, defensive fallback) or `retryCount >=
     MAX_RETRIES` (default 3, set in workflow 02's Config node) → mark
     `Status=Expired`, tell the user to re-enter the transaction from scratch.
   - otherwise → increment `Retry Count` on the pending row, re-ask the same question.

## Why this design and not alternatives

- **n8n's `Wait` node** can pause a single execution for a fixed duration or a webhook
  callback, but it can't discriminate "is the next incoming Telegram message the reply to
  *this specific* pending question, or an unrelated new message/command?" — the sheet-based
  check handles that discrimination explicitly and generically for all three pending types.
- **In-memory/static-data approaches** (n8n workflow static data) are per-workflow and not
  reliably queryable by chat id across concurrent executions the way a Sheets row is.
- If you later add Redis/Postgres, you can swap the pending-store implementation behind the
  same `pendingLookup` / resolve / expire contract without changing the Telegram-facing
  workflow logic — the Apps Script web app is a convenient existing seam for that swap.
