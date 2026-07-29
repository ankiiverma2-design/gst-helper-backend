import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Invoice,
  ReconciliationReport,
  Gstr3bSummary,
} from './lib/types.ts';
import * as api from './lib/api.ts';

interface AppState {
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
  report: ReconciliationReport | null;
  gstr3b: Gstr3bSummary | null;
  loading: boolean;
  error: string | null;

  setPurchaseRegister: (rows: Invoice[]) => void;
  setGstr2b: (rows: Invoice[]) => void;
  setSales: (rows: Invoice[]) => void;

  loadSample: () => Promise<void>;
  runReconcile: () => Promise<ReconciliationReport | null>;
  runGstr3b: () => Promise<Gstr3bSummary | null>;
  reset: () => void;
}

const AppStoreContext = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [purchaseRegister, setPurchaseRegister] = useState<Invoice[]>([]);
  const [gstr2b, setGstr2b] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Invoice[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3bSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSample = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchSample();
      setPurchaseRegister(data.purchaseRegister);
      setGstr2b(data.gstr2b);
      setSales(data.sales);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const runReconcile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.reconcile(purchaseRegister, gstr2b);
      setReport(r);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [purchaseRegister, gstr2b]);

  const runGstr3b = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Eligible purchases = everything not explicitly marked ineligible.
      const eligible = purchaseRegister.filter((p) => p.itcEligible !== false);
      const g = await api.computeGstr3b(sales, eligible);
      setGstr3b(g);
      return g;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [sales, purchaseRegister]);

  const reset = useCallback(() => {
    setPurchaseRegister([]);
    setGstr2b([]);
    setSales([]);
    setReport(null);
    setGstr3b(null);
    setError(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      purchaseRegister,
      gstr2b,
      sales,
      report,
      gstr3b,
      loading,
      error,
      setPurchaseRegister,
      setGstr2b,
      setSales,
      loadSample,
      runReconcile,
      runGstr3b,
      reset,
    }),
    [
      purchaseRegister,
      gstr2b,
      sales,
      report,
      gstr3b,
      loading,
      error,
      loadSample,
      runReconcile,
      runGstr3b,
      reset,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppState {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
