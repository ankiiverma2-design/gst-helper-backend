/**
 * HSN-wise summary for GSTR-1.
 *
 * GSTR-1 requires a summary of outward supplies grouped by HSN/SAC code and tax
 * rate, with quantity, total value, taxable value and tax amounts. Small sellers
 * must report this (the number of required HSN digits depends on turnover).
 */

import type { Invoice, HsnSummaryRow } from './types.ts';
import { round2 } from './reconcile.ts';

function rateOf(inv: Invoice): number {
  if (inv.rate != null) return inv.rate;
  const tax = inv.tax.igst > 0 ? inv.tax.igst : inv.tax.cgst + inv.tax.sgst;
  if (inv.tax.taxableValue <= 0) return 0;
  return round2((tax / inv.tax.taxableValue) * 100);
}

function invoiceTotal(inv: Invoice): number {
  return (
    inv.invoiceValue ??
    inv.tax.taxableValue + inv.tax.igst + inv.tax.cgst + inv.tax.sgst + inv.tax.cess
  );
}

/**
 * Aggregate sales into HSN-wise rows, grouped by (HSN code + rate).
 * Sales without an HSN code are grouped under "UNCLASSIFIED" so nothing is lost.
 */
export function computeHsnSummary(sales: Invoice[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();

  for (const s of sales) {
    const hsn = (s.hsn ?? 'UNCLASSIFIED').trim() || 'UNCLASSIFIED';
    const rate = rateOf(s);
    const key = `${hsn}::${rate}`;

    let row = map.get(key);
    if (!row) {
      row = {
        hsn,
        description: s.description,
        uqc: s.uqc ?? 'NA',
        totalQuantity: 0,
        rate,
        totalValue: 0,
        taxableValue: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      };
      map.set(key, row);
    }

    row.totalQuantity += s.quantity ?? 0;
    row.totalValue += invoiceTotal(s);
    row.taxableValue += s.tax.taxableValue;
    row.igst += s.tax.igst;
    row.cgst += s.tax.cgst;
    row.sgst += s.tax.sgst;
    row.cess += s.tax.cess;
    if (!row.description && s.description) row.description = s.description;
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      totalQuantity: round2(r.totalQuantity),
      totalValue: round2(r.totalValue),
      taxableValue: round2(r.taxableValue),
      igst: round2(r.igst),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      cess: round2(r.cess),
    }))
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
}
