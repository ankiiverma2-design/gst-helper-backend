import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { buildGstr1 } from '../lib/api.ts';
import { formatInr } from '../lib/format.ts';
import type { Invoice, TaxBreakup } from '../lib/types.ts';

export default function ReturnsPage() {
  const { sales, gstr3b, runGstr3b, loading } = useAppStore();
  const [gstr1Status, setGstr1Status] = useState<string | null>(null);

  async function handleExportGstr1() {
    setGstr1Status(null);
    // Only B2B sales (those with a buyer GSTIN) go into the b2b section.
    const b2bSales = sales
      .filter((s): s is Invoice & { buyerGstin: string; placeOfSupply: string } =>
        Boolean(s.buyerGstin && s.placeOfSupply),
      )
      .map((s) => ({ ...s, buyerGstin: s.buyerGstin!, placeOfSupply: s.placeOfSupply! }));

    if (b2bSales.length === 0) {
      setGstr1Status('No B2B sales with a buyer GSTIN found. Load sample data first.');
      return;
    }

    const supplierGstin = sales[0]?.supplierGstin ?? '27AAAAA0000A1Z5';
    // Filing period MMYYYY from the first sale's month (fallback current).
    const d = sales[0]?.invoiceDate ? new Date(sales[0].invoiceDate) : new Date();
    const filingPeriod = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;

    try {
      const json = await buildGstr1(supplierGstin, filingPeriod, b2bSales);
      downloadJson(json, `GSTR1_${filingPeriod}.json`);
      setGstr1Status(`Downloaded GSTR1_${filingPeriod}.json — upload it on the GST portal.`);
    } catch (e) {
      setGstr1Status(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      {/* GSTR-3B */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">GSTR-3B summary</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your monthly tax payable = output tax on sales − eligible ITC on purchases.
        </p>
        <button
          onClick={runGstr3b}
          disabled={loading || sales.length === 0}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          Compute GSTR-3B
        </button>

        {gstr3b && (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <BreakupCard title="Output tax (sales)" tax={gstr3b.outwardTaxableSupplies} />
            <BreakupCard title="Eligible ITC (purchases)" tax={gstr3b.eligibleItc} />
            <div className="rounded-lg border border-slate-900/10 bg-slate-900 p-4 text-white">
              <div className="text-xs uppercase tracking-wide text-slate-300">
                Net tax payable (cash)
              </div>
              <div className="mt-1 text-3xl font-bold">
                {formatInr(gstr3b.netTaxPayable.total)}
              </div>
              <dl className="mt-3 space-y-1 text-sm text-slate-300">
                <Line label="CGST" value={gstr3b.netTaxPayable.cgst} />
                <Line label="SGST" value={gstr3b.netTaxPayable.sgst} />
                <Line label="IGST" value={gstr3b.netTaxPayable.igst} />
                <Line label="Cess" value={gstr3b.netTaxPayable.cess} />
              </dl>
            </div>
          </div>
        )}
      </section>

      {/* GSTR-1 export */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Export GSTR-1</h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate a portal-ready JSON of your outward supplies. Download it and
          upload it on the official GST portal (or hand it to your CA).
        </p>
        <button
          onClick={handleExportGstr1}
          disabled={loading || sales.length === 0}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Export GSTR-1 JSON
        </button>
        {gstr1Status && <p className="mt-3 text-sm text-slate-600">{gstr1Status}</p>}
        {sales.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            No sales loaded.{' '}
            <Link to="/" className="text-brand-600 underline">
              Load sample data
            </Link>{' '}
            first.
          </p>
        )}
      </section>
    </div>
  );
}

function BreakupCard({ title, tax }: { title: string; tax: TaxBreakup }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <Line label="Taxable value" value={tax.taxableValue} dark />
        <Line label="CGST" value={tax.cgst} dark />
        <Line label="SGST" value={tax.sgst} dark />
        <Line label="IGST" value={tax.igst} dark />
        <Line label="Cess" value={tax.cess} dark />
      </dl>
    </div>
  );
}

function Line({ label, value, dark }: { label: string; value: number; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={dark ? 'text-slate-500' : ''}>{label}</span>
      <span className={dark ? 'font-medium text-slate-900' : 'font-medium'}>
        {formatInr(value)}
      </span>
    </div>
  );
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
