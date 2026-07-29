/**
 * Core GST domain types.
 *
 * India's GST splits tax into:
 *  - CGST + SGST for intra-state supplies (buyer & supplier in same state)
 *  - IGST for inter-state supplies
 *  - Cess for specific goods (tobacco, cars, etc.)
 *
 * "ITC" = Input Tax Credit: the GST a business paid on its purchases, which it
 * can subtract from the GST it collected on sales. Claiming the CORRECT ITC is
 * the single biggest reconciliation pain, because you can only claim ITC that
 * your supplier actually reported (it shows up in your auto-drafted GSTR-2B).
 */

/** The four components of GST on any line/invoice, in rupees. */
export interface TaxBreakup {
  taxableValue: number; // value of goods/services before tax
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * A single tax invoice, used both for the buyer's own purchase register
 * (what they recorded in their books) and for GSTR-2B rows (what suppliers
 * reported to the government).
 */
export interface Invoice {
  /** Supplier's 15-char GSTIN. */
  supplierGstin: string;
  /** Supplier trade name (optional, for display). */
  supplierName?: string;
  /** Invoice number exactly as written on the document. */
  invoiceNo: string;
  /** Invoice date in ISO format (YYYY-MM-DD). */
  invoiceDate: string;
  /** Tax amounts. */
  tax: TaxBreakup;
  /** Invoice value (taxable + all taxes). Optional; derived if absent. */
  invoiceValue?: number;
  /**
   * Whether this ITC is eligible to be claimed. Some purchases (personal use,
   * blocked credits under Sec 17(5)) are ineligible even if they appear in 2B.
   */
  itcEligible?: boolean;

  // --- Optional fields used for GSTR-1 (outward supplies) ---
  /** HSN/SAC code of the goods or service. */
  hsn?: string;
  /** Short description of the item. */
  description?: string;
  /** Unit Quantity Code, e.g. NOS, KGS, PCS. */
  uqc?: string;
  /** Quantity supplied. */
  quantity?: number;
  /** Combined GST rate as a percentage, e.g. 18. */
  rate?: number;
}

/** One row of the HSN-wise summary required in GSTR-1. */
export interface HsnSummaryRow {
  hsn: string;
  description?: string;
  uqc: string;
  totalQuantity: number;
  rate: number;
  totalValue: number; // taxable + all taxes
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

/** How a purchase-register invoice lines up against GSTR-2B. */
export type MatchStatus =
  | 'EXACT_MATCH' // present in both; tax amounts agree within tolerance
  | 'MISMATCH' // present in both; tax amounts differ (probable match, needs review)
  | 'MISSING_IN_2B' // in your books but supplier has NOT reported it -> ITC AT RISK
  | 'MISSING_IN_BOOKS'; // in GSTR-2B but not recorded in your books -> unclaimed/unknown

/** Result of comparing one purchase-register entry with GSTR-2B. */
export interface ReconResultLine {
  status: MatchStatus;
  supplierGstin: string;
  supplierName?: string;
  invoiceNo: string;
  invoiceDate?: string;
  /** ITC amount from the buyer's books (cgst+sgst+igst+cess). */
  itcInBooks: number;
  /** ITC amount as reported in GSTR-2B. */
  itcIn2B: number;
  /** Positive => books claim more than 2B allows; negative => 2B has more. */
  itcDifference: number;
  /** Human-readable explanation of the issue and suggested action. */
  note: string;
}

/** Rolled-up totals for a reconciliation run. */
export interface ReconSummary {
  totalInvoicesInBooks: number;
  totalInvoicesIn2B: number;
  exactMatches: number;
  mismatches: number;
  missingIn2B: number;
  missingInBooks: number;
  /** ITC you recorded in your books. */
  itcAsPerBooks: number;
  /** ITC available per GSTR-2B. */
  itcAsPer2B: number;
  /** ITC you can safely claim now (matched & eligible). */
  itcClaimableNow: number;
  /** ITC recorded in books but NOT in 2B — at risk until supplier files. */
  itcAtRisk: number;
  /** ITC in 2B not yet recorded in your books — potentially unclaimed. */
  itcUnclaimed: number;
}

export interface ReconciliationReport {
  summary: ReconSummary;
  lines: ReconResultLine[];
  /** Options actually used for this run (for transparency/audit). */
  options: Required<ReconcileOptions>;
}

export interface ReconcileOptions {
  /**
   * Rupee tolerance when comparing tax amounts. GST portals commonly treat
   * differences within a small rounding band as matches. Default ₹2.
   */
  amountTolerance?: number;
}

/** GSTR-3B is the monthly summary return of tax payable and ITC claimed. */
export interface Gstr3bSummary {
  outwardTaxableSupplies: TaxBreakup; // from sales
  eligibleItc: TaxBreakup; // from purchases (claimable)
  /** Net tax payable in cash = output tax - eligible ITC, floored at 0 per head. */
  netTaxPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
}
