// Typed API client for the GST Helper backend.
//
// The base URL is read from VITE_API_BASE at build time and can be overridden
// at runtime via localStorage key "apiBase" (handy while testing against a
// deployed backend without rebuilding).

import type {
  Gstr3bSummary,
  Invoice,
  ReconciliationReport,
  SampleData,
  HsnSummaryRow,
  VendorFollowUp,
  ParseResult,
  FilingPeriodSummary,
  FilingPeriodRecord,
} from './types.ts';

const DEFAULT_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

export function getApiBase(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem('apiBase');
    if (override) return override;
  }
  return DEFAULT_BASE;
}

export function setApiBase(url: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url) localStorage.setItem('apiBase', url);
    else localStorage.removeItem('apiBase');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = res.statusText;
    }
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export function health(): Promise<{ status: string }> {
  return request('/health');
}

export function fetchSample(): Promise<SampleData> {
  return request('/api/sample');
}

export function reconcile(
  purchaseRegister: Invoice[],
  gstr2b: Invoice[],
  amountTolerance = 2,
): Promise<ReconciliationReport> {
  return request('/api/reconcile', {
    method: 'POST',
    body: JSON.stringify({ purchaseRegister, gstr2b, options: { amountTolerance } }),
  });
}

export function computeGstr3b(
  sales: Invoice[],
  eligiblePurchases: Invoice[],
): Promise<Gstr3bSummary> {
  return request('/api/gstr3b', {
    method: 'POST',
    body: JSON.stringify({ sales, eligiblePurchases }),
  });
}

export function buildGstr1(
  supplierGstin: string,
  filingPeriod: string,
  b2bSales: Array<Invoice & { buyerGstin: string; placeOfSupply: string }>,
): Promise<Record<string, unknown>> {
  return request('/api/gstr1', {
    method: 'POST',
    body: JSON.stringify({ supplierGstin, filingPeriod, b2bSales }),
  });
}

export function hsnSummary(sales: Invoice[]): Promise<{ rows: HsnSummaryRow[] }> {
  return request('/api/hsn-summary', {
    method: 'POST',
    body: JSON.stringify({ sales }),
  });
}

export function vendorFollowUp(
  purchaseRegister: Invoice[],
  gstr2b: Invoice[],
): Promise<{ vendors: VendorFollowUp[] }> {
  return request('/api/vendor-followup', {
    method: 'POST',
    body: JSON.stringify({ purchaseRegister, gstr2b }),
  });
}

export function parsePurchaseCsv(csv: string): Promise<ParseResult> {
  return request('/api/parse/purchase-register-csv', {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export function parseGstr2b(json: unknown): Promise<ParseResult> {
  return request('/api/parse/gstr2b', {
    method: 'POST',
    body: JSON.stringify({ json }),
  });
}

// ---- Persistence: filing periods ----

export function listPeriods(gstin?: string): Promise<{ periods: FilingPeriodSummary[] }> {
  const q = gstin ? `?gstin=${encodeURIComponent(gstin)}` : '';
  return request(`/api/periods${q}`);
}

export function savePeriod(input: {
  gstin: string;
  period: string;
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
}): Promise<{ id: number }> {
  return request('/api/periods', { method: 'POST', body: JSON.stringify(input) });
}

export function getPeriod(id: number): Promise<FilingPeriodRecord> {
  return request(`/api/periods/${id}`);
}

export function deletePeriod(id: number): Promise<{ deleted: boolean }> {
  return request(`/api/periods/${id}`, { method: 'DELETE' });
}
