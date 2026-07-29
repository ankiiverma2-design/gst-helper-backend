import { Link } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import StatCard from '../components/StatCard.tsx';
import { formatInr } from '../lib/format.ts';

export default function DashboardPage() {
  const { report } = useAppStore();

  if (!report) {
    return <EmptyState />;
  }

  const s = report.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Claimable now"
          value={formatInr(s.itcClaimableNow)}
          hint="Matched & eligible. Safe to claim."
          tone="green"
        />
        <StatCard
          label="At risk"
          value={formatInr(s.itcAtRisk)}
          hint="In your books, not in GSTR-2B. Supplier hasn't filed."
          tone="red"
        />
        <StatCard
          label="Unclaimed"
          value={formatInr(s.itcUnclaimed)}
          hint="In GSTR-2B, not in your books. You may be missing ITC."
          tone="amber"
        />
        <StatCard
          label="Total ITC in books"
          value={formatInr(s.itcAsPerBooks)}
          hint="All eligible ITC you recorded."
          tone="neutral"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Match breakdown</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Matched" value={s.exactMatches} className="text-green-700" />
          <MiniStat label="Mismatches" value={s.mismatches} className="text-amber-700" />
          <MiniStat label="At risk" value={s.missingIn2B} className="text-red-700" />
          <MiniStat
            label="Unrecorded"
            value={s.missingInBooks}
            className="text-blue-700"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            to="/invoices"
            className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600"
          >
            View invoice details
          </Link>
          <Link
            to="/returns"
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go to returns
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">ITC comparison</h3>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Row label="ITC as per your books" value={formatInr(s.itcAsPerBooks)} />
          <Row label="ITC as per GSTR-2B" value={formatInr(s.itcAsPer2B)} />
          <Row label="Invoices in books" value={String(s.totalInvoicesInBooks)} />
          <Row label="Invoices in GSTR-2B" value={String(s.totalInvoicesIn2B)} />
        </dl>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No reconciliation yet</h2>
      <p className="mt-1 text-sm text-slate-500">
        Load data and run a reconciliation to see your ITC summary.
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
