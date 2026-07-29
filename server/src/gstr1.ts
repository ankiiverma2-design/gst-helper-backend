/**
 * GSTR-1 JSON export.
 *
 * GSTR-1 reports your OUTWARD supplies (sales). The GST portal accepts a JSON
 * file in a specific schema produced by the government's "Returns Offline Tool".
 * We generate that structure so a seller (or their CA) can upload it directly
 * to the portal — no GSP licence required for this path.
 *
 * We implement the two sections that matter most for small sellers:
 *   - b2b : sales to registered buyers (they have a GSTIN), grouped by buyer
 *   - b2cs: small B2C sales (to unregistered consumers), grouped by rate/state
 *
 * Schema references the portal's offline-tool format (fp = filing period MMYYYY,
 * gstin = supplier, ctin = customer GSTIN, inum = invoice no, etc.).
 */

import type { Invoice } from './types.ts';
import { round2 } from './reconcile.ts';

export interface Gstr1ExportInput {
  /** Supplier's own GSTIN (the seller filing the return). */
  supplierGstin: string;
  /** Filing period as MMYYYY, e.g. "072026" for July 2026. */
  filingPeriod: string;
  /** Sales invoices to registered buyers (each must have a buyer GSTIN). */
  b2bSales: Array<Invoice & { buyerGstin: string; placeOfSupply: string }>;
  /** Aggregated B2C small sales lines. */
  b2csSales?: Array<{
    placeOfSupply: string; // 2-digit state code
    rate: number; // combined GST rate, e.g. 18
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  }>;
}

function inferRate(inv: Invoice): number {
  const tax = inv.tax.igst > 0 ? inv.tax.igst : inv.tax.cgst + inv.tax.sgst;
  if (inv.tax.taxableValue <= 0) return 0;
  return round2((tax / inv.tax.taxableValue) * 100);
}

export function buildGstr1Json(input: Gstr1ExportInput): Record<string, unknown> {
  // Group B2B invoices by buyer GSTIN (ctin).
  const byBuyer = new Map<string, Array<Invoice & { placeOfSupply: string }>>();
  for (const inv of input.b2bSales) {
    const list = byBuyer.get(inv.buyerGstin) ?? [];
    list.push(inv);
    byBuyer.set(inv.buyerGstin, list);
  }

  const b2b = [...byBuyer.entries()].map(([ctin, invs]) => ({
    ctin,
    inv: invs.map((inv) => {
      const isInterState = inv.tax.igst > 0;
      const itms = [
        {
          num: 1,
          itm_det: {
            rt: inferRate(inv),
            txval: round2(inv.tax.taxableValue),
            iamt: round2(inv.tax.igst),
            camt: round2(inv.tax.cgst),
            samt: round2(inv.tax.sgst),
            csamt: round2(inv.tax.cess),
          },
        },
      ];
      return {
        inum: inv.invoiceNo,
        idt: toPortalDate(inv.invoiceDate),
        val: round2(
          inv.invoiceValue ??
            inv.tax.taxableValue +
              inv.tax.igst +
              inv.tax.cgst +
              inv.tax.sgst +
              inv.tax.cess,
        ),
        pos: inv.placeOfSupply,
        rchrg: 'N',
        inv_typ: 'R',
        itms,
        // 'sply_ty' hint retained for clarity; portal derives from pos vs supplier state
        _supplyType: isInterState ? 'INTER' : 'INTRA',
      };
    }),
  }));

  const b2cs = (input.b2csSales ?? []).map((row) => ({
    sply_ty: row.igst > 0 ? 'INTER' : 'INTRA',
    pos: row.placeOfSupply,
    typ: 'OE',
    rt: row.rate,
    txval: round2(row.taxableValue),
    iamt: round2(row.igst),
    camt: round2(row.cgst),
    samt: round2(row.sgst),
    csamt: round2(row.cess),
  }));

  const doc: Record<string, unknown> = {
    gstin: input.supplierGstin,
    fp: input.filingPeriod,
    version: 'GST3.2.2',
    hash: 'hash',
  };
  if (b2b.length) doc.b2b = b2b;
  if (b2cs.length) doc.b2cs = b2cs;
  return doc;
}

/** Portal expects invoice date as DD-MM-YYYY. Input is ISO YYYY-MM-DD. */
function toPortalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
