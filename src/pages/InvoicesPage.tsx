import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import StatusBadge from '../components/StatusBadge.tsx';
import { formatInr } from '../lib/format.ts';
import type { MatchStatus } from '../lib/types.ts';

const FILTERS: Array<{ key: MatchStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'EXACT_MATCH', label: 'Matched' },
  { key: 'MISMATCH', label: 'Mismatch' },
  { key: 'MISSING_IN_2B', label: 'At risk' },
  { key: 'MISSING_IN_BOOKS', label: 'Unrecorded' },
];

export default function InvoicesPage() {
  const { report } = useAppStore();
  const [filter, setFilter] = useState<MatchStatus | 'ALL'>('ALL');

  const lines = useMemo(() => {
    if (!report) return [];
    if (filter === 'ALL') return report.lines;
    return report.lines.filter((l) => l.status === filter);
  }, [report, filter]);

  if (!report) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">Run a reconciliation first.</p>
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
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3 text-right">ITC (books)</th>
              <th className="px-4 py-3 text-right">ITC (2B)</th>
              <th className="px-4 py-3 text-right">Diff</th>
              <th className="px-4 py-3">What to do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={`${l.supplierGstin}-${l.invoiceNo}-${i}`} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {l.supplierName ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400">{l.supplierGstin}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{l.invoiceNo}</div>
                  <div className="text-xs text-slate-400">{l.invoiceDate ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatInr(l.itcInBooks)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatInr(l.itcIn2B)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    l.itcDifference !== 0 ? 'text-red-600' : 'text-slate-400'
                  }`}
                >
                  {formatInr(l.itcDifference)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{l.note}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No invoices for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
