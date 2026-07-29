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
  HsnSummaryRow,
  VendorFollowUp,
  FilingPeriodSummary,
} from './lib/types.ts';
import * as api from './lib/api.ts';

interface AppState {
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
  report: ReconciliationReport | null;
  gstr3b: Gstr3bSummary | null;
  hsn: HsnSummaryRow[] | null;
  vendors: VendorFollowUp[] | null;
  periods: FilingPeriodSummary[];
  loading: boolean;
  error: string | null;
  notice: string | null;

  setPurchaseRegister: (rows: Invoice[]) => void;
  setGstr2b: (rows: Invoice[]) => void;
  setSales: (rows: Invoice[]) => void;

  loadSample: () => Promise<void>;
  importPurchaseCsv: (csv: string) => Promise<void>;
  importGstr2bJson: (json: unknown) => Promise<void>;
  runReconcile: () => Promise<ReconciliationReport | null>;
  runGstr3b: () => Promise<Gstr3bSummary | null>;
  runHsn: () => Promise<void>;
  runVendorFollowUp: () => Promise<void>;

  refreshPeriods: (gstin?: string) => Promise<void>;
  savePeriod: (gstin: string, period: string) => Promise<void>;
  loadPeriod: (id: number) => Promise<void>;
  removePeriod: (id: number) => Promise<void>;

  reset: () => void;
}

const AppStoreContext = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [purchaseRegister, setPurchaseRegister] = useState<Invoice[]>([]);
  const [gstr2b, setGstr2b] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Invoice[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3bSummary | null>(null);
  const [hsn, setHsn] = useState<HsnSummaryRow[] | null>(null);
  const [vendors, setVendors] = useState<VendorFollowUp[] | null>(null);
  const [periods, setPeriods] = useState<FilingPeriodSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSample = useCallback(async () => {
    await run(async () => {
      const data = await api.fetchSample();
      setPurchaseRegister(data.purchaseRegister);
      setGstr2b(data.gstr2b);
      setSales(data.sales);
      setNotice('Loaded sample data.');
    });
  }, [run]);

  const importPurchaseCsv = useCallback(
    async (csv: string) => {
      await run(async () => {
        const res = await api.parsePurchaseCsv(csv);
        setPurchaseRegister(res.invoices);
        setNotice(
          `Imported ${res.invoices.length} purchase invoices` +
            (res.errors.length ? ` (${res.errors.length} rows skipped).` : '.'),
        );
        if (res.errors.length) setError(res.errors.slice(0, 5).join(' '));
      });
    },
    [run],
  );

  const importGstr2bJson = useCallback(
    async (json: unknown) => {
      await run(async () => {
        const res = await api.parseGstr2b(json);
        setGstr2b(res.invoices);
        setNotice(`Imported ${res.invoices.length} invoices from GSTR-2B.`);
        if (res.errors.length) setError(res.errors.slice(0, 5).join(' '));
      });
    },
    [run],
  );

  const runReconcile = useCallback(async () => {
    return run(async () => {
      const r = await api.reconcile(purchaseRegister, gstr2b);
      setReport(r);
      return r;
    });
  }, [run, purchaseRegister, gstr2b]);

  const runGstr3b = useCallback(async () => {
    return run(async () => {
      const eligible = purchaseRegister.filter((p) => p.itcEligible !== false);
      const g = await api.computeGstr3b(sales, eligible);
      setGstr3b(g);
      return g;
    });
  }, [run, sales, purchaseRegister]);

  const runHsn = useCallback(async () => {
    await run(async () => {
      const { rows } = await api.hsnSummary(sales);
      setHsn(rows);
    });
  }, [run, sales]);

  const runVendorFollowUp = useCallback(async () => {
    await run(async () => {
      const { vendors: v } = await api.vendorFollowUp(purchaseRegister, gstr2b);
      setVendors(v);
    });
  }, [run, purchaseRegister, gstr2b]);

  const refreshPeriods = useCallback(
    async (gstin?: string) => {
      await run(async () => {
        const { periods: p } = await api.listPeriods(gstin);
        setPeriods(p);
      });
    },
    [run],
  );

  const savePeriod = useCallback(
    async (gstin: string, period: string) => {
      await run(async () => {
        await api.savePeriod({ gstin, period, purchaseRegister, gstr2b, sales });
        setNotice(`Saved filing period ${period} for ${gstin}.`);
        const { periods: p } = await api.listPeriods();
        setPeriods(p);
      });
    },
    [run, purchaseRegister, gstr2b, sales],
  );

  const loadPeriod = useCallback(
    async (id: number) => {
      await run(async () => {
        const rec = await api.getPeriod(id);
        setPurchaseRegister(rec.purchaseRegister);
        setGstr2b(rec.gstr2b);
        setSales(rec.sales);
        setReport(null);
        setNotice(`Loaded filing period ${rec.period}.`);
      });
    },
    [run],
  );

  const removePeriod = useCallback(
    async (id: number) => {
      await run(async () => {
        await api.deletePeriod(id);
        const { periods: p } = await api.listPeriods();
        setPeriods(p);
      });
    },
    [run],
  );

  const reset = useCallback(() => {
    setPurchaseRegister([]);
    setGstr2b([]);
    setSales([]);
    setReport(null);
    setGstr3b(null);
    setHsn(null);
    setVendors(null);
    setError(null);
    setNotice(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      purchaseRegister,
      gstr2b,
      sales,
      report,
      gstr3b,
      hsn,
      vendors,
      periods,
      loading,
      error,
      notice,
      setPurchaseRegister,
      setGstr2b,
      setSales,
      loadSample,
      importPurchaseCsv,
      importGstr2bJson,
      runReconcile,
      runGstr3b,
      runHsn,
      runVendorFollowUp,
      refreshPeriods,
      savePeriod,
      loadPeriod,
      removePeriod,
      reset,
    }),
    [
      purchaseRegister,
      gstr2b,
      sales,
      report,
      gstr3b,
      hsn,
      vendors,
      periods,
      loading,
      error,
      notice,
      loadSample,
      importPurchaseCsv,
      importGstr2bJson,
      runReconcile,
      runGstr3b,
      runHsn,
      runVendorFollowUp,
      refreshPeriods,
      savePeriod,
      loadPeriod,
      removePeriod,
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
