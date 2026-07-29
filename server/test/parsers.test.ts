import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  parseCsvPurchaseRegister,
  parseGstr2bJson,
  normalizeDate,
} from '../src/parsers.ts';

test('parseCsv handles quotes, embedded commas and escaped quotes', () => {
  const rows = parseCsv('a,b,c\n"x,y","he said ""hi""",z\n');
  assert.deepEqual(rows[0], ['a', 'b', 'c']);
  assert.deepEqual(rows[1], ['x,y', 'he said "hi"', 'z']);
});

test('normalizeDate accepts common Indian formats', () => {
  assert.equal(normalizeDate('2026-07-05'), '2026-07-05');
  assert.equal(normalizeDate('05-07-2026'), '2026-07-05');
  assert.equal(normalizeDate('5/7/2026'), '2026-07-05');
});

test('parseCsvPurchaseRegister maps aliased headers and tax columns', () => {
  const csv = [
    'GSTIN,Supplier Name,Invoice No,Invoice Date,Taxable Value,CGST,SGST,IGST,Cess,Eligible',
    '27AABCU9603R1ZN,Mumbai Packaging,MPS/2026/104,05-07-2026,50000,4500,4500,0,0,Yes',
    '29AAGCB7383J1Z4,Bengaluru Components,BC-889,09/07/2026,120000,0,0,21600,0,No',
  ].join('\n');

  const { invoices, errors } = parseCsvPurchaseRegister(csv);
  assert.equal(errors.length, 0);
  assert.equal(invoices.length, 2);

  const first = invoices[0]!;
  assert.equal(first.supplierGstin, '27AABCU9603R1ZN');
  assert.equal(first.supplierName, 'Mumbai Packaging');
  assert.equal(first.invoiceNo, 'MPS/2026/104');
  assert.equal(first.invoiceDate, '2026-07-05');
  assert.equal(first.tax.cgst, 4500);
  assert.equal(first.itcEligible, true);

  assert.equal(invoices[1]!.tax.igst, 21600);
  assert.equal(invoices[1]!.itcEligible, false);
});

test('parseCsvPurchaseRegister reports rows missing required fields', () => {
  const csv = [
    'GSTIN,Invoice No,Taxable Value,CGST,SGST',
    ',NO-GSTIN-1,100,9,9',
    '27AABCU9603R1ZN,,100,9,9',
  ].join('\n');
  const { invoices, errors } = parseCsvPurchaseRegister(csv);
  assert.equal(invoices.length, 0);
  assert.equal(errors.length, 2);
});

test('parseGstr2bJson reads the portal b2b structure (nested itm_det)', () => {
  const portal = {
    data: {
      docdata: {
        b2b: [
          {
            ctin: '27AABCU9603R1ZN',
            trdnm: 'Mumbai Packaging Supplies',
            inv: [
              {
                inum: 'MPS-2026-104',
                dt: '05-07-2026',
                val: 59000,
                itms: [
                  {
                    num: 1,
                    itm_det: { rt: 18, txval: 50000, camt: 4500, samt: 4500, iamt: 0, csamt: 0 },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
  const { invoices, errors } = parseGstr2bJson(portal);
  assert.equal(errors.length, 0);
  assert.equal(invoices.length, 1);
  const inv = invoices[0]!;
  assert.equal(inv.supplierGstin, '27AABCU9603R1ZN');
  assert.equal(inv.supplierName, 'Mumbai Packaging Supplies');
  assert.equal(inv.invoiceNo, 'MPS-2026-104');
  assert.equal(inv.invoiceDate, '2026-07-05');
  assert.equal(inv.tax.taxableValue, 50000);
  assert.equal(inv.tax.cgst, 4500);
  assert.equal(inv.tax.sgst, 4500);
});

test('parseGstr2bJson sums multiple line items and accepts flat amounts', () => {
  const portal = {
    b2b: [
      {
        ctin: '29AAGCB7383J1Z4',
        inv: [
          {
            inum: 'BC889',
            dt: '09-07-2026',
            items: [
              { rt: 18, txval: 100000, iamt: 18000 },
              { rt: 18, txval: 16667, iamt: 3000 },
            ],
          },
        ],
      },
    ],
  };
  const { invoices } = parseGstr2bJson(portal);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]!.tax.taxableValue, 116667);
  assert.equal(invoices[0]!.tax.igst, 21000);
});

test('parseGstr2bJson errors when no b2b section present', () => {
  const { invoices, errors } = parseGstr2bJson({ foo: 'bar' });
  assert.equal(invoices.length, 0);
  assert.ok(errors.length > 0);
});

test('parsed CSV + parsed 2B can flow into reconciliation', async () => {
  const { reconcile } = await import('../src/reconcile.ts');
  const csv = [
    'GSTIN,Invoice No,Invoice Date,Taxable Value,CGST,SGST,IGST,Cess',
    '27AABCU9603R1ZN,MPS/2026/104,05-07-2026,50000,4500,4500,0,0',
  ].join('\n');
  const { invoices: books } = parseCsvPurchaseRegister(csv);
  const { invoices: twoB } = parseGstr2bJson({
    b2b: [
      {
        ctin: '27AABCU9603R1ZN',
        inv: [
          {
            inum: 'MPS-2026-104',
            dt: '05-07-2026',
            itms: [{ itm_det: { txval: 50000, camt: 4500, samt: 4500 } }],
          },
        ],
      },
    ],
  });
  const report = reconcile(books, twoB);
  assert.equal(report.summary.exactMatches, 1);
  assert.equal(report.summary.itcClaimableNow, 9000);
});
