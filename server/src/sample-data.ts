/**
 * Realistic sample data for a small seller in Maharashtra (state code 27),
 * filing for July 2026. Demonstrates every reconciliation outcome:
 *   - a clean match
 *   - an amount mismatch (supplier reported a slightly different value)
 *   - a purchase missing from GSTR-2B (supplier hasn't filed -> ITC at risk)
 *   - an invoice in GSTR-2B the seller forgot to record (unclaimed ITC)
 */

import type { Invoice } from './types.ts';

// The seller's own purchase register (their books).
export const samplePurchaseRegister: Invoice[] = [
  {
    supplierGstin: '27AABCU9603R1ZM',
    supplierName: 'Mumbai Packaging Supplies',
    invoiceNo: 'MPS/2026/104',
    invoiceDate: '2026-07-05',
    tax: { taxableValue: 50000, cgst: 4500, sgst: 4500, igst: 0, cess: 0 },
  },
  {
    supplierGstin: '29AAGCB7383J1Z4',
    supplierName: 'Bengaluru Components Pvt Ltd',
    invoiceNo: 'BC-889',
    invoiceDate: '2026-07-09',
    tax: { taxableValue: 120000, cgst: 0, sgst: 0, igst: 21600, cess: 0 },
  },
  {
    supplierGstin: '27AACCG1234H1Z8',
    supplierName: 'Pune Logistics',
    invoiceNo: 'PL/07/221',
    invoiceDate: '2026-07-15',
    tax: { taxableValue: 20000, cgst: 1800, sgst: 1800, igst: 0, cess: 0 },
  },
  {
    supplierGstin: '27AAECS5555K1Z1',
    supplierName: 'Sunrise Stationers',
    invoiceNo: 'SS-3390',
    invoiceDate: '2026-07-20',
    tax: { taxableValue: 8000, cgst: 720, sgst: 720, igst: 0, cess: 0 },
    itcEligible: false, // e.g. bought for personal use -> blocked credit
  },
];

// What suppliers actually reported (downloaded as GSTR-2B from the portal).
export const sampleGstr2b: Invoice[] = [
  {
    // matches MPS/2026/104 exactly
    supplierGstin: '27AABCU9603R1ZM',
    supplierName: 'Mumbai Packaging Supplies',
    invoiceNo: 'MPS-2026-104', // keyed with different separators on purpose
    invoiceDate: '2026-07-05',
    tax: { taxableValue: 50000, cgst: 4500, sgst: 4500, igst: 0, cess: 0 },
  },
  {
    // matches BC-889 but supplier reported IGST 21,000 vs books 21,600 -> MISMATCH
    supplierGstin: '29AAGCB7383J1Z4',
    supplierName: 'Bengaluru Components Pvt Ltd',
    invoiceNo: 'BC889',
    invoiceDate: '2026-07-09',
    tax: { taxableValue: 116667, cgst: 0, sgst: 0, igst: 21000, cess: 0 },
  },
  {
    // Sunrise SS-3390 present in 2B (but books marked it ineligible)
    supplierGstin: '27AAECS5555K1Z1',
    supplierName: 'Sunrise Stationers',
    invoiceNo: 'SS-3390',
    invoiceDate: '2026-07-20',
    tax: { taxableValue: 8000, cgst: 720, sgst: 720, igst: 0, cess: 0 },
  },
  {
    // In 2B but NOT in the seller's books -> unclaimed ITC opportunity
    supplierGstin: '27AAOFG9012P1ZR',
    supplierName: 'Nashik Hardware',
    invoiceNo: 'NH/556',
    invoiceDate: '2026-07-18',
    tax: { taxableValue: 15000, cgst: 1350, sgst: 1350, igst: 0, cess: 0 },
  },
  // NOTE: Pune Logistics PL/07/221 is intentionally absent here
  //       -> it's in books but MISSING_IN_2B -> ITC AT RISK.
];

// A few sales invoices for the GSTR-3B / GSTR-1 demo.
export const sampleSales: Array<
  Invoice & { buyerGstin?: string; placeOfSupply?: string }
> = [
  {
    supplierGstin: '27AAAAA0000A1Z5', // the seller's own GSTIN
    buyerGstin: '27BBBBB1111B1Z4',
    placeOfSupply: '27',
    invoiceNo: 'S-2026-01',
    invoiceDate: '2026-07-08',
    tax: { taxableValue: 200000, cgst: 18000, sgst: 18000, igst: 0, cess: 0 },
  },
  {
    supplierGstin: '27AAAAA0000A1Z5',
    buyerGstin: '24CCCCC2222C1Z3',
    placeOfSupply: '24',
    invoiceNo: 'S-2026-02',
    invoiceDate: '2026-07-14',
    tax: { taxableValue: 90000, cgst: 0, sgst: 0, igst: 16200, cess: 0 },
  },
];
