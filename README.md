# GST Helper — Full-Stack App

A **GST filing & reconciliation helper for small Indian sellers**.

It compares a seller's purchase register (their books) against their **GSTR-2B**
(the auto-drafted Input Tax Credit statement from the GST portal) and shows
exactly:

- **Claimable now** — ITC that matched and is safe to claim
- **At risk** — ITC in your books that the supplier hasn't reported yet
- **Unclaimed** — ITC in GSTR-2B you forgot to record
- **Mismatches** — where amounts disagree

It also computes a **GSTR-3B** monthly summary and exports **GSTR-1** JSON in the
government's portal-upload format.

> ⚠️ **Compliance:** This tool *prepares* and *reconciles* returns. It does **not**
> file directly with the government. Direct filing needs a licensed **GSP (GST
> Suvidha Provider)** integration (added later). Until then, the seller/CA uploads
> the generated JSON to the official GST portal. This path is fully legal.

---

## Repository layout

The **frontend lives at the repo root** (so Lovable detects it automatically),
and the **backend lives in `server/`**.

```
gst-helper-backend/            (repo root = the frontend app)
├── src/                → Frontend: Vite + React + TypeScript + Tailwind
│   ├── pages/          Upload, Dashboard, Invoices, Vendors, Returns
│   ├── components/     StatusBadge, StatCard
│   ├── lib/            api client, types, INR formatting
│   ├── store.tsx       shared app state
│   └── App.tsx         layout + routing
├── index.html
├── package.json        (frontend)
├── vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig*.json
│
├── server/             → Backend: zero-dependency Node API
│   ├── src/            reconcile, gstr1/3b, hsn, parsers, vendor-followup, db, server
│   ├── test/           33 passing tests
│   └── package.json
│
├── LOVABLE_FRONTEND.md → API contract / how to build the UI in Lovable
└── README.md
```

---

## Run it locally

You need **Node ≥ 22.6**. Open two terminals.

**Terminal 1 — backend (no install needed):**
```bash
cd server
npm start                # serves the API on http://localhost:3000
```

**Terminal 2 — frontend (from the repo root):**
```bash
npm install              # installs React, Vite, Tailwind
npm run dev              # opens the app on http://localhost:5173
```

Then open http://localhost:5173, click **“Use sample data”**, and hit
**Reconcile** — you'll see the full flow with ₹30,000 claimable, ₹3,600 at risk,
and ₹2,700 unclaimed.

The frontend reads the backend URL from `VITE_API_BASE` (see `.env.example`) and
you can also change it live on the Upload screen.

---

## Using this with Lovable

Because the frontend is at the repo root, Lovable detects it automatically:

1. In Lovable, **Connect to GitHub** and select this repository.
2. Set the environment variable **`VITE_API_BASE`** to your deployed backend URL
   (or connect Supabase and let Lovable wire the backend — see note below).
3. Lovable renders the app; click **“Use sample data”** to see the full flow.
4. Ask Lovable to restyle screens, add features, or connect Supabase for
   database/auth. It edits `src/` directly.

> **Backend options:** the frontend needs a backend for the GST logic. Either
> deploy the Node API in `server/` (see Deploy below) and point `VITE_API_BASE`
> at it, **or** let Lovable rebuild the backend calls against Supabase. The
> pure-TypeScript logic in `server/src` (reconcile, gstr1/3b, hsn, parsers,
> vendor-followup) is dependency-free and ports easily to Supabase Edge Functions.

---

## Deploy (free tiers)

**Backend** (Render / Railway / Fly.io):
- Root directory: `server`
- Build command: *(leave empty — zero dependencies)*
- Start command: `npm start`
- You get a URL like `https://gst-helper-backend.onrender.com`. Test `/health`.

**Frontend** (Lovable / Vercel / Netlify):
- Root directory: repo root
- Build command: `npm run build`  ·  Output dir: `dist`
- Set env var `VITE_API_BASE` to your backend URL.

---

## API contract (backend)

All JSON. CORS open. Full details in
[LOVABLE_FRONTEND.md](./LOVABLE_FRONTEND.md).

| Method & path | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /api/sample` | Sample purchase register + GSTR-2B + sales |
| `POST /api/reconcile` | Core: compare books vs GSTR-2B |
| `POST /api/gstr3b` | Monthly tax-payable summary |
| `POST /api/gstr1` | Portal-ready GSTR-1 JSON (B2B, B2CS, B2CL, CDNR, EXP) |
| `POST /api/hsn-summary` | HSN-wise summary of sales |
| `POST /api/vendor-followup` | Per-supplier list of ITC problems + messages |
| `POST /api/parse/purchase-register-csv` | Parse a CSV purchase register |
| `POST /api/parse/gstr2b` | Parse portal GSTR-2B JSON |
| `GET /api/periods` | List saved filing periods |
| `POST /api/periods` | Save a filing period |
| `GET /api/periods/:id` | Load a filing period |
| `DELETE /api/periods/:id` | Delete a filing period |

Run backend tests: `cd server && npm test` (33 tests).

---

## Features

- ✅ **ITC reconciliation** (books vs GSTR-2B) with claimable / at-risk / unclaimed
- ✅ **GSTIN validation** with the official check-digit algorithm
- ✅ **File import** — CSV purchase register + portal GSTR-2B JSON parsers
- ✅ **HSN-wise summary** for GSTR-1
- ✅ **GSTR-1 export** with B2B, B2CS, B2CL, credit/debit notes (CDNR), exports (EXP)
- ✅ **GSTR-3B** monthly tax-payable summary
- ✅ **Vendor follow-up** — who to chase, with ready-to-send messages
- ✅ **Persistence** of filing periods via built-in SQLite (zero external deps)

## Roadmap

- Excel (.xlsx) import in addition to CSV
- **GSP integration** for actual filing (requires licence)
- Multi-tenant auth & isolation
- Additional GSTR-1 sections (advances, amendments)
