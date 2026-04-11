/**
 * Generate custom text IDs with prefix: PREFIX-001, PREFIX-002, etc.
 * Used for all tables in OMNI-STOCK — no UUID.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { KATEGORI_ABBR } from "./product-id-config";

type TableName =
  | "outlets"
  | "users"
  | "master_bahan"
  | "semi_finished"
  | "master_menu"
  | "mapping_resep"
  | "master_vendor"
  | "vendor_bahan"
  | "sales_transactions"
  | "upload_batches"
  | "purchase_orders"
  | "menu_cost_components";

const PREFIX_MAP: Record<TableName, string> = {
  outlets: "OUT",
  users: "USR",
  master_bahan: "BHN",
  semi_finished: "SFG",
  master_menu: "MNU",
  mapping_resep: "RSP",
  master_vendor: "VND",
  vendor_bahan: "VBH",
  sales_transactions: "TRX",
  upload_batches: "UPL",
  purchase_orders: "PO",
  menu_cost_components: "MCC",
};

/**
 * Generate a sequential ID for a given table.
 * Query the max existing ID number, increment by 1.
 */
export async function generateId(tableName: TableName): Promise<string> {
  const prefix = PREFIX_MAP[tableName];

  const result = await db.execute(
    sql`SELECT id FROM ${sql.identifier(tableName)} ORDER BY id DESC LIMIT 1`
  );

  const rows = result as unknown as Array<{ id: string }>;

  if (!rows || rows.length === 0) {
    return formatId(prefix, 1);
  }

  const lastId = rows[0].id;
  // Extract number part: "BHN-042" → 42
  const parts = lastId.split("-");
  const lastNum = parseInt(parts[parts.length - 1], 10);
  return formatId(prefix, lastNum + 1);
}

function formatId(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(3, "0")}`;
}

/** Re-export for backwards compat */
export const KATEGORI_PREFIX = KATEGORI_ABBR;
export const PRODUCT_CATEGORIES = Object.keys(KATEGORI_ABBR);

/**
 * Generate bahan ID: KATEGORI-OUTLET-NNN format.
 * Falls back to BHN if no category, GEN if no outletAbbr.
 */
export async function generateBahanId(kategori?: string, outletAbbr?: string): Promise<string> {
  const katAbbr = (kategori && KATEGORI_ABBR[kategori]) ? KATEGORI_ABBR[kategori] : "BHN";
  const prefix = outletAbbr ? `${katAbbr}-${outletAbbr}` : katAbbr;
  const result = await db.execute(
    sql`SELECT id FROM master_bahan WHERE id LIKE ${prefix + "-%"} ORDER BY id DESC LIMIT 1`
  );
  const rows = result as unknown as Array<{ id: string }>;
  if (!rows || rows.length === 0) return `${prefix}-001`;
  const lastNum = parseInt(rows[0].id.split("-").pop() ?? "0", 10);
  return formatId(prefix, isNaN(lastNum) ? 1 : lastNum + 1);
}

/** Generate a batch upload ID */
export function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `BATCH-${ts}`;
}

// Re-export from client-safe module so server-side imports still work
export { generatePassword } from "./password-utils";
