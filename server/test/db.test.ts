import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/db.ts';
import { samplePurchaseRegister, sampleGstr2b, sampleSales } from '../src/sample-data.ts';

function seed(store: Store) {
  return store.savePeriod({
    gstin: '27AAAAA0000A1Z2',
    period: '072026',
    purchaseRegister: samplePurchaseRegister,
    gstr2b: sampleGstr2b,
    sales: sampleSales,
  });
}

test('save then load a filing period round-trips the data', () => {
  const store = new Store(':memory:');
  const id = seed(store);
  const rec = store.getPeriod(id);
  assert.ok(rec);
  assert.equal(rec.gstin, '27AAAAA0000A1Z2');
  assert.equal(rec.period, '072026');
  assert.equal(rec.purchaseRegister.length, samplePurchaseRegister.length);
  assert.equal(rec.gstr2b.length, sampleGstr2b.length);
  assert.equal(rec.purchaseRegister[0]!.supplierGstin, samplePurchaseRegister[0]!.supplierGstin);
  store.close();
});

test('saving the same gstin+period again updates (no duplicate)', () => {
  const store = new Store(':memory:');
  const id1 = seed(store);
  const id2 = store.savePeriod({
    gstin: '27AAAAA0000A1Z2',
    period: '072026',
    purchaseRegister: [],
    gstr2b: [],
    sales: [],
  });
  assert.equal(id1, id2);
  assert.equal(store.listPeriods().length, 1);
  assert.equal(store.getPeriod(id1)!.purchaseRegister.length, 0);
  store.close();
});

test('listPeriods returns summaries with counts, filterable by gstin', () => {
  const store = new Store(':memory:');
  seed(store);
  store.savePeriod({
    gstin: '29AAGCB7383J1Z4',
    period: '072026',
    purchaseRegister: [samplePurchaseRegister[0]!],
    gstr2b: [],
    sales: [],
  });

  const all = store.listPeriods();
  assert.equal(all.length, 2);

  const one = store.listPeriods('27AAAAA0000A1Z2');
  assert.equal(one.length, 1);
  assert.equal(one[0]!.counts.purchaseRegister, samplePurchaseRegister.length);
  assert.equal(one[0]!.counts.gstr2b, sampleGstr2b.length);
  store.close();
});

test('deletePeriod removes the record', () => {
  const store = new Store(':memory:');
  const id = seed(store);
  assert.equal(store.deletePeriod(id), true);
  assert.equal(store.getPeriod(id), null);
  assert.equal(store.deletePeriod(id), false);
  store.close();
});
