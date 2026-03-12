"use server";

import { db } from "@/db";
import { purchaseOrders, masterBahan } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { generateAIPrediction } from "@/lib/gemini";
import { revalidatePath } from "next/cache";

export async function getPurchaseOrders(outletId?: string) {
  return db.query.purchaseOrders.findMany({
    where: outletId ? eq(purchaseOrders.outletId, outletId) : undefined,
    with: {
      vendor: true,
      bahan: true,
      createdByUser: true,
      outlet: true,
    },
    orderBy: (po, { desc }) => [desc(po.createdAt)],
  });
}

export async function createDraftPO(data: {
  outletId: string;
  vendorId: string;
  bahanId: string;
  qtyOrder: number;
  hargaSatuan: number;
  createdBy: string;
  stokAkhir?: number;
}) {
  const bahan = await db.query.masterBahan.findFirst({
    where: eq(masterBahan.id, data.bahanId),
  });

  if (!bahan) throw new Error("Bahan tidak ditemukan");

  const id = await generateId("purchase_orders");
  const totalHarga = data.qtyOrder * data.hargaSatuan;

  // Generate AI notes
  let aiNotes = "";
  try {
    const prediction = await generateAIPrediction({
      namaBahan: bahan.namaBahan,
      stokAkhir: data.stokAkhir ?? 0,
      satuanDapur: bahan.satuanDapur,
      stokMinimum: bahan.stokMinimum,
      leadTimeDays: bahan.leadTimeDays,
      avgDailyConsumption: bahan.avgDailyConsumption,
      tipeBahan: bahan.tipeBahan,
    });
    aiNotes = prediction.aiNotes;
  } catch {
    aiNotes = "";
  }

  await db.insert(purchaseOrders).values({
    id,
    outletId: data.outletId,
    vendorId: data.vendorId,
    bahanId: data.bahanId,
    status: "draft",
    qtyOrder: String(data.qtyOrder),
    hargaSatuan: String(data.hargaSatuan),
    totalHarga: String(totalHarga),
    aiNotes,
    createdBy: data.createdBy,
  });

  revalidatePath("/po-logs");
  revalidatePath("/dashboard");
  return { id };
}

export async function sendPO(id: string) {
  await db
    .update(purchaseOrders)
    .set({ status: "sent", tanggalKirim: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id));
  revalidatePath("/po-logs");
  revalidatePath("/delivery");
}

export async function receivePO(id: string) {
  await db
    .update(purchaseOrders)
    .set({ status: "received", tanggalTerima: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id));
  revalidatePath("/po-logs");
  revalidatePath("/delivery");
  revalidatePath("/billing");
}

export async function getPOStats() {
  const result = await db.execute(
    sql`SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'received') as received
    FROM purchase_orders`
  );
  const rows = result as unknown as Array<{
    total: string; draft: string; sent: string; received: string;
  }>;
  return {
    total: parseInt(rows[0]?.total ?? "0"),
    draft: parseInt(rows[0]?.draft ?? "0"),
    sent: parseInt(rows[0]?.sent ?? "0"),
    received: parseInt(rows[0]?.received ?? "0"),
  };
}
