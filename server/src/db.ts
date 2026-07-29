/**
 * Persistence using Node's built-in SQLite (node:sqlite) — zero external deps.
 *
 * Stores a seller's filing periods and the invoice sets that belong to each,
 * so data survives across sessions. A "filing period" is one GSTIN + one month
 * (MMYYYY); its purchase register, GSTR-2B and sales are kept as JSON.
 *
 * Requires Node >= 22.5 run with the `--experimental-sqlite` flag (already set
 * in the npm scripts).
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Invoice } from './types.ts';

export interface FilingPeriodInput {
  gstin: string;
  period: string; // MMYYYY
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
}

export interface FilingPeriodSummary {
  id: number;
  gstin: string;
  period: string;
  updatedAt: string;
  counts: { purchaseRegister: number; gstr2b: number; sales: number };
}

export interface FilingPeriodRecord extends FilingPeriodSummary {
  purchaseRegister: Invoice[];
  gstr2b: Invoice[];
  sales: Invoice[];
}

interface Row {
  id: number;
  gstin: string;
  period: string;
  purchase_register: string;
  gstr2b: string;
  sales: string;
  updated_at: string;
}

export class Store {
  private db: DatabaseSync;

  constructor(path = ':memory:') {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS filing_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gstin TEXT NOT NULL,
        period TEXT NOT NULL,
        purchase_register TEXT NOT NULL DEFAULT '[]',
        gstr2b TEXT NOT NULL DEFAULT '[]',
        sales TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        UNIQUE (gstin, period)
      );
    `);
  }

  /** Create or update a filing period (keyed by gstin + period). Returns its id. */
  savePeriod(input: FilingPeriodInput): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO filing_periods (gstin, period, purchase_register, gstr2b, sales, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (gstin, period) DO UPDATE SET
        purchase_register = excluded.purchase_register,
        gstr2b = excluded.gstr2b,
        sales = excluded.sales,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      input.gstin.toUpperCase(),
      input.period,
      JSON.stringify(input.purchaseRegister ?? []),
      JSON.stringify(input.gstr2b ?? []),
      JSON.stringify(input.sales ?? []),
      now,
    );
    const row = this.db
      .prepare('SELECT id FROM filing_periods WHERE gstin = ? AND period = ?')
      .get(input.gstin.toUpperCase(), input.period) as { id: number };
    return row.id;
  }

  /** List saved periods (optionally filtered by GSTIN), newest first. */
  listPeriods(gstin?: string): FilingPeriodSummary[] {
    const rows = (
      gstin
        ? this.db
            .prepare('SELECT * FROM filing_periods WHERE gstin = ? ORDER BY updated_at DESC')
            .all(gstin.toUpperCase())
        : this.db.prepare('SELECT * FROM filing_periods ORDER BY updated_at DESC').all()
    ) as Row[];
    return rows.map(toSummary);
  }

  /** Load a full filing period by id, or null if not found. */
  getPeriod(id: number): FilingPeriodRecord | null {
    const row = this.db.prepare('SELECT * FROM filing_periods WHERE id = ?').get(id) as
      | Row
      | undefined;
    if (!row) return null;
    return {
      ...toSummary(row),
      purchaseRegister: JSON.parse(row.purchase_register) as Invoice[],
      gstr2b: JSON.parse(row.gstr2b) as Invoice[],
      sales: JSON.parse(row.sales) as Invoice[],
    };
  }

  /** Delete a filing period. Returns true if a row was removed. */
  deletePeriod(id: number): boolean {
    const res = this.db.prepare('DELETE FROM filing_periods WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  close(): void {
    this.db.close();
  }
}

function toSummary(row: Row): FilingPeriodSummary {
  const count = (json: string): number => {
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  };
  return {
    id: row.id,
    gstin: row.gstin,
    period: row.period,
    updatedAt: row.updated_at,
    counts: {
      purchaseRegister: count(row.purchase_register),
      gstr2b: count(row.gstr2b),
      sales: count(row.sales),
    },
  };
}
