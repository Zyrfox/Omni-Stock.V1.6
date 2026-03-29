"use server";

import { db } from "@/db";
import { masterMenu, mappingResep, masterBahan, semiFinished } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";

export async function getMasterMenu(outletId?: string) {
  return db.query.masterMenu.findMany({
    where: outletId ? eq(masterMenu.outletId, outletId) : undefined,
    with: {
      mappingResep: {
        with: { bahan: true },
      },
      outlet: true,
    },
    orderBy: (m, { asc }) => [asc(m.namaMenu)],
  });
}

export async function createMenu(data: {
  namaMenu: string;
  outletId: string;
  kategori: "food" | "beverage";
  hargaJual?: number;
  channelType?: string;
  platformFeePercent?: number;
}) {
  const id = await generateId("master_menu");
  await db.insert(masterMenu).values({
    id,
    namaMenu: data.namaMenu,
    outletId: data.outletId,
    kategori: data.kategori,
    hargaJual: data.hargaJual ? String(data.hargaJual) : null,
    channelType: data.channelType ?? "dine_in",
    platformFeePercent: data.platformFeePercent ? String(data.platformFeePercent) : "0",
    totalCogs: "0",
  });
  revalidatePath("/products");
  return { id };
}

export interface BOMLine {
  itemType: "bahan_dasar" | "semi_finished";
  itemId: string;
  qty: number;
}

export async function saveBOM(
  parentId: string,
  parentType: "menu" | "semi_finished",
  lines: BOMLine[]
) {
  const validLines = lines.filter((l) => l.itemId);

  // Delete existing BOM for this parent
  await db.delete(mappingResep).where(eq(mappingResep.parentId, parentId));

  if (validLines.length === 0) {
    if (parentType === "menu") {
      await db
        .update(masterMenu)
        .set({ totalCogs: "0", updatedAt: new Date() })
        .where(eq(masterMenu.id, parentId));
    }
    revalidatePath("/products");
    return;
  }

  // Fetch last RSP ID to generate sequential IDs locally (1 query instead of N)
  const lastIdResult = await db.execute(
    sql`SELECT id FROM mapping_resep ORDER BY id DESC LIMIT 1`
  );
  const lastIdRows = lastIdResult as unknown as Array<{ id: string }>;
  let rspCounter = 1;
  if (lastIdRows && lastIdRows.length > 0) {
    const lastPart = lastIdRows[0].id.split("-").pop() ?? "0";
    rspCounter = (parseInt(lastPart, 10) || 0) + 1;
  }

  // Bulk fetch bahan prices
  const bahanIds = validLines.filter((l) => l.itemType === "bahan_dasar").map((l) => l.itemId);
  const sfgIds = validLines.filter((l) => l.itemType === "semi_finished").map((l) => l.itemId);

  const [bahanRows, sfgRows] = await Promise.all([
    bahanIds.length > 0
      ? db.query.masterBahan.findMany({ where: inArray(masterBahan.id, bahanIds) })
      : Promise.resolve([]),
    sfgIds.length > 0
      ? db.query.semiFinished.findMany({ where: inArray(semiFinished.id, sfgIds) })
      : Promise.resolve([]),
  ]);

  const bahanMap = new Map(bahanRows.map((b) => [b.id, b]));
  const sfgMap = new Map(sfgRows.map((s) => [s.id, s]));

  // Build insert rows with locally generated IDs
  let totalCogs = 0;
  const insertRows = validLines.map((line) => {
    const id = `RSP-${String(rspCounter++).padStart(3, "0")}`;

    if (line.itemType === "bahan_dasar") {
      const bahan = bahanMap.get(line.itemId);
      if (bahan?.hargaPerSatuanPorsi) {
        totalCogs += line.qty * parseFloat(bahan.hargaPerSatuanPorsi);
      }
    } else if (line.itemType === "semi_finished") {
      const sfg = sfgMap.get(line.itemId);
      if (sfg?.cogsPerUnit) {
        totalCogs += line.qty * parseFloat(sfg.cogsPerUnit);
      }
    }

    return {
      id,
      parentId,
      parentType,
      itemId: line.itemId,
      itemType: line.itemType,
      qty: String(line.qty),
    };
  });

  // Batch insert all lines in one query
  await db.insert(mappingResep).values(insertRows);

  // Update total_cogs on master_menu if parent is menu
  if (parentType === "menu") {
    await db
      .update(masterMenu)
      .set({ totalCogs: String(totalCogs.toFixed(2)), updatedAt: new Date() })
      .where(eq(masterMenu.id, parentId));
  }

  revalidatePath("/products");
}

