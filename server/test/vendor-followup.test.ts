import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVendorFollowUp } from '../src/vendor-followup.ts';
import { reconcile } from '../src/reconcile.ts';
import { samplePurchaseRegister, sampleGstr2b } from '../src/sample-data.ts';

test('follow-up lists only problem vendors (missing / mismatch)', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const followUp = buildVendorFollowUp(report.lines);

  // Sample data: Pune Logistics (missing in 2B) + Bengaluru (mismatch).
  assert.equal(followUp.length, 2);
  const gstins = followUp.map((v) => v.supplierGstin).sort();
  assert.deepEqual(gstins, ['27AACCG1234H1ZY', '29AAGCB7383J1Z4'].sort());
});

test('at-risk ITC and mismatch difference are computed per vendor', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const followUp = buildVendorFollowUp(report.lines);

  const pune = followUp.find((v) => v.supplierGstin === '27AACCG1234H1ZY')!;
  assert.equal(pune.atRiskItc, 3600); // 1800 + 1800
  assert.equal(pune.invoices[0]!.issue, 'MISSING_IN_2B');

  const blr = followUp.find((v) => v.supplierGstin === '29AAGCB7383J1Z4')!;
  assert.equal(blr.mismatchItcDifference, 600); // 21600 - 21000
  assert.equal(blr.invoices[0]!.issue, 'MISMATCH');
});

test('vendors are sorted by biggest ITC impact first', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const followUp = buildVendorFollowUp(report.lines);
  // Pune at-risk 3600 > Bengaluru mismatch 600
  assert.equal(followUp[0]!.supplierGstin, '27AACCG1234H1ZY');
});

test('suggested message mentions invoice numbers and rupee impact', () => {
  const report = reconcile(samplePurchaseRegister, sampleGstr2b);
  const followUp = buildVendorFollowUp(report.lines);
  const pune = followUp.find((v) => v.supplierGstin === '27AACCG1234H1ZY')!;
  assert.match(pune.suggestedMessage, /PL\/07\/221/);
  assert.match(pune.suggestedMessage, /GSTR-2B/);
  assert.match(pune.suggestedMessage, /\u20B9/); // rupee sign
});

test('clean reconciliation produces no follow-ups', () => {
  const books = [
    {
      supplierGstin: '27AABCU9603R1ZN',
      invoiceNo: 'A1',
      invoiceDate: '2026-07-01',
      tax: { taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 },
    },
  ];
  const report = reconcile(books, books);
  assert.equal(buildVendorFollowUp(report.lines).length, 0);
});
