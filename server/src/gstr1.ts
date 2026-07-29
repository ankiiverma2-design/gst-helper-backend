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

import type { Invoice, TaxBreakup } from './types.ts';
import { round2 } from './reconcile.ts';

/** A credit or debit note issued to a registered buyer. */
export interface CreditDebitNote {
  buyerGstin: string;
  noteNo: string;
  noteDate: string; // ISO YYYY-MM-DD
  noteType: 'C' | 'D'; // Credit or Debit
  placeOfSupply: string; // 2-digit state code
  tax: TaxBreakup;
  invoiceValue?: number;
}

/** An export invoice (with or without payment of IGST). */
export interface ExportInvoice {
  exportType: 'WPAY' | 'WOPAY'; // with / without payment of tax
  invoiceNo: string;
  invoiceDate: string; // ISO
  rate?: number;
  tax: TaxBreakup; // typically only igst (+cess)
  invoiceValue?: number;
  portCode?: string;
  shippingBillNo?: string;
  shippingBillDate?: string; // ISO
}

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
  /** Large B2C inter-state sales (invoice value above the B2CL threshold). */
  b2clSales?: Array<Invoice & { placeOfSupply: string }>;
  /** Credit/debit notes issued to registered buyers (CDNR section). */
  creditDebitNotes?: CreditDebitNote[];
  /** Export invoices (EXP section). */
  exports?: ExportInvoice[];
  /** Tuning options. */
  options?: {
    /** Invoice value above which an inter-state B2C sale is "large" (B2CL). Default 100000. */
    b2clThreshold?: number;
  };
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

  const b2cl = buildB2cl(input.b2clSales ?? [], input.options?.b2clThreshold ?? 100000);
  const cdnr = buildCdnr(input.creditDebitNotes ?? []);
  const exp = buildExp(input.exports ?? []);

  const doc: Record<string, unknown> = {
    gstin: input.supplierGstin,
    fp: input.filingPeriod,
    version: 'GST3.2.2',
    hash: 'hash',
  };
  if (b2b.length) doc.b2b = b2b;
  if (b2cs.length) doc.b2cs = b2cs;
  if (b2cl.length) doc.b2cl = b2cl;
  if (cdnr.length) doc.cdnr = cdnr;
  if (exp.length) doc.exp = exp;
  return doc;
}

/** Line-item block shared by invoice-style sections. */
function itemBlock(tax: TaxBreakup, rate: number) {
  return [
    {
      num: 1,
      itm_det: {
        rt: rate,
        txval: round2(tax.taxableValue),
        iamt: round2(tax.igst),
        camt: round2(tax.cgst),
        samt: round2(tax.sgst),
        csamt: round2(tax.cess),
      },
    },
  ];
}

function valueOf(tax: TaxBreakup, invoiceValue?: number): number {
  return round2(
    invoiceValue ?? tax.taxableValue + tax.igst + tax.cgst + tax.sgst + tax.cess,
  );
}

/** B2CL: large inter-state B2C invoices, grouped by place of supply. */
function buildB2cl(
  sales: Array<Invoice & { placeOfSupply: string }>,
  threshold: number,
): Array<Record<string, unknown>> {
  const large = sales.filter(
    (s) => s.tax.igst > 0 && valueOf(s.tax, s.invoiceValue) > threshold,
  );
  const byPos = new Map<string, Array<Invoice & { placeOfSupply: string }>>();
  for (const s of large) {
    const list = byPos.get(s.placeOfSupply) ?? [];
    list.push(s);
    byPos.set(s.placeOfSupply, list);
  }
  return [...byPos.entries()].map(([pos, invs]) => ({
    pos,
    inv: invs.map((s) => ({
      inum: s.invoiceNo,
      idt: toPortalDate(s.invoiceDate),
      val: valueOf(s.tax, s.invoiceValue),
      itms: itemBlock(s.tax, inferRate(s)),
    })),
  }));
}

/** CDNR: credit/debit notes to registered buyers, grouped by buyer GSTIN. */
function buildCdnr(notes: CreditDebitNote[]): Array<Record<string, unknown>> {
  const byBuyer = new Map<string, CreditDebitNote[]>();
  for (const n of notes) {
    const list = byBuyer.get(n.buyerGstin) ?? [];
    list.push(n);
    byBuyer.set(n.buyerGstin, list);
  }
  return [...byBuyer.entries()].map(([ctin, ns]) => ({
    ctin,
    nt: ns.map((n) => ({
      ntty: n.noteType, // 'C' or 'D'
      nt_num: n.noteNo,
      nt_dt: toPortalDate(n.noteDate),
      pos: n.placeOfSupply,
      rchrg: 'N',
      inv_typ: 'R',
      val: valueOf(n.tax, n.invoiceValue),
      itms: itemBlock(n.tax, rateOfTax(n.tax)),
    })),
  }));
}

/** EXP: export invoices, grouped by export type (WPAY / WOPAY). */
function buildExp(exports: ExportInvoice[]): Array<Record<string, unknown>> {
  const byType = new Map<string, ExportInvoice[]>();
  for (const e of exports) {
    const list = byType.get(e.exportType) ?? [];
    list.push(e);
    byType.set(e.exportType, list);
  }
  return [...byType.entries()].map(([expType, es]) => ({
    exp_typ: expType,
    inv: es.map((e) => ({
      inum: e.invoiceNo,
      idt: toPortalDate(e.invoiceDate),
      val: valueOf(e.tax, e.invoiceValue),
      sbpcode: e.portCode ?? '',
      sbnum: e.shippingBillNo ?? '',
      sbdt: e.shippingBillDate ? toPortalDate(e.shippingBillDate) : '',
      itms: [
        {
          txval: round2(e.tax.taxableValue),
          rt: e.rate ?? rateOfTax(e.tax),
          iamt: round2(e.tax.igst),
          csamt: round2(e.tax.cess),
        },
      ],
    })),
  }));
}

function rateOfTax(tax: TaxBreakup): number {
  const t = tax.igst > 0 ? tax.igst : tax.cgst + tax.sgst;
  if (tax.taxableValue <= 0) return 0;
  return round2((t / tax.taxableValue) * 100);
}

/** Portal expects invoice date as DD-MM-YYYY. Input is ISO YYYY-MM-DD. */
function toPortalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
