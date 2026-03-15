"use server";

import { db } from "@/db";
import { masterVendor, vendorBahan, purchaseOrders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";

export async function getMasterVendor() {
  return db.query.masterVendor.findMany({
    orderBy: (v, { asc }) => [asc(v.namaVendor)],
  });
}

export async function getMasterVendorWithStats() {
  const [vendors, spentRows] = await Promise.all([
    db.query.masterVendor.findMany({
      with: { vendorBahan: { with: { bahan: true } } },
      orderBy: (v, { asc }) => [asc(v.namaVendor)],
    }),
    db.execute(
      sql`SELECT vendor_id, COALESCE(SUM(total_harga), 0) as total FROM purchase_orders WHERE status = 'received' GROUP BY vendor_id`
    ),
  ]);

  const spentMap = new Map<string, number>();
  for (const row of spentRows as unknown as Array<{ vendor_id: string; total: string }>) {
    spentMap.set(row.vendor_id, parseFloat(row.total ?? "0"));
  }

  return vendors.map((v) => ({
    ...v,
    totalPengeluaran: spentMap.get(v.id) ?? 0,
    totalBahan: v.vendorBahan.length,
  }));
}

export async function createVendor(data: {
  namaVendor: string;
  kontakWa?: string;
  noRekening?: string;
  estimasiPengiriman: number;
  outletId?: string;
  vendorPlatform?: string;
  linkToko?: string;
}) {
  const id = await generateId("master_vendor");
  await db.insert(masterVendor).values({ id, ...data });
  revalidatePath("/suppliers");
  return { id };
}

export async function updateVendor(
  id: string,
  data: Partial<{
    namaVendor: string;
    kontakWa: string;
    noRekening: string;
    estimasiPengiriman: number;
  }>
) {
  await db.update(masterVendor).set({ ...data, updatedAt: new Date() }).where(eq(masterVendor.id, id));
  revalidatePath("/suppliers");
}

export async function deleteVendor(id: string) {
  await db.delete(masterVendor).where(eq(masterVendor.id, id));
  revalidatePath("/suppliers");
}

export async function linkVendorBahan(data: {
  vendorId: string;
  bahanId: string;
  hargaPerSatuan: number;
  isPrimary?: boolean;
}) {
  const id = await generateId("vendor_bahan");
  await db.insert(vendorBahan).values({
    id,
    vendorId: data.vendorId,
    bahanId: data.bahanId,
    hargaPerSatuan: String(data.hargaPerSatuan),
    isPrimary: data.isPrimary ?? false,
  });
  revalidatePath("/suppliers");
}

export async function setVendorBahan(
  vendorId: string,
  items: Array<{ bahanId: string }>
) {
  await db.delete(vendorBahan).where(eq(vendorBahan.vendorId, vendorId));
  if (items.length > 0) {
    for (const item of items) {
      const id = await generateId("vendor_bahan");
      await db.insert(vendorBahan).values({ id, vendorId, bahanId: item.bahanId, hargaPerSatuan: "0", isPrimary: false });
    }
  }
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}
