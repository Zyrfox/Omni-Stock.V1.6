"use server";

import { db } from "@/db";
import { masterBahan, vendorBahan } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
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
}) {
  const id = await generateId("master_bahan");
  const hargaPerSatuanPorsi =
    data.isiSatuan > 0 ? (data.hargaBeli / data.isiSatuan).toFixed(6) : "0";

  await db.insert(masterBahan).values({
    id,
    ...data,
    hargaBeli: String(data.hargaBeli),
    isiSatuan: String(data.isiSatuan),
    hargaPerSatuanPorsi,
    leadTimeDays: data.leadTimeDays ?? 1,
    avgDailyConsumption: data.avgDailyConsumption ?? 0,
  });

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
  }>
) {
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.hargaBeli !== undefined) updates.hargaBeli = String(data.hargaBeli);
  if (data.isiSatuan !== undefined) updates.isiSatuan = String(data.isiSatuan);
  if (data.hargaBeli !== undefined && data.isiSatuan !== undefined) {
    updates.hargaPerSatuanPorsi = (data.hargaBeli / data.isiSatuan).toFixed(6);
  }

  await db.update(masterBahan).set(updates).where(eq(masterBahan.id, id));
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function deleteBahan(id: string) {
  await db.delete(masterBahan).where(eq(masterBahan.id, id));
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
