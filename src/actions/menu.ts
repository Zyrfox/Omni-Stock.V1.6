"use server";

import { db } from "@/db";
import { masterMenu, mappingResep, masterBahan } from "@/db/schema";
import { eq } from "drizzle-orm";
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
}) {
  const id = await generateId("master_menu");
  await db.insert(masterMenu).values({
    id,
    namaMenu: data.namaMenu,
    outletId: data.outletId,
    kategori: data.kategori,
    hargaJual: data.hargaJual ? String(data.hargaJual) : null,
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
  // Delete existing BOM for this parent
  await db.delete(mappingResep).where(eq(mappingResep.parentId, parentId));

  // Insert new lines
  let totalCogs = 0;
  for (const line of lines) {
    if (!line.itemId) continue;
    const id = await generateId("mapping_resep");
    await db.insert(mappingResep).values({
      id,
      parentId,
      parentType,
      itemId: line.itemId,
      itemType: line.itemType,
      qty: String(line.qty),
    });

    // Calculate COGS contribution
    if (line.itemType === "bahan_dasar") {
      const bahan = await db.query.masterBahan.findFirst({
        where: eq(masterBahan.id, line.itemId),
      });
      if (bahan?.hargaPerSatuanPorsi) {
        totalCogs += line.qty * parseFloat(bahan.hargaPerSatuanPorsi);
      }
    }
  }

  // Update total_cogs on master_menu if parent is menu
  if (parentType === "menu") {
    await db
      .update(masterMenu)
      .set({ totalCogs: String(totalCogs.toFixed(2)), updatedAt: new Date() })
      .where(eq(masterMenu.id, parentId));
  }

  revalidatePath("/products");
}

export async function getMappingResep(parentId: string) {
  return db.query.mappingResep.findMany({
    where: eq(mappingResep.parentId, parentId),
    with: { bahan: true },
  });
}
