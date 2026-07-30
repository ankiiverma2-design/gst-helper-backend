# API Reference

Human-readable reference for the GST Helper backend (see `server/src/server.ts`).

- **Base URL:** your deployed backend (locally `http://localhost:3000`).
- **Content type:** all requests and responses are JSON.
- **CORS:** open (`Access-Control-Allow-Origin: *`).
- **Auth:** none in this version (add via Supabase/your gateway for production).

## Shared types

### `Invoice`
```jsonc
{
  "supplierGstin": "27AABCU9603R1ZN",   // 15-char GSTIN
  "supplierName": "Mumbai Packaging",   // optional
  "invoiceNo": "MPS/2026/104",
  "invoiceDate": "2026-07-05",           // ISO YYYY-MM-DD
  "tax": {
    "taxableValue": 50000,
    "cgst": 4500, "sgst": 4500, "igst": 0, "cess": 0
  },
  "invoiceValue": 59000,                 // optional; derived if absent
  "itcEligible": true,                   // optional; false = blocked/ineligible
  // Optional GSTR-1 / HSN fields on sales:
  "hsn": "3923", "description": "Packaging", "uqc": "NOS",
  "quantity": 10, "rate": 18,
  "buyerGstin": "27BBBBB1111B1ZN",       // sales to registered buyers
  "placeOfSupply": "27"                   // 2-digit state code
}
```

---

## Health & data

### GET `/health`
Liveness check.
```json
{ "status": "ok", "service": "gst-helper", "time": "2026-07-27T08:00:00.000Z" }
```

### GET `/api/sample`
Returns ready-made demo data so the UI works before real data exists.
```json
{ "purchaseRegister": [Invoice], "gstr2b": [Invoice], "sales": [Invoice] }
```

---

## Core reconciliation

### POST `/api/reconcile`
Compare the purchase register (books) against GSTR-2B.

**Request**
```json
{
  "purchaseRegister": [Invoice],
  "gstr2b": [Invoice],
  "options": { "amountTolerance": 2 }   // optional, ₹ tolerance (default 2)
}
```

