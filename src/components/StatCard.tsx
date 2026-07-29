import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'green' | 'red' | 'amber' | 'neutral';
}

const TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  green: 'border-green-200 bg-green-50',
  red: 'border-red-200 bg-red-50',
  amber: 'border-amber-200 bg-amber-50',
  neutral: 'border-slate-200 bg-white',
};

const VALUE_TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  green: 'text-green-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
  neutral: 'text-slate-900',
};

export default function StatCard({ label, value, hint, tone = 'neutral' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${TONE[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${VALUE_TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
