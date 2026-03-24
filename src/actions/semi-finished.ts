"use server";

import { db } from "@/db";
import { semiFinished, masterBahan, mappingResep } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";

export async function getSemiFinished(outletId?: string) {
  const where = outletId ? eq(semiFinished.outletId, outletId) : undefined;
  return db.query.semiFinished.findMany({
    where,
    with: {
      mappingResep: {
        with: { bahan: true },
      },
    },
    orderBy: (s, { asc }) => [asc(s.namaSemiFinished)],
  });
}

export async function createSemiFinished(data: {
  outletId: string;
  namaSemiFinished: string;
  satuanHasil: string;
  jumlahHasil: number;
}) {
  const id = await generateId("semi_finished");
  await db.insert(semiFinished).values({
    id,
    outletId: data.outletId,
    namaSemiFinished: data.namaSemiFinished,
    satuan: data.satuanHasil,
    satuanHasil: data.satuanHasil,
    jumlahHasil: String(data.jumlahHasil),
    stokMinimum: "0",
    totalCogs: "0",
    cogsPerUnit: "0",
  });
  revalidatePath("/products");
  return { id };
}

export async function updateSemiFinished(
  id: string,
  data: {
    namaSemiFinished?: string;
    satuanHasil?: string;
    jumlahHasil?: number;
  }
) {
  const current = await db.query.semiFinished.findFirst({
    where: eq(semiFinished.id, id),
  });
  if (!current) return;

  const jumlahHasil = data.jumlahHasil ?? parseFloat(current.jumlahHasil);
  const totalCogs = parseFloat(current.totalCogs);
  const newCogsPerUnit = jumlahHasil > 0 ? totalCogs / jumlahHasil : 0;

  await db.update(semiFinished).set({
    ...(data.namaSemiFinished !== undefined && { namaSemiFinished: data.namaSemiFinished }),
    ...(data.satuanHasil !== undefined && { satuanHasil: data.satuanHasil, satuan: data.satuanHasil }),
    ...(data.jumlahHasil !== undefined && {
      jumlahHasil: String(data.jumlahHasil),
      cogsPerUnit: newCogsPerUnit.toFixed(6),
    }),
  }).where(eq(semiFinished.id, id));

  revalidatePath("/products");
}

export async function deleteSemiFinished(id: string) {
  // Remove recipe lines first (no FK cascade on mapping_resep.parent_id)
  await db.delete(mappingResep).where(eq(mappingResep.parentId, id));
  await db.delete(semiFinished).where(eq(semiFinished.id, id));
  revalidatePath("/products");
}

export interface SFGBOMLine {
  itemType: "bahan_dasar" | "semi_finished";
  itemId: string;
  qty: number;
}

export async function saveSFGBOM(sfgId: string, lines: SFGBOMLine[]) {
  // Fetch current SFG for jumlahHasil
  const sfg = await db.query.semiFinished.findFirst({
    where: eq(semiFinished.id, sfgId),
  });
  if (!sfg) return;

  // Delete existing BOM lines for this SFG
  await db.delete(mappingResep).where(eq(mappingResep.parentId, sfgId));

  // Insert new lines and compute totalCogs
  let totalCogs = 0;
  for (const line of lines) {
    if (!line.itemId) continue;
    const id = await generateId("mapping_resep");
    await db.insert(mappingResep).values({
      id,
      parentId: sfgId,
      parentType: "semi_finished",
      itemId: line.itemId,
      itemType: line.itemType,
      qty: String(line.qty),
    });

    if (line.itemType === "bahan_dasar") {
      const bahan = await db.query.masterBahan.findFirst({
        where: eq(masterBahan.id, line.itemId),
      });
      if (bahan?.hargaPerSatuanPorsi) {
        totalCogs += line.qty * parseFloat(bahan.hargaPerSatuanPorsi);
      }
    } else if (line.itemType === "semi_finished") {
      // Guard against self-reference
      if (line.itemId === sfgId) continue;
      const nestedSfg = await db.query.semiFinished.findFirst({
        where: eq(semiFinished.id, line.itemId),
      });
      if (nestedSfg?.cogsPerUnit) {
        totalCogs += line.qty * parseFloat(nestedSfg.cogsPerUnit);
      }
    }
  }

  const jumlahHasil = parseFloat(sfg.jumlahHasil);
  const cogsPerUnit = jumlahHasil > 0 ? totalCogs / jumlahHasil : 0;

  await db.update(semiFinished).set({
    totalCogs: totalCogs.toFixed(2),
    cogsPerUnit: cogsPerUnit.toFixed(6),
  }).where(eq(semiFinished.id, sfgId));

  revalidatePath("/products");
}
