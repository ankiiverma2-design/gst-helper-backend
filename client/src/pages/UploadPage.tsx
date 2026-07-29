import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { getApiBase, setApiBase } from '../lib/api.ts';

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    purchaseRegister,
    gstr2b,
    sales,
    periods,
    loadSample,
    importPurchaseCsv,
    importGstr2bJson,
    runReconcile,
    refreshPeriods,
    savePeriod,
    loadPeriod,
    removePeriod,
    reset,
    loading,
  } = useAppStore();

  const [apiUrl, setApiUrl] = useState(getApiBase());
  const [gstin, setGstin] = useState('27AAAAA0000A1Z2');
  const [period, setPeriod] = useState('072026');

  useEffect(() => {
    setApiBase(apiUrl.trim());
  }, [apiUrl]);

  useEffect(() => {
    void refreshPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasData = purchaseRegister.length > 0 && gstr2b.length > 0;

  async function handleCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await importPurchaseCsv(await file.text());
    e.target.value = '';
  }

  async function handleGstr2b(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      await importGstr2bJson(json);
    } catch {
      alert('That file is not valid JSON. Download GSTR-2B as JSON from the portal.');
    }
    e.target.value = '';
  }

  async function handleReconcile() {
    const r = await runReconcile();
    if (r) navigate('/dashboard');
  }

  return (
    <div className="space-y-6">
      {/* API settings */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-slate-700">Backend API URL</label>
        <p className="mb-2 text-xs text-slate-500">
          Point this at your deployed backend. Defaults to http://localhost:3000.
        </p>
        <input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="http://localhost:3000"
        />
      </section>

      {/* Load data */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">1. Load your data</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload your purchase register (CSV) and your GSTR-2B (JSON from the portal),
          or use the sample data to see the whole flow instantly.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileDrop
            title="Purchase register (CSV)"
            desc="Columns: GSTIN, Invoice No, Date, Taxable, CGST, SGST, IGST, Cess"
            accept=".csv,text/csv"
            onChange={handleCsv}
            count={purchaseRegister.length}
            countLabel="purchase invoices"
          />
          <FileDrop
            title="GSTR-2B (JSON)"
            desc="The JSON file downloaded from the GST portal"
            accept=".json,application/json"
            onChange={handleGstr2b}
            count={gstr2b.length}
            countLabel="2B invoices"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={loadSample}
            disabled={loading}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Use sample data
          </button>
          <button
            onClick={reset}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Clear
          </button>
          <span className="self-center text-xs text-slate-400">
            {sales.length} sales invoices loaded
          </span>
        </div>
      </section>

      {/* Reconcile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">2. Reconcile</h2>
        <button
          onClick={handleReconcile}
          disabled={!hasData || loading}
          className="mt-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Reconcile now
        </button>
        {!hasData && (
          <p className="mt-2 text-xs text-slate-400">
            Load both a purchase register and GSTR-2B first (or use sample data).
          </p>
        )}
      </section>

      {/* Saved filing periods */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">3. Save / load a filing period</h2>
        <p className="mt-1 text-sm text-slate-500">
          Save the current data so you can come back to it. Keyed by GSTIN + month.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500">Your GSTIN</label>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Period (MMYYYY)</label>
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => savePeriod(gstin, period)}
            disabled={loading || !gstin || !period}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            Save current
          </button>
        </div>

        {periods.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{p.period}</span>{' '}
                  <span className="text-slate-400">{p.gstin}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {p.counts.purchaseRegister} purch · {p.counts.gstr2b} 2B · {p.counts.sales} sales
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => loadPeriod(p.id)}
                    className="text-brand-600 hover:underline"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => removePeriod(p.id)}
                    className="text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FileDrop({
  title,
  desc,
  accept,
  onChange,
  count,
  countLabel,
}: {
  title: string;
  desc: string;
  accept: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  count: number;
  countLabel: string;
}) {
  return (
    <label className="flex cursor-pointer flex-col rounded-lg border border-dashed border-slate-300 p-4 hover:border-brand-400 hover:bg-brand-50/40">
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      <span className="mt-0.5 text-xs text-slate-500">{desc}</span>
      <input type="file" accept={accept} onChange={onChange} className="mt-2 text-xs" />
      <span className="mt-2 text-xs font-medium text-slate-600">
        {count > 0 ? `✓ ${count} ${countLabel} loaded` : 'No file loaded yet'}
      </span>
    </label>
  );
}
