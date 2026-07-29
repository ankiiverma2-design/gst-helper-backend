import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { formatInr } from '../lib/format.ts';

export default function VendorsPage() {
  const { vendors, runVendorFollowUp, purchaseRegister, gstr2b, loading } = useAppStore();

  useEffect(() => {
    if (!vendors && purchaseRegister.length && gstr2b.length) {
      void runVendorFollowUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasData = purchaseRegister.length > 0 && gstr2b.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          Load your data first, then we'll show which vendors to follow up with.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Vendor follow-up</h2>
          <p className="text-sm text-slate-500">
            Suppliers whose filings are costing you Input Tax Credit — chase these first.
          </p>
        </div>
        <button
          onClick={runVendorFollowUp}
          disabled={loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {vendors && vendors.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-700">
          🎉 No problem vendors — everything reconciles cleanly.
        </div>
      )}

      <div className="space-y-4">
        {vendors?.map((v) => (
          <div
            key={v.supplierGstin}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {v.supplierName ?? 'Unknown supplier'}
                </div>
                <div className="text-xs text-slate-400">{v.supplierGstin}</div>
              </div>
              <div className="text-right">
                {v.atRiskItc > 0 && (
                  <div className="text-sm font-semibold text-red-700">
                    {formatInr(v.atRiskItc)} at risk
                  </div>
                )}
                {v.mismatchItcDifference !== 0 && (
                  <div className="text-xs text-amber-700">
                    mismatch diff {formatInr(v.mismatchItcDifference)}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {v.invoiceCount} invoice{v.invoiceCount > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              {v.invoices.map((inv, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 font-medium ${
                      inv.issue === 'MISSING_IN_2B'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {inv.issue === 'MISSING_IN_2B' ? 'Missing in 2B' : 'Mismatch'}
                  </span>
                  <span className="font-medium text-slate-700">{inv.invoiceNo}</span>
                  <span>{inv.invoiceDate}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Suggested message
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(v.suggestedMessage)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-slate-600">{v.suggestedMessage}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
