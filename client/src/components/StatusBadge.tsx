import type { MatchStatus } from '../lib/types.ts';

const CONFIG: Record<MatchStatus, { label: string; className: string }> = {
  EXACT_MATCH: { label: 'Matched', className: 'bg-green-100 text-green-800' },
  MISMATCH: { label: 'Mismatch', className: 'bg-amber-100 text-amber-800' },
  MISSING_IN_2B: { label: 'At risk', className: 'bg-red-100 text-red-800' },
  MISSING_IN_BOOKS: { label: 'Unrecorded', className: 'bg-blue-100 text-blue-800' },
};

export default function StatusBadge({ status }: { status: MatchStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