**Response** — `ReconciliationReport`
```jsonc
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
    "itcClaimableNow": 30000,   // matched & eligible — safe to claim
    "itcAtRisk": 3600,          // in books, not in 2B — supplier hasn't filed
    "itcUnclaimed": 2700        // in 2B, not in books — possibly missed
  },
  "lines": [
    {
      "status": "EXACT_MATCH",  // EXACT_MATCH | MISMATCH | MISSING_IN_2B | MISSING_IN_BOOKS
      "supplierGstin": "27AABCU9603R1ZN",
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

**Errors** — `400` if `purchaseRegister` or `gstr2b` is not an array.

---

## Returns

### POST `/api/gstr3b`
Compute the monthly GSTR-3B summary. ITC is netted head-wise against output tax,
floored at zero per head.

**Request**
```json
{ "sales": [Invoice], "eligiblePurchases": [Invoice] }
```

**Response**
```json
{
  "outwardTaxableSupplies": { "taxableValue": 290000, "cgst": 18000, "sgst": 18000, "igst": 16200, "cess": 0 },
  "eligibleItc":            { "taxableValue": 190000, "cgst": 6300,  "sgst": 6300,  "igst": 21600, "cess": 0 },
  "netTaxPayable":          { "cgst": 11700, "sgst": 11700, "igst": 0, "cess": 0, "total": 23400 }
}
```

### POST `/api/gstr1`
Generate portal-ready GSTR-1 JSON. Supports B2B, B2CS, B2CL, CDNR (credit/debit
notes) and EXP (exports).

**Request**
```jsonc
{
  "supplierGstin": "27AAAAA0000A1Z2",
  "filingPeriod": "072026",              // MMYYYY
  "b2bSales": [ { /* Invoice */ "buyerGstin": "...", "placeOfSupply": "27" } ],
  "b2csSales": [ { "placeOfSupply": "27", "rate": 18, "taxableValue": 1000,
                   "igst": 0, "cgst": 90, "sgst": 90, "cess": 0 } ],
  "b2clSales": [ { /* Invoice */ "placeOfSupply": "29" } ],
  "creditDebitNotes": [ { "buyerGstin": "...", "noteNo": "CN-1", "noteDate": "2026-07-15",
                          "noteType": "C", "placeOfSupply": "29", "tax": { /* TaxBreakup */ } } ],
  "exports": [ { "exportType": "WPAY", "invoiceNo": "EXP-1", "invoiceDate": "2026-07-20",
                 "tax": { /* TaxBreakup */ }, "portCode": "INNSA1",
                 "shippingBillNo": "7259834", "shippingBillDate": "2026-07-21" } ],
  "options": { "b2clThreshold": 100000 }  // optional
}
```
Only `supplierGstin`, `filingPeriod` and `b2bSales` are required.

**Response** — GSTR-1 JSON in the portal's offline-utility format (sections
`b2b`, `b2cs`, `b2cl`, `cdnr`, `exp` are included only when non-empty). Offer it
to the user as a downloadable `.json` file.

**Errors** — `400` if `supplierGstin`, `filingPeriod`, or `b2bSales` is missing.

### POST `/api/hsn-summary`
HSN-wise summary of sales (for the GSTR-1 HSN section).

**Request** `{ "sales": [Invoice] }`

**Response**
```json
{
  "rows": [
    {
      "hsn": "3923", "description": "Packaging", "uqc": "NOS",
      "totalQuantity": 15, "rate": 18,
      "taxableValue": 1500, "igst": 0, "cgst": 135, "sgst": 135, "cess": 0,
      "totalValue": 1770
    }
  ]
}
```

---

## Vendor follow-up

### POST `/api/vendor-followup`
Group ITC problems (missing-in-2B and mismatches) by supplier, with a ready-to-send
message for each. Provide either reconciliation `lines`, or the raw arrays to
reconcile on the fly.

**Request** (either form)
```json
{ "purchaseRegister": [Invoice], "gstr2b": [Invoice] }
```
```json
{ "lines": [ReconResultLine] }
```

**Response**
```json
{
  "vendors": [
    {
      "supplierGstin": "27AACCG1234H1ZY",
      "supplierName": "Pune Logistics",
      "atRiskItc": 3600,
      "mismatchItcDifference": 0,
      "invoiceCount": 1,
      "invoices": [
        { "invoiceNo": "PL/07/221", "invoiceDate": "2026-07-15",
          "issue": "MISSING_IN_2B", "itcInBooks": 3600, "itcIn2B": 0, "itcDifference": 3600 }
      ],
      "suggestedMessage": "Dear Pune Logistics (GSTIN 27AACCG1234H1ZY), ..."
    }
  ]
}
```
Vendors are sorted by biggest ITC impact first.

---

## File parsing

### POST `/api/parse/purchase-register-csv`
Parse a CSV purchase register into invoices. Headers are matched flexibly
(e.g. `GSTIN`, `Invoice No`, `Invoice Date`, `Taxable Value`, `CGST`, `SGST`,
`IGST`, `Cess`, `Eligible`). Dates accept `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`.

**Request** `{ "csv": "GSTIN,Invoice No,...\n27AABCU9603R1ZN,INV1,..." }`

**Response** `{ "invoices": [Invoice], "errors": [string] }`

### POST `/api/parse/gstr2b`
Parse GSTR-2B JSON (as downloaded from the portal) into invoices. Accepts the raw
portal JSON or a wrapper `{ "json": <portal JSON> }`. Tolerant of the common
shapes (`data.docdata.b2b`, `data.b2b`, or top-level `b2b`).

**Response** `{ "invoices": [Invoice], "errors": [string] }`

---

## Persistence — filing periods

A "filing period" is one GSTIN + one month (MMYYYY) with its saved invoice sets.

### GET `/api/periods`  ·  `/api/periods?gstin=<GSTIN>`
List saved periods (optionally filtered), newest first.
```json
{ "periods": [
  { "id": 1, "gstin": "27AAAAA0000A1Z2", "period": "072026",
    "updatedAt": "2026-07-27T08:00:00.000Z",
    "counts": { "purchaseRegister": 4, "gstr2b": 4, "sales": 2 } }
] }
```

### POST `/api/periods`
Create or update a period (keyed by `gstin` + `period`).
```json
{ "gstin": "27AAAAA0000A1Z2", "period": "072026",
  "purchaseRegister": [Invoice], "gstr2b": [Invoice], "sales": [Invoice] }
```
**Response** `{ "id": 1 }` — **Errors:** `400` if `gstin` or `period` missing.

### GET `/api/periods/:id`
Load a full period (`FilingPeriodRecord` with the invoice arrays), or `404`.

### DELETE `/api/periods/:id`
Delete a period. **Response** `{ "deleted": true }`.

---

## Status codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 400  | Invalid or missing request fields |
| 404  | Unknown route or missing filing period |
| 500  | Internal error (`{ "error", "detail" }`) |
