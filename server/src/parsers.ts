/**
 * File parsers: turn real-world files into the `Invoice[]` shape the engine uses.
 *
 *  - parseCsvPurchaseRegister: a seller's purchase register exported as CSV
 *  - parseGstr2bJson: the GSTR-2B JSON downloaded from the government portal
 *
 * Both are tolerant of common header/field variations, because real exports
 * differ between accounting tools and portal versions.
 */

import type { Invoice, TaxBreakup } from './types.ts';

/* ------------------------------------------------------------------ CSV --- */

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, escaped quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // ignore blank trailing lines
    if (row.length > 1 || row[0]!.trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      // handle \r\n and lone \r
      if (text[i + 1] === '\n') i++;
      pushRow();
    } else {
      field += c;
    }
  }
  // last field/row if no trailing newline
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

/** Normalize a header cell: lowercase, strip spaces/underscores/punctuation. */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-./]/g, '');
}

/** Map of accepted header aliases -> canonical field. */
const HEADER_ALIASES: Record<string, string> = {
  suppliergstin: 'supplierGstin',
  gstin: 'supplierGstin',
  suppliername: 'supplierName',
  vendorname: 'supplierName',
  supplier: 'supplierName',
  invoiceno: 'invoiceNo',
  invoicenumber: 'invoiceNo',
  invno: 'invoiceNo',
  billno: 'invoiceNo',
  invoicedate: 'invoiceDate',
  date: 'invoiceDate',
  taxablevalue: 'taxableValue',
  taxable: 'taxableValue',
  taxableamount: 'taxableValue',
  cgst: 'cgst',
  cgstamount: 'cgst',
  sgst: 'sgst',
  sgstamount: 'sgst',
  igst: 'igst',
  igstamount: 'igst',
  cess: 'cess',
  cessamount: 'cess',
  itceligible: 'itcEligible',
  eligible: 'itcEligible',
  invoicevalue: 'invoiceValue',
  hsn: 'hsn',
  hsncode: 'hsn',
  rate: 'rate',
  taxrate: 'rate',
};

function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[,\s\u20B9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY -> ISO YYYY-MM-DD. */
export function normalizeDate(raw: string | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  return s;
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v == null || v === '') return undefined;
  const s = v.trim().toLowerCase();
  if (['no', 'false', 'n', '0', 'ineligible'].includes(s)) return false;
  if (['yes', 'true', 'y', '1', 'eligible'].includes(s)) return true;
  return undefined;
}

/**
 * Parse a CSV purchase register into Invoice[].
 * Required columns (any alias): supplier GSTIN, invoice no, invoice date,
 * taxable value, and tax columns (cgst/sgst/igst/cess).
 */
export function parseCsvPurchaseRegister(csv: string): {
  invoices: Invoice[];
  errors: string[];
} {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { invoices: [], errors: ['CSV has no data rows.'] };
  }

  const headers = rows[0]!.map((h) => HEADER_ALIASES[normHeader(h)] ?? '');
  const invoices: Invoice[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const rec: Record<string, string> = {};
    headers.forEach((field, i) => {
      if (field) rec[field] = (cells[i] ?? '').trim();
    });

    if (!rec.supplierGstin && !rec.invoiceNo) continue; // skip empty-ish rows

    if (!rec.supplierGstin) {
      errors.push(`Row ${r + 1}: missing supplier GSTIN.`);
      continue;
    }
    if (!rec.invoiceNo) {
      errors.push(`Row ${r + 1}: missing invoice number.`);
      continue;
    }

    const tax: TaxBreakup = {
      taxableValue: toNumber(rec.taxableValue),
      cgst: toNumber(rec.cgst),
      sgst: toNumber(rec.sgst),
      igst: toNumber(rec.igst),
      cess: toNumber(rec.cess),
    };

    const inv: Invoice = {
      supplierGstin: rec.supplierGstin.toUpperCase(),
      invoiceNo: rec.invoiceNo,
      invoiceDate: normalizeDate(rec.invoiceDate),
      tax,
    };
    if (rec.supplierName) inv.supplierName = rec.supplierName;
    if (rec.invoiceValue) inv.invoiceValue = toNumber(rec.invoiceValue);
    const elig = parseBool(rec.itcEligible);
    if (elig !== undefined) inv.itcEligible = elig;

    invoices.push(inv);
  }

  return { invoices, errors };
}

/* ------------------------------------------------------------- GSTR-2B --- */

interface Raw2bItemDet {
  rt?: number;
  txval?: number;
  iamt?: number;
  camt?: number;
  samt?: number;
  csamt?: number;
}
interface Raw2bItem {
  itm_det?: Raw2bItemDet;
  num?: number;
  // some exports put amounts directly on the item
  rt?: number;
  txval?: number;
  iamt?: number;
  camt?: number;
  samt?: number;
  csamt?: number;
}
interface Raw2bInvoice {
  inum?: string;
  dt?: string;
  val?: number;
  itms?: Raw2bItem[];
  items?: Raw2bItem[];
}
interface Raw2bSupplier {
  ctin?: string;
  trdnm?: string;
  inv?: Raw2bInvoice[];
}

function itemDet(it: Raw2bItem): Raw2bItemDet {
  return it.itm_det ?? it;
}

/**
 * Parse the GSTR-2B JSON downloaded from the portal into Invoice[].
 *
 * Tolerant to the two common shapes:
 *   { data: { docdata: { b2b: [...] } } }   (newer)
 *   { data: { b2b: [...] } } or { b2b: [...] }
 * Each supplier has `ctin`, `trdnm`, `inv[]`; each invoice has `inum`, `dt`,
 * and line items under `itms`/`items` (amounts in `itm_det` or flat).
 */
export function parseGstr2bJson(input: unknown): {
  invoices: Invoice[];
  errors: string[];
} {
  const errors: string[] = [];
  const root = input as Record<string, any>;
  const b2b: Raw2bSupplier[] =
    root?.data?.docdata?.b2b ?? root?.data?.b2b ?? root?.b2b ?? [];

  if (!Array.isArray(b2b) || b2b.length === 0) {
    errors.push('Could not find a b2b section in the GSTR-2B JSON.');
    return { invoices: [], errors };
  }

  const invoices: Invoice[] = [];
  for (const supplier of b2b) {
    const ctin = (supplier.ctin ?? '').toUpperCase();
    const trdnm = supplier.trdnm;
    for (const inv of supplier.inv ?? []) {
      const items = inv.itms ?? inv.items ?? [];
      const tax: TaxBreakup = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      for (const it of items) {
        const d = itemDet(it);
        tax.taxableValue += Number(d.txval ?? 0);
        tax.igst += Number(d.iamt ?? 0);
        tax.cgst += Number(d.camt ?? 0);
        tax.sgst += Number(d.samt ?? 0);
        tax.cess += Number(d.csamt ?? 0);
      }
      const invoice: Invoice = {
        supplierGstin: ctin,
        invoiceNo: inv.inum ?? '',
        invoiceDate: normalizeDate(inv.dt),
        tax,
      };
      if (trdnm) invoice.supplierName = trdnm;
      if (inv.val != null) invoice.invoiceValue = Number(inv.val);
      invoices.push(invoice);
    }
  }

  return { invoices, errors };
}
