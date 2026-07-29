# Building the Frontend in Lovable

This document is everything you need to build the frontend for the GST Helper in
[Lovable](https://lovable.dev). It contains a **ready-to-paste build prompt**, the
**API contract**, the **exact data shapes**, and **screen-by-screen specs**.

The backend (this repo) is stateless and exposes a small JSON API. Lovable builds
the UI; it calls this API over `fetch`.

---

## Step 1 — Deploy the backend and get its URL

Deploy this repo to any free Node host (Render, Railway, or Fly.io). You'll get a
public URL like `https://gst-helper.onrender.com`. Call that your `API_BASE`.

To test it's live, open `API_BASE/health` in a browser — you should see
`{"status":"ok",...}`.

---

## Step 2 — Paste this prompt into Lovable

> Copy everything in the box below into Lovable's prompt to generate the app.

```
Build a clean, mobile-friendly web app called "GST Helper" for small Indian
business owners to reconcile their GST Input Tax Credit (ITC). Use a modern,
trustworthy design with an Indian audience in mind. Currency is Indian Rupees
(₹) with lakh/crore grouping (e.g. ₹1,23,456.78).

The app talks to a REST API. Set a configurable API base URL (I will provide it),
default to http://localhost:3000. All requests/responses are JSON.

SCREENS:

1) Upload screen
   - Two upload areas:
     a) "Purchase Register" — accepts CSV or Excel of the user's purchase invoices
     b) "GSTR-2B" — accepts the JSON file downloaded from the GST portal
   - Parse both files in the browser into this invoice shape:
     { supplierGstin, supplierName, invoiceNo, invoiceDate (YYYY-MM-DD),
       tax: { taxableValue, cgst, sgst, igst, cess }, itcEligible (optional bool) }
   - A "Use sample data" button that calls GET {API_BASE}/api/sample and loads the
     returned purchaseRegister, gstr2b and sales, so the app is usable immediately.
   - A "Reconcile" button that POSTs { purchaseRegister, gstr2b } to
     {API_BASE}/api/reconcile and navigates to the Dashboard with the result.

2) Dashboard screen (shows the reconciliation result)
   - Four headline cards from response.summary:
       • "Claimable now"  = itcClaimableNow   (green)
       • "At risk"        = itcAtRisk         (red)      -> supplier hasn't filed
       • "Unclaimed"      = itcUnclaimed      (amber)    -> in 2B, not in books
       • "Total in books" = itcAsPerBooks     (neutral)
   - A small stats row: exactMatches, mismatches, missingIn2B, missingInBooks.

3) Invoice table screen
   - A table of response.lines with columns:
       Status | Supplier (name + GSTIN) | Invoice No | Date |
       ITC in books | ITC in 2B | Difference | Note
   - Color the Status badge:
       EXACT_MATCH = green, MISMATCH = amber,
       MISSING_IN_2B = red, MISSING_IN_BOOKS = blue
   - Filter chips to show only one status at a time.
   - Format all money as ₹ with Indian grouping.

4) Returns screen
   - Button "Compute GSTR-3B" -> POST {API_BASE}/api/gstr3b with
     { sales, eligiblePurchases } and show outward tax, eligible ITC, and
     net tax payable as a clear summary.
   - Button "Export GSTR-1 JSON" -> POST {API_BASE}/api/gstr1 with
     { supplierGstin, filingPeriod (MMYYYY), b2bSales } and let the user
     download the returned JSON as a .json file.

Make the design reassuring and simple — the users are non-technical shop owners
and accountants. Use plain-English helper text explaining what each number means.
```

---

## API contract (reference for wiring)

Base URL = your deployed backend. CORS is open, so the browser can call it.

### `GET /health`
Returns `{ "status": "ok", ... }`.

### `GET /api/sample`
Returns `{ purchaseRegister: Invoice[], gstr2b: Invoice[], sales: [...] }`.
Use this to build/preview the UI before real data exists.

### `POST /api/reconcile`  ← the main call
Request:
```json
{
  "purchaseRegister": [ Invoice ],
  "gstr2b":           [ Invoice ],
  "options": { "amountTolerance": 2 }
}
```
Response `ReconciliationReport`:
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
  "lines": [
    {
      "status": "EXACT_MATCH",
      "supplierGstin": "27AABCU9603R1ZM",
      "supplierName": "Mumbai Packaging Supplies",
      "invoiceNo": "MPS/2026/104",
      "invoiceDate": "2026-07-05",
      "itcInBooks": 9000,
      "itcIn2B": 9000,
      "itcDifference": 0,
      "note": "Matched with GSTR-2B. Safe to claim."
    }
  ],
  "options": { "amountTolerance": 2 }
}
```
`status` ∈ `EXACT_MATCH | MISMATCH | MISSING_IN_2B | MISSING_IN_BOOKS`.

### `POST /api/gstr3b`
Request: `{ "sales": Invoice[], "eligiblePurchases": Invoice[] }`
Response: outward taxable supplies, eligible ITC, and net tax payable (per head
CGST/SGST/IGST/Cess + total).

### `POST /api/gstr1`
Request:
```json
{
  "supplierGstin": "27AAAAA0000A1Z5",
  "filingPeriod": "072026",
  "b2bSales": [ { ...Invoice, "buyerGstin": "...", "placeOfSupply": "27" } ]
}
```
Response: portal-ready GSTR-1 JSON (offer it as a file download in the UI).

---

## The `Invoice` shape (used everywhere)

```ts
interface Invoice {
  supplierGstin: string;   // 15-char GSTIN
  supplierName?: string;
  invoiceNo: string;
  invoiceDate: string;     // "YYYY-MM-DD"
  tax: {
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  };
  invoiceValue?: number;
  itcEligible?: boolean;   // false = blocked/ineligible credit
}
```

---

## What each headline number means (put this in your UI help text)

- **Claimable now** — ITC that matched GSTR-2B and is eligible. Safe to claim.
- **At risk** — ITC in your books that is NOT in GSTR-2B. Your supplier probably
  hasn't filed. Don't claim it yet; follow up with them.
- **Unclaimed** — ITC in GSTR-2B that you never recorded. You may be leaving money
  on the table; verify and record it.
- **Total in books** — all eligible ITC you recorded, matched or not.

---

## Suggested build order

1. Deploy backend, confirm `/health`.
2. In Lovable, build the Upload screen with the **"Use sample data"** button first
   (calls `/api/sample`) — you'll have a working end-to-end flow in minutes.
3. Build Dashboard + Invoice table from the `/api/reconcile` response.
4. Add the Returns screen last.
5. Only after the UI feels right, add real CSV/Excel/GSTR-2B parsing.
