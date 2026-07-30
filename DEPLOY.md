# Deployment Guide

This walks you through getting GST Helper live. You have two paths — pick the one
that matches how you want to run the backend.

- **Path A — Lovable + Supabase** (simplest; frontend + backend both handled inside Lovable)
- **Path B — Render** (deploy the Node backend and the static frontend yourself)

You do **not** need both. Don't run two backends.

---

## Before you start

Merge the pull request so everything (including `render.yaml` and the app) is on
your `main` branch:

1. Open the PR on GitHub.
2. Click **Merge pull request** → **Confirm merge**.

---

## Path A — Lovable + Supabase (recommended, simplest)

Here Lovable hosts the frontend and Supabase provides the database, auth, and
backend functions. You don't deploy anything on Render.

1. In **Lovable**, choose **Connect to GitHub** and select
   `ankiiverma2-design/gst-helper-backend`.
   - Because the frontend is at the repo root, Lovable detects it automatically.
2. In Lovable, **connect Supabase** (Lovable has a built-in Supabase integration).
3. Ask Lovable to move the backend logic into Supabase, for example:

   > "Connect Supabase. Create tables for invoices and filing periods with
   > row-level security. Move the GST logic (reconcile, GSTR-1, GSTR-3B, HSN,
   > vendor follow-up, CSV and GSTR-2B parsing) into Supabase Edge Functions,
   > reusing the dependency-free TypeScript in `server/src`. Wire the frontend
   > calls to those functions."

4. Lovable builds and hosts the result. Use the app's **Upload → Use sample data**
   button to confirm the flow works.

That's it — no Render, no separate server.

---

## Path B — Render (deploy the Node backend yourself)

Use this if you want to run the included Node API as-is. The repo ships a
`render.yaml` Blueprint that defines both services.

### Option B1 — One-click Blueprint (both services)

1. Push/merge so `render.yaml` is on `main` (see "Before you start").
2. In Render: **New → Blueprint**.
3. Connect your GitHub and select `ankiiverma2-design/gst-helper-backend`.
4. Render reads `render.yaml` and proposes two free services:
   - `gst-helper-backend` (the Node API, from `server/`)
   - `gst-helper-frontend` (the static React app, from the repo root)
5. Click **Apply**. Wait for both to build.

> If you saw "Blueprint file render.yaml not found on main branch", it means the
> file wasn't on `main` yet. Merge the PR (above), or point the Blueprint at the
> `add-full-stack-frontend` branch.

### Option B2 — Backend only (manual)

If you only want the API (e.g. you host the frontend in Lovable):

1. Render: **New → Web Service** → select the repo.
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
   - **Environment variable:** `NODE_VERSION = 22.11.0`
3. Create the service. When it's live, open `https://<your-service>.onrender.com/health`
   — you should see `{"status":"ok"}`.

### After the backend is live

- Copy the backend URL (e.g. `https://gst-helper-backend.onrender.com`).
- If you deployed the frontend on Render too, set its `VITE_API_BASE` env var to
  that URL (update it in `render.yaml` or in the service's Environment settings),
  then redeploy the frontend.
- If you host the frontend in Lovable, set `VITE_API_BASE` there instead.

---

## Important notes

- **Node version:** the backend needs **Node ≥ 22.6** (for native TypeScript
  type-stripping and `node:sqlite`). `render.yaml` pins `NODE_VERSION=22.11.0`.
- **Persistence on the free tier is ephemeral.** The built-in SQLite database
  lives on the container's local disk, which resets on restart/redeploy. Saved
  filing periods will not survive. For durable storage, attach a Render **persistent
  disk** mounted where `GST_DB_PATH` points, or (better) use Supabase/Postgres.
- **CORS** is already open on the backend, so a browser frontend on any domain
  (Lovable, Vercel, Render) can call it.
- **GST filing:** this app prepares and reconciles returns and exports portal-ready
  files. It does not file directly with the government (that needs a licensed GSP).

---

## Quick verification checklist

- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] Frontend loads and the API URL points at the backend
- [ ] "Use sample data" → "Reconcile" shows ₹30,000 claimable, ₹3,600 at risk, ₹2,700 unclaimed
- [ ] Vendors page lists the two problem suppliers
- [ ] Returns page computes GSTR-3B and downloads GSTR-1 JSON
