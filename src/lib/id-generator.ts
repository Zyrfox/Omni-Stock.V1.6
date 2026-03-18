/**
 * Generate custom text IDs with prefix: PREFIX-001, PREFIX-002, etc.
 * Used for all tables in OMNI-STOCK — no UUID.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

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
  | "purchase_orders";

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

/** Category → ID prefix mapping for master_bahan */
export const KATEGORI_PREFIX: Record<string, string> = {
  "Main Course": "MCR",
  "Snack": "SNK",
  "Dessert": "DST",
  "Ice Cream": "ICE",
  "Noodles": "NDL",
  "Beverage": "BEV",
};

export const PRODUCT_CATEGORIES = Object.keys(KATEGORI_PREFIX);

/**
 * Generate bahan ID using category-based prefix (ICE-001, BEV-002, etc.)
 * Falls back to BHN prefix if category is not mapped.
 */
export async function generateBahanId(kategori?: string): Promise<string> {
  const prefix = (kategori && KATEGORI_PREFIX[kategori]) ? KATEGORI_PREFIX[kategori] : "BHN";
  const result = await db.execute(
    sql`SELECT id FROM master_bahan WHERE id LIKE ${prefix + "-%"} ORDER BY id DESC LIMIT 1`
  );
  const rows = result as unknown as Array<{ id: string }>;
  if (!rows || rows.length === 0) return formatId(prefix, 1);
  const lastNum = parseInt(rows[0].id.split("-").pop() ?? "0", 10);
  return formatId(prefix, lastNum + 1);
}

/** Generate a batch upload ID */
export function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `BATCH-${ts}`;
}

// Re-export from client-safe module so server-side imports still work
export { generatePassword } from "./password-utils";
