"use server";

import { db } from "@/db";
import { semiFinished, masterBahan, mappingResep } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
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
  const validLines = lines.filter(l => l.itemId && l.itemId !== sfgId);

  const bahanIds = [...new Set(validLines.filter(l => l.itemType === "bahan_dasar").map(l => l.itemId))];
  const sfgItemIds = [...new Set(validLines.filter(l => l.itemType === "semi_finished").map(l => l.itemId))];

  // Fetch everything needed in parallel
  const [sfg, bahanRows, nestedSfgRows, maxIdResult] = await Promise.all([
    db.query.semiFinished.findFirst({ where: eq(semiFinished.id, sfgId) }),
    bahanIds.length > 0
      ? db.select({ id: masterBahan.id, hargaPerSatuanPorsi: masterBahan.hargaPerSatuanPorsi }).from(masterBahan).where(inArray(masterBahan.id, bahanIds))
      : Promise.resolve([] as { id: string; hargaPerSatuanPorsi: string | null }[]),
    sfgItemIds.length > 0
      ? db.select({ id: semiFinished.id, cogsPerUnit: semiFinished.cogsPerUnit }).from(semiFinished).where(inArray(semiFinished.id, sfgItemIds))
      : Promise.resolve([] as { id: string; cogsPerUnit: string }[]),
    db.execute(sql`SELECT id FROM mapping_resep ORDER BY id DESC LIMIT 1`),
  ]);

  if (!sfg) return;

  // Build lookup maps and compute COGS in-memory
  const bahanMap = new Map(bahanRows.map(b => [b.id, b.hargaPerSatuanPorsi]));
  const sfgMap = new Map(nestedSfgRows.map(s => [s.id, s.cogsPerUnit]));

  let totalCogs = 0;
  for (const line of validLines) {
    if (line.itemType === "bahan_dasar") {
      const price = bahanMap.get(line.itemId);
      if (price) totalCogs += line.qty * parseFloat(price);
    } else {
      const cogs = sfgMap.get(line.itemId);
      if (cogs) totalCogs += line.qty * parseFloat(cogs);
    }
  }

  // Generate sequential IDs locally from max existing
  const maxIdRows = maxIdResult as unknown as Array<{ id: string }>;
  let lastNum = 0;
  if (maxIdRows.length > 0) {
    const parts = maxIdRows[0].id.split("-");
    lastNum = parseInt(parts[parts.length - 1], 10) || 0;
  }

  // Delete old lines, batch-insert new ones, update COGS — sequentially but minimal round-trips
  await db.delete(mappingResep).where(eq(mappingResep.parentId, sfgId));

  if (validLines.length > 0) {
    await db.insert(mappingResep).values(
      validLines.map((line, i) => ({
        id: `RSP-${String(lastNum + i + 1).padStart(3, "0")}`,
        parentId: sfgId,
        parentType: "semi_finished" as const,
        itemId: line.itemId,
        itemType: line.itemType,
        qty: String(line.qty),
      }))
    );
  }

  const jumlahHasil = parseFloat(sfg.jumlahHasil);
  const cogsPerUnit = jumlahHasil > 0 ? totalCogs / jumlahHasil : 0;

  await db.update(semiFinished).set({
    totalCogs: totalCogs.toFixed(2),
    cogsPerUnit: cogsPerUnit.toFixed(6),
  }).where(eq(semiFinished.id, sfgId));

  revalidatePath("/products");
}
