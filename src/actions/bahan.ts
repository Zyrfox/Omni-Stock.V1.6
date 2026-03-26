"use server";

import { db } from "@/db";
import { masterBahan, vendorBahan } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId, generateBahanId } from "@/lib/id-generator";
import { getOutletAbbr } from "@/lib/product-id-config";
import { outlets } from "@/db/schema";
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
  // Resolve outlet abbreviation for ID generation
  let outletAbbr: string | undefined;
  if (bahanData.outletId) {
    const outlet = await db.query.outlets.findFirst({ where: eq(outlets.id, bahanData.outletId) });
    if (outlet) outletAbbr = getOutletAbbr(outlet.namaOutlet);
  }
  const id = await generateBahanId(bahanData.kategoriBahan, outletAbbr);
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

/**
 * Get the next available bahan ID for a given kategori+outlet combination.
 * Format: KATEGORI_ABBR-OUTLET_ABBR-NNN
 * Used to preview the next ID in the add/edit form.
 */
export async function getNextBahanId(kategoriAbbr: string, outletAbbr: string): Promise<string> {
  const prefix = `${kategoriAbbr}-${outletAbbr}`;
  const result = await db.execute(
    sql`SELECT id FROM master_bahan WHERE id LIKE ${prefix + "-%"} ORDER BY id DESC LIMIT 1`
  );
  const rows = result as unknown as Array<{ id: string }>;
  if (!rows || rows.length === 0) return `${prefix}-001`;
  const lastPart = rows[0].id.split("-").pop() ?? "0";
  const lastNum = parseInt(lastPart, 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}
