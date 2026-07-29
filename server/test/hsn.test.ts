import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHsnSummary } from '../src/hsn.ts';
import type { Invoice } from '../src/types.ts';

const mk = (over: Partial<Invoice>): Invoice => ({
  supplierGstin: '27AAAAA0000A1Z2',
  invoiceNo: 'X',
  invoiceDate: '2026-07-01',
  tax: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 },
  ...over,
});

test('groups sales by HSN + rate and sums amounts', () => {
  const sales: Invoice[] = [
    mk({ hsn: '3923', quantity: 10, tax: { taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 } }),
    mk({ hsn: '3923', quantity: 5, tax: { taxableValue: 500, cgst: 45, sgst: 45, igst: 0, cess: 0 } }),
    mk({ hsn: '8471', quantity: 2, tax: { taxableValue: 2000, cgst: 0, sgst: 0, igst: 360, cess: 0 } }),
  ];
  const rows = computeHsnSummary(sales);
  assert.equal(rows.length, 2);

  const r3923 = rows.find((r) => r.hsn === '3923')!;
  assert.equal(r3923.rate, 18);
  assert.equal(r3923.taxableValue, 1500);
  assert.equal(r3923.cgst, 135);
  assert.equal(r3923.sgst, 135);
  assert.equal(r3923.totalQuantity, 15);
  assert.equal(r3923.totalValue, 1770); // 1500 + 135 + 135

  const r8471 = rows.find((r) => r.hsn === '8471')!;
  assert.equal(r8471.rate, 18);
  assert.equal(r8471.igst, 360);
});

test('same HSN with different rates produces separate rows', () => {
  const sales: Invoice[] = [
    mk({ hsn: '1234', tax: { taxableValue: 1000, cgst: 25, sgst: 25, igst: 0, cess: 0 } }), // 5%
    mk({ hsn: '1234', tax: { taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 } }), // 18%
  ];
  const rows = computeHsnSummary(sales);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.rate).sort((a, b) => a - b),
    [5, 18],
  );
});

test('sales without HSN are grouped under UNCLASSIFIED, nothing dropped', () => {
  const sales: Invoice[] = [
    mk({ tax: { taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 } }),
  ];
  const rows = computeHsnSummary(sales);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.hsn, 'UNCLASSIFIED');
  assert.equal(rows[0]!.taxableValue, 1000);
});
