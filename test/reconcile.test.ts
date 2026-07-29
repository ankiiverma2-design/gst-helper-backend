import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, normalizeInvoiceNo, isValidGstin, formatInr } from '../src/reconcile.ts';
import { computeGstr3b } from '../src/gstr3b.ts';
import { buildGstr1Json } from '../src/gstr1.ts';
import {
  samplePurchaseRegister,
  sampleGstr2b,
  sampleSales,
} from '../src/sample-data.ts';

test('invoice number normalization ignores case and separators', () => {
  assert.equal(normalizeInvoiceNo('INV-001'), 'INV001');
  assert.equal(normalizeInvoiceNo('inv 001'), 'INV001');
  assert.equal(normalizeInvoiceNo('MPS/2026/104'), 'MPS2026104');
  assert.equal(normalizeInvoiceNo('MPS-2026-104'), 'MPS2026104');
  // purely numeric leading zeros are dropped
  assert.equal(normalizeInvoiceNo('0012'), '12');
});

test('GSTIN validation accepts a well-formed GSTIN and rejects junk', () => {
  assert.ok(isValidGstin('27AABCU9603R1ZM'));
  assert.ok(!isValidGstin('BADGSTIN'));
  assert.ok(!isValidGstin('27AABCU9603R1Z')); // 14 chars
});

test('reconciliation classifies every outcome correctly', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const { summary } = report;

  // 4 in books, 4 in 2B (per sample data)
  assert.equal(summary.totalInvoicesInBooks, 4);
  assert.equal(summary.totalInvoicesIn2B, 4);

  // MPS matches exactly. Sunrise matches but is ineligible (still EXACT_MATCH status).
  assert.equal(summary.exactMatches, 2);
  // Bengaluru IGST differs 21600 vs 21000 -> mismatch
  assert.equal(summary.mismatches, 1);
  // Pune Logistics in books, absent in 2B -> at risk
  assert.equal(summary.missingIn2B, 1);
  // Nashik Hardware in 2B, absent from books -> unclaimed
  assert.equal(summary.missingInBooks, 1);

  // ITC at risk = Pune Logistics 1800+1800 = 3600
  assert.equal(summary.itcAtRisk, 3600);
  // Unclaimed = Nashik 1350+1350 = 2700
  assert.equal(summary.itcUnclaimed, 2700);
});

test('mismatched line claims the lower (safer) ITC amount', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const mismatch = report.lines.find((l) => l.status === 'MISMATCH');
  assert.ok(mismatch);
  assert.equal(mismatch.itcInBooks, 21600);
  assert.equal(mismatch.itcIn2B, 21000);
  assert.equal(mismatch.itcDifference, 600);
});

test('ineligible ITC matches 2B but is excluded from claimable total', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const sunrise = report.lines.find((l) => l.invoiceNo === 'SS-3390');
  assert.ok(sunrise);
  // It DOES match 2B (raw amounts agree)...
  assert.equal(sunrise.status, 'EXACT_MATCH');
  assert.equal(sunrise.itcInBooks, 1440);
  assert.match(sunrise.note, /ineligible/i);
  // ...but its ITC is NOT counted as claimable.
  // Claimable = MPS 9000 + Bengaluru min(21600,21000)=21000 + Sunrise 0 = 30000
  assert.equal(report.summary.itcClaimableNow, 30000);
});

test('amount tolerance can absorb small rounding differences', () => {
  const books = [
    {
      supplierGstin: '27AABCU9603R1ZM',
      invoiceNo: 'A1',
      invoiceDate: '2026-07-01',
      tax: { taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 },
    },
  ];
  const twoB = [
    {
      supplierGstin: '27AABCU9603R1ZM',
      invoiceNo: 'A1',
      invoiceDate: '2026-07-01',
      tax: { taxableValue: 1000, cgst: 89, sgst: 90, igst: 0, cess: 0 },
    },
  ];
  const strict = reconcile(books, twoB, { amountTolerance: 0 });
  assert.equal(strict.summary.mismatches, 1);
  const lenient = reconcile(books, twoB, { amountTolerance: 2 });
  assert.equal(lenient.summary.exactMatches, 1);
});

test('GSTR-3B nets output tax against eligible ITC, floored at zero per head', () => {
  // Use matched+eligible purchases as claimable ITC.
  const eligible = samplePurchaseRegister.filter((p) => p.itcEligible !== false);
  const g3b = computeGstr3b(sampleSales, eligible);

  // Output: CGST 18000, SGST 18000, IGST 16200
  assert.equal(g3b.outwardTaxableSupplies.cgst, 18000);
  assert.equal(g3b.outwardTaxableSupplies.igst, 16200);

  // Net payable should never be negative on any head.
  assert.ok(g3b.netTaxPayable.cgst >= 0);
  assert.ok(g3b.netTaxPayable.igst >= 0);
  assert.ok(g3b.netTaxPayable.total >= 0);
});

test('GSTR-1 export groups B2B by buyer and uses portal date format', () => {
  const json = buildGstr1Json({
    supplierGstin: '27AAAAA0000A1Z5',
    filingPeriod: '072026',
    b2bSales: sampleSales.map((s) => ({
      ...s,
      buyerGstin: (s as { buyerGstin: string }).buyerGstin,
      placeOfSupply: (s as { placeOfSupply: string }).placeOfSupply,
    })),
  });
  const b2b = json.b2b as Array<{ ctin: string; inv: Array<{ idt: string }> }>;
  assert.equal(b2b.length, 2); // two distinct buyers
  assert.equal(b2b[0].inv[0].idt, '08-07-2026'); // DD-MM-YYYY
});

test('Indian rupee formatting uses lakh/crore grouping', () => {
  assert.equal(formatInr(123456.78), '\u20B91,23,456.78');
  assert.equal(formatInr(-3600), '-\u20B93,600.00');
  assert.equal(formatInr(500), '\u20B9500.00');
});
