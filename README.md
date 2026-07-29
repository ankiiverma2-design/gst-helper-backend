# GST Helper — Backend API

A backend for a **GST filing & reconciliation helper for small Indian sellers**.

The core value is **ITC reconciliation**: it compares a seller's purchase
register (their books) against their **GSTR-2B** (the auto-drafted statement of
available Input Tax Credit, downloaded from the government portal) and tells them
exactly:

- which ITC is **safe to claim** (matched),
- which is **at risk** (in books, but the supplier hasn't filed → not in 2B),
- where amounts **don't match**, and
- ITC they **forgot to record** (in 2B, not in books).

It also computes a **GSTR-3B** monthly summary and exports **GSTR-1** JSON in the
government offline-utility format.

> ⚠️ **Compliance note:** This tool *prepares* and *reconciles* returns. It does
> **not** file them directly with the government. Direct filing to the GST
> Network (GSTN) requires a licensed **GSP (GST Suvidha Provider)** integration,
> which you add later. Until then, the seller (or their CA) uploads the generated
> JSON to the official GST portal themselves. This preparation-and-reconciliation
> path is fully legal and needs no licence.

---

## Why zero dependencies?

The whole backend uses only **Node's built-in modules** (`node:http`,
`node:test`). No `npm install` is required to run it — just Node ≥ 22.6. That
makes it trivial to deploy on any free host and keeps the attack surface tiny.

`@types/node` and `typescript` are listed as devDependencies purely so
`npm run typecheck` works on a normal machine; they are not needed at runtime.

---

## Run it

```bash
# Start the API (default port 3000, override with PORT)
npm start
# or during development, with auto-reload:
npm run dev

# Run the test suite (9 tests covering the reconciliation logic)
npm test
```

---

## API contract

All responses are JSON. CORS is open (`Access-Control-Allow-Origin: *`) so a
browser frontend on any domain (e.g. your Lovable app) can call it.

### `GET /health`
Liveness check.

### `GET /api/sample`
Returns realistic sample `purchaseRegister`, `gstr2b`, and `sales` you can use to
build and test the frontend before real data exists.

### `POST /api/reconcile`
The core endpoint. Compare books against GSTR-2B.

**Request body:**
```json
{
  "purchaseRegister": [ /* Invoice[] */ ],
  "gstr2b":           [ /* Invoice[] */ ],
  "options": { "amountTolerance": 2 }
}
```

**An `Invoice` looks like:**
```json
{
  "supplierGstin": "27AABCU9603R1ZM",
  "supplierName": "Mumbai Packaging Supplies",
  "invoiceNo": "MPS/2026/104",
  "invoiceDate": "2026-07-05",
  "tax": { "taxableValue": 50000, "cgst": 4500, "sgst": 4500, "igst": 0, "cess": 0 },
  "itcEligible": true
}
```

**Response:** a `ReconciliationReport`:
```json
{
  "summary": {
    "totalInvoicesInBooks": 4,
    "totalInvoicesIn2B": 4,
    "exactMatches": 2,
    "mismatches": 1,
    "missingIn2B": 1,
    "missingInBooks": 1,
    "itcAsPerBooks": 34200,
    "itcAsPer2B": 34140,
    "itcClaimableNow": 30000,
    "itcAtRisk": 3600,
    "itcUnclaimed": 2700
  },
  "lines": [ /* per-invoice results with status + a plain-English note */ ],
  "options": { "amountTolerance": 2 }
}
```

Each line's `status` is one of: `EXACT_MATCH`, `MISMATCH`, `MISSING_IN_2B`,
`MISSING_IN_BOOKS`.

### `POST /api/gstr3b`
Compute the monthly summary. ITC is netted head-wise against output tax and
floored at zero per head.

**Request body:** `{ "sales": Invoice[], "eligiblePurchases": Invoice[] }`
(pass the matched + eligible purchases from reconciliation as `eligiblePurchases`).

### `POST /api/gstr1`
Generate portal-ready GSTR-1 JSON.

**Request body:**
```json
{
  "supplierGstin": "27AAAAA0000A1Z5",
  "filingPeriod": "072026",
  "b2bSales": [ /* Invoice + buyerGstin + placeOfSupply */ ],
  "b2csSales": [ /* optional aggregated B2C rows */ ]
}
```

---

## How the matching works

1. Invoices are keyed by **supplier GSTIN + normalized invoice number**.
   Normalization uppercases and strips separators, so `MPS/2026/104` and
   `MPS-2026-104` match. Purely numeric leading zeros are dropped (`0012` → `12`).
2. When an invoice is found in both, tax amounts are compared within a rupee
   **tolerance** (default ₹2) to absorb rounding. Within tolerance ⇒
   `EXACT_MATCH`, otherwise `MISMATCH`.
3. **Eligibility** (`itcEligible: false` for blocked credits under Sec 17(5),
   personal use, etc.) is treated separately from matching: an ineligible
   invoice can still *match* 2B, but its ITC is excluded from the claimable total.
4. For mismatches, the **lower** of books vs 2B is treated as claimable (the safe
   choice), so you never over-claim.

---

## Free deployment stack

Everything here can run on free tiers:

| Piece | Free option |
|---|---|
| This API | Render / Railway / Fly.io free tier, or any Node host |
| Database (next step) | Supabase (Postgres + auth + storage), free tier |
| Frontend | Lovable / Vercel |
| File parsing (Excel/CSV/2B JSON) | done in-app, no paid service |

This API is currently **stateless** (compute-only). The natural next step is to
add Supabase for storing a seller's invoices, users, and past filing periods.

---

## Connecting from Lovable (frontend)

See **[LOVABLE_FRONTEND.md](./LOVABLE_FRONTEND.md)** for a ready-to-paste Lovable
build prompt, the full data shapes, and screen-by-screen specs.

Quick example — calling reconciliation from the frontend:

```js
const res = await fetch(`${API_BASE}/api/reconcile`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ purchaseRegister, gstr2b }),
});
const report = await res.json();
// render report.summary as headline cards (Claimable / At risk / Unclaimed)
// render report.lines as a table, colored by status
```

---

## Roadmap (beyond this MVP)

- CSV/Excel and GSTR-2B JSON **parsers** (map real file formats → `Invoice[]`).
- **Persistence** via Supabase (users, filing periods, saved invoices).
- **HSN summary** and additional GSTR-1 sections (exports, credit notes).
- **GSP integration** for actual filing (requires licence).
- Multi-tenant isolation + per-seller auth.
