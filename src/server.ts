/**
 * Zero-dependency HTTP API for the GST reconciliation helper.
 *
 * Uses only Node's built-in `http` module so it runs anywhere with just Node
 * installed and needs no `npm install`. This is the API your Lovable frontend
 * calls. CORS is open so a browser frontend on another domain can reach it.
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/sample                 -> sample purchase register + 2B + sales
 *   POST /api/reconcile              -> { purchaseRegister, gstr2b, options? }
 *   POST /api/gstr3b                 -> { sales, eligiblePurchases }
 *   POST /api/gstr1                  -> Gstr1ExportInput
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { reconcile } from './reconcile.ts';
import { computeGstr3b } from './gstr3b.ts';
import { buildGstr1Json, type Gstr1ExportInput } from './gstr1.ts';
import {
  samplePurchaseRegister,
  sampleGstr2b,
  sampleSales,
} from './sample-data.ts';
import type { Invoice, ReconcileOptions } from './types.ts';

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw.trim() ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok', service: 'gst-helper', time: new Date().toISOString() });
      return;
    }

    if (req.method === 'GET' && path === '/api/sample') {
      sendJson(res, 200, {
        purchaseRegister: samplePurchaseRegister,
        gstr2b: sampleGstr2b,
        sales: sampleSales,
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/reconcile') {
      const body = (await readJsonBody(req)) as {
        purchaseRegister?: Invoice[];
        gstr2b?: Invoice[];
        options?: ReconcileOptions;
      };
      if (!Array.isArray(body.purchaseRegister) || !Array.isArray(body.gstr2b)) {
        sendJson(res, 400, {
          error: 'Provide "purchaseRegister" and "gstr2b" as arrays of invoices.',
        });
        return;
      }
      const report = reconcile(body.purchaseRegister, body.gstr2b, body.options ?? {});
      sendJson(res, 200, report);
      return;
    }

    if (req.method === 'POST' && path === '/api/gstr3b') {
      const body = (await readJsonBody(req)) as {
        sales?: Invoice[];
        eligiblePurchases?: Invoice[];
      };
      if (!Array.isArray(body.sales) || !Array.isArray(body.eligiblePurchases)) {
        sendJson(res, 400, {
          error: 'Provide "sales" and "eligiblePurchases" as arrays of invoices.',
        });
        return;
      }
      sendJson(res, 200, computeGstr3b(body.sales, body.eligiblePurchases));
      return;
    }

    if (req.method === 'POST' && path === '/api/gstr1') {
      const body = (await readJsonBody(req)) as Partial<Gstr1ExportInput>;
      if (!body.supplierGstin || !body.filingPeriod || !Array.isArray(body.b2bSales)) {
        sendJson(res, 400, {
          error: 'Provide "supplierGstin", "filingPeriod" (MMYYYY) and "b2bSales".',
        });
        return;
      }
      sendJson(res, 200, buildGstr1Json(body as Gstr1ExportInput));
      return;
    }

    sendJson(res, 404, { error: `No route for ${req.method} ${path}` });
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
