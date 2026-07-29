/**
 * ITC Reconciliation engine.
 *
 * Compares a buyer's PURCHASE REGISTER (their own books) against their
 * GSTR-2B (the auto-drafted statement of ITC available, downloaded from the
 * government portal). This is the core of the product: it tells a seller
 * exactly which Input Tax Credit they can safely claim, which is at risk
 * because a supplier hasn't filed, and where amounts disagree.
 */

import type {
  Invoice,
  TaxBreakup,
  MatchStatus,
  ReconResultLine,
  ReconSummary,
  ReconciliationReport,
  ReconcileOptions,
} from './types.ts';

const DEFAULT_TOLERANCE = 2; // rupees

/** Total ITC on an invoice = cgst + sgst + igst + cess. */
export function itcOf(tax: TaxBreakup): number {
  return round2(tax.cgst + tax.sgst + tax.igst + tax.cess);
}

/** Round to 2 decimals, avoiding floating point noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize an invoice number for matching. GST tools ignore case, spaces and
 * most punctuation, and treat leading zeros loosely, because suppliers and
 * buyers often key the same invoice slightly differently.
 * e.g. "INV-001", "inv 001", "INV/001" all collapse to "INV001".
 */
export function normalizeInvoiceNo(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // drop separators like - / space .
    .replace(/^0+(?=\d)/, ''); // drop leading zeros before a digit run
}

/** Basic GSTIN sanity check: 15 chars, correct structural pattern. */
export function isValidGstin(gstin: string): boolean {
  // 2 digit state code | 10 char PAN | 1 entity digit | 'Z' | 1 checksum char
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    gstin.toUpperCase(),
  );
}

function keyOf(inv: Invoice): string {
  return `${inv.supplierGstin.toUpperCase()}::${normalizeInvoiceNo(inv.invoiceNo)}`;
}

/**
 * Reconcile the purchase register against GSTR-2B.
 *
 * @param purchaseRegister invoices as recorded in the buyer's books
 * @param gstr2b invoices as reported by suppliers (from the portal)
 */
export function reconcile(
  purchaseRegister: Invoice[],
  gstr2b: Invoice[],
  options: ReconcileOptions = {},
): ReconciliationReport {
  const tolerance = options.amountTolerance ?? DEFAULT_TOLERANCE;

  const booksByKey = new Map<string, Invoice>();
  for (const inv of purchaseRegister) booksByKey.set(keyOf(inv), inv);

  const twoBByKey = new Map<string, Invoice>();
  for (const inv of gstr2b) twoBByKey.set(keyOf(inv), inv);

  const lines: ReconResultLine[] = [];

  // Running tallies for the summary. We match invoices on their ACTUAL tax
  // amounts (eligibility is a separate concern), then apply eligibility only
  // when deciding what ITC is actually claimable.
  let exactMatches = 0;
  let mismatches = 0;
  let missingIn2B = 0;
  let missingInBooks = 0;
  let itcClaimableNow = 0;
  let itcAtRisk = 0;
  let itcUnclaimed = 0;
  let itcAsPerBooks = 0;

  // Pass 1: walk the books, find each in 2B.
  for (const [key, bookInv] of booksByKey) {
    const match = twoBByKey.get(key);
    const rawItcBooks = itcOf(bookInv.tax); // actual tax on the invoice
    const isEligible = bookInv.itcEligible !== false;
    const eligibleItcBooks = isEligible ? rawItcBooks : 0;
    itcAsPerBooks += eligibleItcBooks;

    if (!match) {
      missingIn2B++;
      itcAtRisk += eligibleItcBooks;
      lines.push({
        status: 'MISSING_IN_2B',
        supplierGstin: bookInv.supplierGstin,
        supplierName: bookInv.supplierName,
        invoiceNo: bookInv.invoiceNo,
        invoiceDate: bookInv.invoiceDate,
        itcInBooks: rawItcBooks,
        itcIn2B: 0,
        itcDifference: round2(rawItcBooks),
        note:
          'In your books but not in GSTR-2B. Supplier likely has not filed. ' +
          'Do NOT claim this ITC yet — follow up with the supplier.',
      });
      continue;
    }

    const itc2B = itcOf(match.tax);
    const diff = round2(rawItcBooks - itc2B);
    const withinTolerance = Math.abs(diff) <= tolerance;
    const status: MatchStatus = withinTolerance ? 'EXACT_MATCH' : 'MISMATCH';

    if (withinTolerance) {
      exactMatches++;
      itcClaimableNow += eligibleItcBooks;
    } else {
      mismatches++;
      // Conservatively claim the lower of books vs 2B (0 if ineligible).
      itcClaimableNow += isEligible ? Math.min(rawItcBooks, itc2B) : 0;
    }

    let note: string;
    if (!withinTolerance) {
      note = `Tax amount differs by ${formatInr(diff)}. Verify invoice; claim the lower of the two to stay safe.`;
    } else if (!isEligible) {
      note = 'Matched with GSTR-2B, but this ITC is marked ineligible (e.g. blocked credit under Sec 17(5)) — not claimed.';
    } else {
      note = 'Matched with GSTR-2B. Safe to claim.';
    }

    lines.push({
      status,
      supplierGstin: bookInv.supplierGstin,
      supplierName: bookInv.supplierName ?? match.supplierName,
      invoiceNo: bookInv.invoiceNo,
      invoiceDate: bookInv.invoiceDate,
      itcInBooks: rawItcBooks,
      itcIn2B: itc2B,
      itcDifference: diff,
      note,
    });
  }

  // Pass 2: walk 2B, surface anything not in the books.
  for (const [key, twoBInv] of twoBByKey) {
    if (booksByKey.has(key)) continue;
    const itc2B = itcOf(twoBInv.tax);
    missingInBooks++;
    itcUnclaimed += itc2B;
    lines.push({
      status: 'MISSING_IN_BOOKS',
      supplierGstin: twoBInv.supplierGstin,
      supplierName: twoBInv.supplierName,
      invoiceNo: twoBInv.invoiceNo,
      invoiceDate: twoBInv.invoiceDate,
      itcInBooks: 0,
      itcIn2B: itc2B,
      itcDifference: round2(-itc2B),
      note:
        'In GSTR-2B but not in your books. Possibly a purchase you forgot to ' +
        'record — you may be able to claim additional ITC after verifying.',
    });
  }

  const itcAsPer2B = gstr2b.reduce((s, i) => s + itcOf(i.tax), 0);

  const summary: ReconSummary = {
    totalInvoicesInBooks: purchaseRegister.length,
    totalInvoicesIn2B: gstr2b.length,
    exactMatches,
    mismatches,
    missingIn2B,
    missingInBooks,
    itcAsPerBooks: round2(itcAsPerBooks),
    itcAsPer2B: round2(itcAsPer2B),
    itcClaimableNow: round2(itcClaimableNow),
    itcAtRisk: round2(itcAtRisk),
    itcUnclaimed: round2(itcUnclaimed),
  };

  return { summary, lines, options: { amountTolerance: tolerance } };
}

/** Format a rupee amount like ₹1,23,456.78 (Indian digit grouping). */
export function formatInr(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount).toFixed(2);
  const [whole, frac] = abs.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const intPart = rest ? `${grouped},${last3}` : last3;
  return `${sign}\u20B9${intPart}.${frac}`;
}
