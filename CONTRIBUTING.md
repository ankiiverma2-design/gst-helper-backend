# Contributing

Thanks for your interest in improving GST Helper! This guide covers local setup,
running the app, and the test suite.

## Prerequisites

- **Node.js ≥ 22.6** (required for the backend's native TypeScript type-stripping
  and `node:sqlite`). Check with `node --version`.
- npm (bundled with Node).

## Project structure

```
gst-helper-backend/     repo root = the frontend (Vite + React + TypeScript + Tailwind)
├── src/                React app (pages, components, lib, store)
├── server/             backend: zero-dependency Node API
│   ├── src/            reconcile, gstin, parsers, hsn, gstr1, gstr3b,
│   │                   vendor-followup, db, server, types, sample-data
│   └── test/           Node built-in test runner suites
├── docs/API.md         endpoint reference
├── DEPLOY.md           deployment walkthrough
└── render.yaml         Render Blueprint
```

The backend is intentionally **dependency-free** — it uses only Node built-ins
(`node:http`, `node:sqlite`, `node:test`). Please keep it that way; do not add
runtime npm dependencies to `server/`.

## Run the backend

```bash
cd server
npm start        # http://localhost:3000
npm run dev      # same, with --watch auto-reload
```

No `npm install` is needed to run the backend. (`npm install` only pulls dev-only
type definitions so editors and `npm run typecheck` work.)

## Run the frontend

From the repo root, in a second terminal:

```bash
npm install      # React, Vite, Tailwind
npm run dev      # http://localhost:5173
```

The frontend reads the backend URL from `VITE_API_BASE` (see `.env.example`); you
can also change it live on the app's Upload screen.

## Run the tests

The backend has a full unit-test suite using Node's built-in test runner:

```bash
cd server
npm test
```

This runs every `test/*.test.ts` file. All tests should pass (currently 33).

### What the tests cover

- `reconcile.test.ts` — ITC reconciliation, GSTIN checksum, INR formatting, GSTR-3B, GSTR-1
- `parsers.test.ts` — CSV and GSTR-2B JSON parsing
- `hsn.test.ts` — HSN-wise summary
- `gstr1.test.ts` — extended GSTR-1 sections (B2CL, CDNR, EXP)
- `vendor-followup.test.ts` — per-supplier follow-up report
- `db.test.ts` — SQLite persistence (save/list/load/delete filing periods)

## Coding conventions

- **TypeScript everywhere.** The backend uses "erasable" TypeScript so Node can
  strip types at runtime — avoid enums, parameter properties, and namespaces in
  `server/src`.
- Keep functions pure where possible; the GST logic modules take inputs and
  return results with no side effects (this is what makes them portable, e.g. to
  Supabase Edge Functions).
- Add or update a test when you change behaviour.
- Money math: use the `round2` helper and keep amounts in rupees.

## Adding a new backend endpoint

1. Put the logic in its own module in `server/src` (pure function + types).
2. Add a unit test in `server/test`.
3. Wire a route in `server/src/server.ts`.
4. Document it in [`docs/API.md`](./docs/API.md).

## Submitting changes

1. Create a branch: `git checkout -b my-change`
2. Make the change and add tests.
3. Run `cd server && npm test` — everything should pass.
4. Open a pull request describing what changed and what you tested.
