/**
 * GSTR-3B summary computation.
 *
 * GSTR-3B is the monthly self-declared summary return. In simple terms:
 *   tax you owe in cash = tax you collected on sales (output tax)
 *                          - eligible Input Tax Credit on purchases.
 *
 * ITC is set off head-wise and floored at zero per head (you can't have
 * negative cash payable; excess credit carries forward). This is a simplified
 * head-wise set-off suitable for small sellers; complex cross-utilisation
 * ordering can be layered in later.
 */

import type { Invoice, TaxBreakup, Gstr3bSummary } from './types.ts';
import { round2 } from './reconcile.ts';

function emptyBreakup(): TaxBreakup {
  return { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
}

function addInto(acc: TaxBreakup, inv: Invoice): void {
  acc.taxableValue += inv.tax.taxableValue;
  acc.cgst += inv.tax.cgst;
  acc.sgst += inv.tax.sgst;
  acc.igst += inv.tax.igst;
  acc.cess += inv.tax.cess;
}

function roundBreakup(b: TaxBreakup): TaxBreakup {
  return {
    taxableValue: round2(b.taxableValue),
    cgst: round2(b.cgst),
    sgst: round2(b.sgst),
    igst: round2(b.igst),
    cess: round2(b.cess),
  };
}

/**
 * @param sales  outward supplies (your sales invoices)
 * @param eligiblePurchases purchases whose ITC is eligible & claimable
 *        (typically the matched, eligible lines from reconciliation)
 */
export function computeGstr3b(
  sales: Invoice[],
  eligiblePurchases: Invoice[],
): Gstr3bSummary {
  const outward = emptyBreakup();
  for (const s of sales) addInto(outward, s);

  const itc = emptyBreakup();
  for (const p of eligiblePurchases) {
    if (p.itcEligible === false) continue;
    addInto(itc, p);
  }

  const outwardTaxableSupplies = roundBreakup(outward);
  const eligibleItc = roundBreakup(itc);

  const cgst = Math.max(0, round2(outwardTaxableSupplies.cgst - eligibleItc.cgst));
  const sgst = Math.max(0, round2(outwardTaxableSupplies.sgst - eligibleItc.sgst));
  const igst = Math.max(0, round2(outwardTaxableSupplies.igst - eligibleItc.igst));
  const cess = Math.max(0, round2(outwardTaxableSupplies.cess - eligibleItc.cess));

  return {
    outwardTaxableSupplies,
    eligibleItc,
    netTaxPayable: {
      cgst,
      sgst,
      igst,
      cess,
      total: round2(cgst + sgst + igst + cess),
    },
  };
}
