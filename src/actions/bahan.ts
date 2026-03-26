"use server";

import { db } from "@/db";
import { masterBahan, vendorBahan } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId, generateBahanId } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";

export async function getMasterBahan(outletId?: string) {
  const where = outletId ? eq(masterBahan.outletId, outletId) : undefined;
  return db.query.masterBahan.findMany({
    where,
    with: {
      vendorBahan: {
        with: { vendor: true },
        where: (vb, { eq }) => eq(vb.isPrimary, true),
        limit: 1,
      },
    },
    orderBy: (b, { asc }) => [asc(b.namaBahan)],
  });
}

export async function createBahan(data: {
  outletId: string;
  namaBahan: string;
  tipeBahan: "packaged" | "raw_bulk";
  kategoriBahan?: string;
  hargaBeli: number;
  satuanBeli: string;
  isiSatuan: number;
  satuanDapur: string;
  stokMinimum: number;
  leadTimeDays?: number;
  avgDailyConsumption?: number;
  vendorId?: string;
}) {
  const { vendorId, ...bahanData } = data;
  const id = await generateBahanId(bahanData.kategoriBahan);
  const hargaPerSatuanPorsi =
    bahanData.isiSatuan > 0 ? (bahanData.hargaBeli / bahanData.isiSatuan).toFixed(6) : "0";

  await db.insert(masterBahan).values({
    id,
    ...bahanData,
    hargaBeli: String(bahanData.hargaBeli),
    isiSatuan: String(bahanData.isiSatuan),
    hargaPerSatuanPorsi,
    leadTimeDays: bahanData.leadTimeDays ?? 1,
    avgDailyConsumption: bahanData.avgDailyConsumption ?? 0,
  });

  // Link to vendor if provided
  if (vendorId) {
    const vbId = await generateId("vendor_bahan");
    await db.insert(vendorBahan).values({
      id: vbId,
      vendorId,
      bahanId: id,
      hargaPerSatuan: String(bahanData.hargaBeli),
      isPrimary: true,
    });
    revalidatePath("/suppliers");
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { id };
}

export async function updateBahan(
  id: string,
  data: Partial<{
    namaBahan: string;
    tipeBahan: "packaged" | "raw_bulk";
    kategoriBahan: string;
    hargaBeli: number;
    satuanBeli: string;
    isiSatuan: number;
    satuanDapur: string;
    stokMinimum: number;
    leadTimeDays: number;
    avgDailyConsumption: number;
    outletId: string;
    vendorId: string;
  }>
) {
  const { vendorId, ...bahanData } = data;
  const updates: Record<string, unknown> = { ...bahanData, updatedAt: new Date() };
  if (bahanData.hargaBeli !== undefined) updates.hargaBeli = String(bahanData.hargaBeli);
  if (bahanData.isiSatuan !== undefined) updates.isiSatuan = String(bahanData.isiSatuan);
  if (bahanData.hargaBeli !== undefined && bahanData.isiSatuan !== undefined) {
    updates.hargaPerSatuanPorsi = (bahanData.hargaBeli / bahanData.isiSatuan).toFixed(6);
  }

  await db.update(masterBahan).set(updates).where(eq(masterBahan.id, id));

  // Upsert primary vendor link
  if (vendorId !== undefined) {
    // Remove existing primary link
    await db.delete(vendorBahan).where(eq(vendorBahan.bahanId, id));
    if (vendorId) {
      const vbId = await generateId("vendor_bahan");
      await db.insert(vendorBahan).values({
        id: vbId,
        vendorId,
        bahanId: id,
        hargaPerSatuan: bahanData.hargaBeli ? String(bahanData.hargaBeli) : "0",
        isPrimary: true,
      });
      revalidatePath("/suppliers");
    }
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function deleteBahan(id: string) {
  await db.delete(masterBahan).where(eq(masterBahan.id, id));
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

/**
 * Rename a bahan ID (admin only).
 * Strategy: insert a copy with new ID → update FK references → delete old row.
 * This avoids FK constraint issues without needing DDL or superuser privileges.
 */
export async function renameBahanId(oldId: string, newId: string) {
  const trimmedNew = newId.trim().toUpperCase();

  if (!trimmedNew) throw new Error("ID baru tidak boleh kosong");
  if (trimmedNew === oldId) throw new Error("ID baru sama dengan ID lama");
  if (!/^[A-Z0-9][A-Z0-9\-]+$/.test(trimmedNew)) throw new Error("Format ID tidak valid (gunakan huruf besar, angka, dan tanda -");

  // Check if new ID already exists
  const existing = await db.query.masterBahan.findFirst({ where: eq(masterBahan.id, trimmedNew) });
  if (existing) throw new Error(`ID ${trimmedNew} sudah digunakan`);

  // Get old bahan data
  const old = await db.query.masterBahan.findFirst({ where: eq(masterBahan.id, oldId) });
  if (!old) throw new Error("Bahan tidak ditemukan");

  await db.transaction(async (tx) => {
    // 1. Insert copy with new ID
    const { id: _drop, ...rest } = old;
    await tx.insert(masterBahan).values({ ...rest, id: trimmedNew });

    // 2. Update FK references (purchase_orders, vendor_bahan)
    await tx.execute(sql`UPDATE purchase_orders SET bahan_id = ${trimmedNew} WHERE bahan_id = ${oldId}`);
    await tx.execute(sql`UPDATE vendor_bahan SET bahan_id = ${trimmedNew} WHERE bahan_id = ${oldId}`);

    // 3. Delete old row (no more FK references pointing to it)
    await tx.delete(masterBahan).where(eq(masterBahan.id, oldId));
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { newId: trimmedNew };
}
