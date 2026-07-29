/**
 * Zero-dependency HTTP API for the GST reconciliation helper.
 *
 * Uses only Node's built-in `http` and `node:sqlite` modules, so it runs with
 * just Node installed (run with --experimental-sqlite, set in the npm scripts).
 * This is the API the frontend calls. CORS is open for browser access.
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/sample
 *   POST /api/reconcile                     { purchaseRegister, gstr2b, options? }
 *   POST /api/gstr3b                        { sales, eligiblePurchases }
 *   POST /api/gstr1                         Gstr1ExportInput (incl. b2cl/cdnr/exp)
 *   POST /api/hsn-summary                   { sales }
 *   POST /api/vendor-followup               { purchaseRegister, gstr2b } | { lines }
 *   POST /api/parse/purchase-register-csv   { csv }
 *   POST /api/parse/gstr2b                  GSTR-2B JSON (raw or { json })
 *   GET  /api/periods[?gstin=]              list saved filing periods
 *   POST /api/periods                       save { gstin, period, ... }
 *   GET  /api/periods/:id                   load a filing period
 *   DELETE /api/periods/:id                 delete a filing period
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { reconcile } from './reconcile.ts';
import { computeGstr3b } from './gstr3b.ts';
import { buildGstr1Json, type Gstr1ExportInput } from './gstr1.ts';
import { computeHsnSummary } from './hsn.ts';
import { buildVendorFollowUp } from './vendor-followup.ts';
import { parseCsvPurchaseRegister, parseGstr2bJson } from './parsers.ts';
import { Store } from './db.ts';
import {
  samplePurchaseRegister,
  sampleGstr2b,
  sampleSales,
} from './sample-data.ts';
import type { Invoice, ReconResultLine, ReconcileOptions } from './types.ts';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.GST_DB_PATH ?? 'data/gst-helper.db';

const store = new Store(DB_PATH);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw.trim() ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (method === 'OPTIONS') return sendJson(res, 204, {});

    if (method === 'GET' && path === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'gst-helper',
        time: new Date().toISOString(),
      });
    }

    if (method === 'GET' && path === '/api/sample') {
      return sendJson(res, 200, {
        purchaseRegister: samplePurchaseRegister,
        gstr2b: sampleGstr2b,
        sales: sampleSales,
      });
    }

    if (method === 'POST' && path === '/api/reconcile') {
      const body = (await readJsonBody(req)) as {
        purchaseRegister?: Invoice[];
        gstr2b?: Invoice[];
        options?: ReconcileOptions;
      };
      if (!Array.isArray(body.purchaseRegister) || !Array.isArray(body.gstr2b)) {
        return sendJson(res, 400, {
          error: 'Provide "purchaseRegister" and "gstr2b" as arrays of invoices.',
        });
      }
      return sendJson(
        res,
        200,
        reconcile(body.purchaseRegister, body.gstr2b, body.options ?? {}),
      );
    }

    if (method === 'POST' && path === '/api/gstr3b') {
      const body = (await readJsonBody(req)) as {
        sales?: Invoice[];
        eligiblePurchases?: Invoice[];
      };
      if (!Array.isArray(body.sales) || !Array.isArray(body.eligiblePurchases)) {
        return sendJson(res, 400, {
          error: 'Provide "sales" and "eligiblePurchases" as arrays of invoices.',
        });
      }
      return sendJson(res, 200, computeGstr3b(body.sales, body.eligiblePurchases));
    }

    if (method === 'POST' && path === '/api/gstr1') {
      const body = (await readJsonBody(req)) as Partial<Gstr1ExportInput>;
      if (!body.supplierGstin || !body.filingPeriod || !Array.isArray(body.b2bSales)) {
        return sendJson(res, 400, {
          error: 'Provide "supplierGstin", "filingPeriod" (MMYYYY) and "b2bSales".',
        });
      }
      return sendJson(res, 200, buildGstr1Json(body as Gstr1ExportInput));
    }

    if (method === 'POST' && path === '/api/hsn-summary') {
      const body = (await readJsonBody(req)) as { sales?: Invoice[] };
      if (!Array.isArray(body.sales)) {
        return sendJson(res, 400, { error: 'Provide "sales" as an array of invoices.' });
      }
      return sendJson(res, 200, { rows: computeHsnSummary(body.sales) });
    }

    if (method === 'POST' && path === '/api/vendor-followup') {
      const body = (await readJsonBody(req)) as {
        lines?: ReconResultLine[];
        purchaseRegister?: Invoice[];
        gstr2b?: Invoice[];
      };
      let lines = body.lines;
      if (!Array.isArray(lines)) {
        if (Array.isArray(body.purchaseRegister) && Array.isArray(body.gstr2b)) {
          lines = reconcile(body.purchaseRegister, body.gstr2b).lines;
        } else {
          return sendJson(res, 400, {
            error: 'Provide "lines", or "purchaseRegister" and "gstr2b" to reconcile.',
          });
        }
      }
      return sendJson(res, 200, { vendors: buildVendorFollowUp(lines) });
    }

    if (method === 'POST' && path === '/api/parse/purchase-register-csv') {
      const body = (await readJsonBody(req)) as { csv?: string };
      if (typeof body.csv !== 'string') {
        return sendJson(res, 400, { error: 'Provide "csv" as a string.' });
      }
      return sendJson(res, 200, parseCsvPurchaseRegister(body.csv));
    }

    if (method === 'POST' && path === '/api/parse/gstr2b') {
      const body = await readJsonBody(req);
      // Accept the raw portal JSON or a wrapper { json: ... }.
      const json = body && typeof body === 'object' && 'json' in body ? body.json : body;
      return sendJson(res, 200, parseGstr2bJson(json));
    }

    // ---- Persistence: filing periods ----
    if (path === '/api/periods' && method === 'GET') {
      const gstin = url.searchParams.get('gstin') ?? undefined;
      return sendJson(res, 200, { periods: store.listPeriods(gstin) });
    }

    if (path === '/api/periods' && method === 'POST') {
      const body = (await readJsonBody(req)) as {
        gstin?: string;
        period?: string;
        purchaseRegister?: Invoice[];
        gstr2b?: Invoice[];
        sales?: Invoice[];
      };
      if (!body.gstin || !body.period) {
        return sendJson(res, 400, { error: 'Provide "gstin" and "period" (MMYYYY).' });
      }
      const id = store.savePeriod({
        gstin: body.gstin,
        period: body.period,
        purchaseRegister: body.purchaseRegister ?? [],
        gstr2b: body.gstr2b ?? [],
        sales: body.sales ?? [],
      });
      return sendJson(res, 200, { id });
    }

    const periodMatch = path.match(/^\/api\/periods\/(\d+)$/);
    if (periodMatch) {
      const id = Number(periodMatch[1]);
      if (method === 'GET') {
        const rec = store.getPeriod(id);
        return rec
          ? sendJson(res, 200, rec)
          : sendJson(res, 404, { error: `No filing period with id ${id}` });
      }
      if (method === 'DELETE') {
        return sendJson(res, 200, { deleted: store.deletePeriod(id) });
      }
    }

    return sendJson(res, 404, { error: `No route for ${method} ${path}` });
  } catch (err) {
    sendJson(res, 500, {
      error: 'Internal error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, () => {
  console.log(`GST helper API listening on http://localhost:${PORT}`);
});

export { server };
