// Shared types mirroring the backend API contract (see server/src/types.ts).

export interface TaxBreakup {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface Invoice {
  supplierGstin: string;
  supplierName?: string;
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  tax: TaxBreakup;
  invoiceValue?: number;
  itcEligible?: boolean;
  // present on sales invoices used for GSTR-1
  buyerGstin?: string;
  placeOfSupply?: string;
}

export type MatchStatus =
  | 'EXACT_MATCH'
  | 'MISMATCH'
  | 'MISSING_IN_2B'
  | 'MISSING_IN_BOOKS';

export interface ReconResultLine {
  status: MatchStatus;
  supplierGstin: string;
  supplierName?: string;
  invoiceNo: string;
  invoiceDate?: string;
  itcInBooks: number;
  itcIn2B: number;
  itcDifference: number;
  note: string;
}

export interface ReconSummary {
  totalInvoicesInBooks: number;
  totalInvoicesIn2B: number;
  exactMatches: number;
  mismatches: number;
  missingIn2B: number;
  missingInBooks: number;
  itcAsPerBooks: number;
  itcAsPer2B: number;
  itcClaimableNow: number;
  itcAtRisk: number;
  itcUnclaimed: number;
}

export interface ReconciliationReport {
  summary: ReconSummary;
  lines: ReconResultLine[];
  options: { amountTolerance: number };
}

export interface Gstr3bSummary {
  outwardTaxableSupplies: TaxBreakup;
  eligibleItc: TaxBreakup;
  netTaxPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
}

export interface SampleData {
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
}
