import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGstr1Json } from '../src/gstr1.ts';

const base = {
  supplierGstin: '27AAAAA0000A1Z2',
  filingPeriod: '072026',
  b2bSales: [],
};

test('B2CL includes large inter-state B2C invoices, excludes small/intra', () => {
  const json = buildGstr1Json({
    ...base,
    b2clSales: [
      // large inter-state -> included
      {
        supplierGstin: '27AAAAA0000A1Z2',
        placeOfSupply: '29',
        invoiceNo: 'BL-1',
        invoiceDate: '2026-07-10',
        tax: { taxableValue: 200000, cgst: 0, sgst: 0, igst: 36000, cess: 0 },
      },
      // inter-state but below threshold -> excluded
      {
        supplierGstin: '27AAAAA0000A1Z2',
        placeOfSupply: '29',
        invoiceNo: 'BL-2',
        invoiceDate: '2026-07-11',
        tax: { taxableValue: 5000, cgst: 0, sgst: 0, igst: 900, cess: 0 },
      },
      // intra-state -> excluded (belongs in b2cs)
      {
        supplierGstin: '27AAAAA0000A1Z2',
        placeOfSupply: '27',
        invoiceNo: 'BL-3',
        invoiceDate: '2026-07-12',
        tax: { taxableValue: 300000, cgst: 27000, sgst: 27000, igst: 0, cess: 0 },
      },
    ],
    options: { b2clThreshold: 100000 },
  });

  const b2cl = json.b2cl as Array<{ pos: string; inv: Array<{ inum: string }> }>;
  assert.ok(b2cl);
  assert.equal(b2cl.length, 1);
  assert.equal(b2cl[0]!.pos, '29');
  assert.equal(b2cl[0]!.inv.length, 1);
  assert.equal(b2cl[0]!.inv[0]!.inum, 'BL-1');
});

test('CDNR groups credit/debit notes by buyer and keeps note type', () => {
  const json = buildGstr1Json({
    ...base,
    creditDebitNotes: [
      {
        buyerGstin: '29AAGCB7383J1Z4',
        noteNo: 'CN-1',
        noteDate: '2026-07-15',
        noteType: 'C',
        placeOfSupply: '29',
        tax: { taxableValue: 10000, cgst: 0, sgst: 0, igst: 1800, cess: 0 },
      },
      {
        buyerGstin: '29AAGCB7383J1Z4',
        noteNo: 'DN-1',
        noteDate: '2026-07-16',
        noteType: 'D',
        placeOfSupply: '29',
        tax: { taxableValue: 2000, cgst: 0, sgst: 0, igst: 360, cess: 0 },
      },
    ],
  });

  const cdnr = json.cdnr as Array<{ ctin: string; nt: Array<{ ntty: string; nt_dt: string }> }>;
  assert.equal(cdnr.length, 1);
  assert.equal(cdnr[0]!.ctin, '29AAGCB7383J1Z4');
  assert.equal(cdnr[0]!.nt.length, 2);
  assert.deepEqual(
    cdnr[0]!.nt.map((n) => n.ntty).sort(),
    ['C', 'D'],
  );
  assert.equal(cdnr[0]!.nt[0]!.nt_dt, '15-07-2026'); // DD-MM-YYYY
});

test('EXP groups exports by type and carries shipping bill details', () => {
  const json = buildGstr1Json({
    ...base,
    exports: [
      {
        exportType: 'WPAY',
        invoiceNo: 'EXP-1',
        invoiceDate: '2026-07-20',
        rate: 18,
        tax: { taxableValue: 500000, cgst: 0, sgst: 0, igst: 90000, cess: 0 },
        portCode: 'INNSA1',
        shippingBillNo: '7259834',
        shippingBillDate: '2026-07-21',
      },
      {
        exportType: 'WOPAY',
        invoiceNo: 'EXP-2',
        invoiceDate: '2026-07-22',
        rate: 0,
        tax: { taxableValue: 300000, cgst: 0, sgst: 0, igst: 0, cess: 0 },
      },
    ],
  });

  const exp = json.exp as Array<{ exp_typ: string; inv: Array<{ inum: string; sbnum: string }> }>;
  assert.equal(exp.length, 2);
  const wpay = exp.find((e) => e.exp_typ === 'WPAY')!;
  assert.equal(wpay.inv[0]!.inum, 'EXP-1');
  assert.equal(wpay.inv[0]!.sbnum, '7259834');
});

test('empty optional sections are omitted from the document', () => {
  const json = buildGstr1Json({
    ...base,
    b2bSales: [
      {
        supplierGstin: '27AAAAA0000A1Z2',
        buyerGstin: '29AAGCB7383J1Z4',
        placeOfSupply: '29',
        invoiceNo: 'S1',
        invoiceDate: '2026-07-01',
        tax: { taxableValue: 1000, cgst: 0, sgst: 0, igst: 180, cess: 0 },
      },
    ],
  });
  assert.ok(json.b2b);
  assert.equal(json.b2cl, undefined);
  assert.equal(json.cdnr, undefined);
  assert.equal(json.exp, undefined);
});
