/**
 * Vendor follow-up report.
 *
 * The most actionable output for a seller: a per-supplier list of problems that
 * are costing them Input Tax Credit, so they know exactly whom to contact.
 *
 *  - MISSING_IN_2B  -> supplier hasn't filed this invoice; ITC is blocked.
 *  - MISMATCH       -> supplier reported a different amount; needs reconciling.
 */

import type { ReconResultLine } from './types.ts';
import { round2, formatInr } from './reconcile.ts';

export interface VendorFollowUpInvoice {
  invoiceNo: string;
  invoiceDate?: string;
  issue: 'MISSING_IN_2B' | 'MISMATCH';
  itcInBooks: number;
  itcIn2B: number;
  itcDifference: number;
}

export interface VendorFollowUp {
  supplierGstin: string;
  supplierName?: string;
  /** ITC fully blocked because these invoices are absent from GSTR-2B. */
  atRiskItc: number;
  /** Net ITC difference across mismatched invoices (books - 2B). */
  mismatchItcDifference: number;
  /** Count of problem invoices for this supplier. */
  invoiceCount: number;
  invoices: VendorFollowUpInvoice[];
  /** A ready-to-send, plain-English message to the supplier. */
  suggestedMessage: string;
}

/**
 * Build the follow-up list from reconciliation lines, sorted by the biggest
 * ITC impact first (so the seller chases the most valuable problems first).
 */
export function buildVendorFollowUp(lines: ReconResultLine[]): VendorFollowUp[] {
  const byVendor = new Map<string, VendorFollowUp>();

  for (const l of lines) {
    if (l.status !== 'MISSING_IN_2B' && l.status !== 'MISMATCH') continue;

    let v = byVendor.get(l.supplierGstin);
    if (!v) {
      v = {
        supplierGstin: l.supplierGstin,
        supplierName: l.supplierName,
        atRiskItc: 0,
        mismatchItcDifference: 0,
        invoiceCount: 0,
        invoices: [],
        suggestedMessage: '',
      };
      byVendor.set(l.supplierGstin, v);
    }
    if (!v.supplierName && l.supplierName) v.supplierName = l.supplierName;

    if (l.status === 'MISSING_IN_2B') {
      v.atRiskItc += l.itcInBooks;
    } else {
      v.mismatchItcDifference += l.itcDifference;
    }
    v.invoiceCount++;
    v.invoices.push({
      invoiceNo: l.invoiceNo,
      invoiceDate: l.invoiceDate,
      issue: l.status,
      itcInBooks: l.itcInBooks,
      itcIn2B: l.itcIn2B,
      itcDifference: l.itcDifference,
    });
  }

  const result = [...byVendor.values()].map((v) => {
    v.atRiskItc = round2(v.atRiskItc);
    v.mismatchItcDifference = round2(v.mismatchItcDifference);
    v.suggestedMessage = buildMessage(v);
    return v;
  });

  // Sort by total ITC impact (at-risk + absolute mismatch), largest first.
  result.sort(
    (a, b) =>
      b.atRiskItc + Math.abs(b.mismatchItcDifference) -
      (a.atRiskItc + Math.abs(a.mismatchItcDifference)),
  );
  return result;
}

function buildMessage(v: VendorFollowUp): string {
  const missing = v.invoices.filter((i) => i.issue === 'MISSING_IN_2B');
  const mismatched = v.invoices.filter((i) => i.issue === 'MISMATCH');
  const name = v.supplierName ? ` ${v.supplierName}` : '';
  const parts: string[] = [`Dear${name} (GSTIN ${v.supplierGstin}),`];

  if (missing.length) {
    const list = missing.map((i) => i.invoiceNo).join(', ');
    parts.push(
      `We could not find the following invoice(s) in our GSTR-2B: ${list}. ` +
        `This is holding up ${formatInr(v.atRiskItc)} of our Input Tax Credit. ` +
        `Please confirm these are filed in your GSTR-1.`,
    );
  }
  if (mismatched.length) {
    const list = mismatched.map((i) => i.invoiceNo).join(', ');
    parts.push(
      `The tax amounts reported for invoice(s) ${list} do not match our records ` +
        `(net difference ${formatInr(v.mismatchItcDifference)}). Please verify and correct if needed.`,
    );
  }
  parts.push('Thank you.');
  return parts.join(' ');
}
