import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { getApiBase, setApiBase } from '../lib/api.ts';

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    purchaseRegister,
    gstr2b,
    sales,
    loadSample,
    runReconcile,
    reset,
    loading,
  } = useAppStore();
  const [apiUrl, setApiUrl] = useState(getApiBase());

  useEffect(() => {
    setApiBase(apiUrl.trim());
  }, [apiUrl]);

  const hasData = purchaseRegister.length > 0 && gstr2b.length > 0;

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
          Point this at your deployed backend (e.g. https://your-app.onrender.com).
          Defaults to http://localhost:3000 for local development.
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
          Load your purchase register (your books) and your GSTR-2B (downloaded from
          the GST portal). No real files yet? Use the sample data to see the whole
          flow instantly.
        </p>

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
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DataStat label="Purchase invoices (books)" count={purchaseRegister.length} />
          <DataStat label="GSTR-2B invoices" count={gstr2b.length} />
          <DataStat label="Sales invoices" count={sales.length} />
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Real file upload (CSV/Excel purchase register + GSTR-2B JSON) is on the
          roadmap. For now, the sample data demonstrates the full reconciliation.
        </div>
      </section>

      {/* Reconcile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">2. Reconcile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Match your books against GSTR-2B to see what you can safely claim.
        </p>
        <button
          onClick={handleReconcile}
          disabled={!hasData || loading}
          className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Reconcile now
        </button>
        {!hasData && (
          <p className="mt-2 text-xs text-slate-400">
            Load some data first (try “Use sample data”).
          </p>
        )}
      </section>
    </div>
  );
}

function DataStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-2xl font-bold text-slate-900">{count}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
