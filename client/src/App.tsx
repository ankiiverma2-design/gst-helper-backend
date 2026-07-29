import { NavLink, Route, Routes } from 'react-router-dom';
import UploadPage from './pages/UploadPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import InvoicesPage from './pages/InvoicesPage.tsx';
import ReturnsPage from './pages/ReturnsPage.tsx';
import { useAppStore } from './store.tsx';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-500 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  const { error, loading } = useAppStore();

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pb-16">
      <header className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            GST Helper
            <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              ITC Reconciliation
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            Know exactly what Input Tax Credit is safe to claim.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1">
          <NavItem to="/" label="Upload" />
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/invoices" label="Invoices" />
          <NavItem to="/returns" label="Returns" />
        </nav>
      </header>

      {loading && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2 text-sm text-brand-700">
          Working…
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Something went wrong.</strong> {error}
          <div className="mt-1 text-xs text-red-500">
            Tip: check the API URL on the Upload page and that the backend is running.
          </div>
        </div>
      )}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
        </Routes>
      </main>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Prepares and reconciles GST returns. Does not file directly with the
        government — upload generated files to the official GST portal.
      </footer>
    </div>
  );
}
