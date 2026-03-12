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

/** Generate a batch upload ID */
export function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `BATCH-${ts}`;
}

/** Generate a random 12-char password */
export function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  let pwd = "";
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