export async function updateMenu(
  id: string,
  data: {
    namaMenu?: string;
    kategori?: "food" | "beverage";
    outletId?: string;
    hargaJual?: number | null;
    channelType?: string;
    platformFeePercent?: number;
  }
) {
  await db.update(masterMenu).set({
    ...(data.namaMenu !== undefined && { namaMenu: data.namaMenu }),
    ...(data.kategori !== undefined && { kategori: data.kategori }),
    ...(data.outletId !== undefined && { outletId: data.outletId }),
    ...(data.hargaJual !== undefined && { hargaJual: data.hargaJual !== null ? String(data.hargaJual) : null }),
    ...(data.channelType !== undefined && { channelType: data.channelType }),
    ...(data.platformFeePercent !== undefined && { platformFeePercent: String(data.platformFeePercent) }),
    updatedAt: new Date(),
  }).where(eq(masterMenu.id, id));
  revalidatePath("/products");
}

export async function getMappingResep(parentId: string) {
  return db.query.mappingResep.findMany({
    where: eq(mappingResep.parentId, parentId),
    with: { bahan: true },
  });
}

/**
 * Get the next available menu ID for a given outlet abbreviation.
 * Format: MNU-{OUTLET_ABBR}-NNN
 */
export async function getNextMenuId(outletAbbr: string): Promise<string> {
  const prefix = `MNU-${outletAbbr}`;
  const result = await db.execute(
    sql`SELECT id FROM master_menu WHERE id LIKE ${prefix + "-%"} ORDER BY id DESC LIMIT 1`
  );
  const rows = result as unknown as Array<{ id: string }>;
  if (!rows || rows.length === 0) return `${prefix}-001`;
  const lastPart = rows[0].id.split("-").pop() ?? "0";
  const nextNum = (parseInt(lastPart, 10) || 0) + 1;
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Rename a menu ID (when outlet/kategori changes).
 * Strategy: insert copy with new ID → update FK references → delete old row.
 */
export async function renameMenuId(oldId: string, newId: string) {
  const trimmedNew = newId.trim().toUpperCase();

  if (!trimmedNew) throw new Error("ID baru tidak boleh kosong");
  if (trimmedNew === oldId) return { newId: oldId };
  if (!/^[A-Z0-9][A-Z0-9\-]+$/.test(trimmedNew)) throw new Error("Format ID tidak valid");

  const existing = await db.query.masterMenu.findFirst({ where: eq(masterMenu.id, trimmedNew) });
  if (existing) throw new Error(`ID ${trimmedNew} sudah digunakan`);

  const old = await db.query.masterMenu.findFirst({
    where: eq(masterMenu.id, oldId),
    with: { mappingResep: true },
  });
  if (!old) throw new Error("Menu tidak ditemukan");

  await db.transaction(async (tx) => {
    // 1. Insert copy with new ID
    const { id: _drop, mappingResep: _mr, outlet: _o, ...rest } = old as any;
    await tx.insert(masterMenu).values({ ...rest, id: trimmedNew });

    // 2. Update FK references in mapping_resep (parentId)
    await tx.execute(sql`UPDATE mapping_resep SET parent_id = ${trimmedNew} WHERE parent_id = ${oldId}`);

    // 3. Delete old row
    await tx.delete(masterMenu).where(eq(masterMenu.id, oldId));
  });

  revalidatePath("/products");
  return { newId: trimmedNew };
}
