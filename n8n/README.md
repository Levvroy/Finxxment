# n8n Workflows

Five workflow exports, meant to be imported into your own n8n instance (n8n > Workflows >
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

## Switch node gotcha: `fallbackOutput` must live inside `options`

Both `Switch: Route Message` and `Switch: Hutang Mode` route on named rules
(`mode: "rules"`) plus a catch-all "everything else" output for plain transaction text /
the bare `/hutang` list request. In n8n's actual `SwitchV3` node, that catch-all setting —
`fallbackOutput: "extra"` — **must be nested inside the node's `options` collection**:

```json
"parameters": {
  "mode": "rules",
  "rules": { "values": [ ... ] },
  "options": { "fallbackOutput": "extra", "renameFallbackOutput": "transaksi" }
}
```

Putting `fallbackOutput` as a top-level key (a sibling of `rules`, outside `options`) is a
subtle, easy mistake — the node still imports and runs without any error, the execution shows
**Succeeded**, but n8n's `execute()` reads `options.fallbackOutput`, finds nothing there,
silently defaults to `'none'`, and drops every item that doesn't match a named rule. The
symptom is exactly "the Switch node succeeds but nothing downstream ever lights up" for the
most common case (plain transaction text) — this is precisely the bug that shipped in an
earlier version of `01-main-input-handler.json` and was only caught by checking n8n's actual
`SwitchV3.node.ts` source, not by JSON schema/connection validation alone (a connection to the
fallback output can be wired correctly and still never fire if this option is misplaced). If
you add another Switch node with a fallback output, double-check this placement.

## HTTP Request body gotcha: avoid `specifyBody: "json"` + `jsonBody` for expression-built bodies

`Gemini: Text Extraction` and `Gemini: Vision Extraction` build their request body from an
expression rather than a static value. Two things went wrong here, in order, on n8n Cloud
2.28.7 — worth documenting fully since neither failure was visible from the JSON alone:

1. **The bare `{{ {...} }}` object-literal shortcut is unreliable.** The HTTP Request node's
   `jsonBody` field (`specifyBody: "json"`) has a documented shortcut: if the field's *entire*
   value is one `{{ ... }}` expression that evaluates to a JS object, n8n is supposed to use
   the object directly instead of requiring a JSON string. On this instance it resolved to the
   literal string `"undefined"` instead, which then failed with `The value in the "JSON Body"
   field is not valid JSON` / `"undefined" is not valid JSON`.
2. **Wrapping in `JSON.stringify(...)` inside `jsonBody` still wasn't enough.** The obvious fix
   — `={{ JSON.stringify({ "contents": [...] }) }}`, which always evaluates to a plain string —
   still hit the exact same error. `jsonBody`'s declared parameter type is `"json"` (not
   `"string"`), and something in how this n8n version resolves whole-expression values for a
   `"json"`-typed field discarded the result before the node's own code ever saw it — the field
   type itself was the problem, not the expression.

The actual fix was to stop using `specifyBody: "json"` / `jsonBody` altogether and switch the
node to **`contentType: "raw"`**, which uses a completely different, much simpler code path in
the HTTP Request node (`requestOptions.body = body` — no `JSON.parse` involved at all) and
reads from the plain **`"string"`-typed** `body` field instead:

```json
"parameters": {
  "sendBody": true,
  "contentType": "raw",
  "rawContentType": "application/json",
  "body": "={{ $json.geminiTextRequestBody }}"
}
```

For `Gemini: Text Extraction`, the request body is now built in a preceding **Code node**
(`Code: Build Gemini Text Body`) as plain, unambiguous JavaScript, ending in
`JSON.stringify(...)`, and written onto the item as a single string field
(`geminiTextRequestBody`). The HTTP node's `body` field then does nothing more than reference
that one field — the simplest, most common expression pattern in n8n (reference a single
upstream value), deliberately chosen because it can't hit the same "whole-field-expression on a
non-string-typed parameter" edge case. `Gemini: Vision Extraction` keeps its body construction
inline (a Code node can't easily reach binary data the same way without extra risk) but still
moved from `jsonBody`/`specifyBody:"json"` to `contentType:"raw"` + `body`, which was the actual
fix — the `JSON.stringify(...)` wrap by itself is necessary but not sufficient.

If you add another HTTP Request node whose body is built from an expression (not typed by
hand), prefer `contentType: "raw"` + a plain-string `body` field over `specifyBody: "json"` +
`jsonBody`, and where practical build the body in a preceding Code node so the HTTP node's own
field is just a one-field reference.

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
