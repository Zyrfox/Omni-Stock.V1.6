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
  const vendors = await db.query.masterVendor.findMany({
    with: {
      vendorBahan: { with: { bahan: true } },
    },
    orderBy: (v, { asc }) => [asc(v.namaVendor)],
  });

  const result = [];
  for (const v of vendors) {
    const spent = await db.execute(
      sql`SELECT COALESCE(SUM(total_harga), 0) as total FROM purchase_orders WHERE vendor_id = ${v.id} AND status = 'received'`
    );
    const rows = spent as unknown as Array<{ total: string }>;
    result.push({
      ...v,
      totalPengeluaran: parseFloat(rows[0]?.total ?? "0"),
      totalBahan: v.vendorBahan.length,
    });
  }
  return result;
}

export async function createVendor(data: {
  namaVendor: string;
  kontakWa?: string;
  noRekening?: string;
  estimasiPengiriman: number;
  outletId?: string;
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
