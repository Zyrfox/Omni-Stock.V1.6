"use server";

import { db } from "@/db";
import { masterBahan, masterMenu, salesTransactions, mappingResep } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { parseExcelBuffer } from "@/lib/excel-parser";
import { calculateStockStatus } from "@/lib/stock-status";
import { generateId, generateBatchId } from "@/lib/id-generator";

export interface UploadedStockItem {
  bahanId: string;
  namaBahan: string;
  tipeBahan: "packaged" | "raw_bulk";
  stokAkhir: number;
  satuanDapur: string;
  stokMinimum: number;
  leadTimeDays: number;
  avgDailyConsumption: number;
  hargaBeli: string;
  hargaPerSatuanPorsi: string | null;
  status: "SAFE" | "WARNING" | "CRITICAL";
  vendorNama?: string;
  vendorId?: string;
}

export interface UploadResult {
  success: boolean;
  batchId: string;
  itemsParsed: number;
  errors: string[];
  stockItems: UploadedStockItem[];
  message: string;
}

export async function processUpload(
  formData: FormData,
  outletId: string,
  uploadedBy: string
): Promise<UploadResult> {
  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, batchId: "", itemsParsed: 0, errors: ["File tidak ditemukan."], stockItems: [], message: "Gagal" };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = parseExcelBuffer(buffer);

  if (parsed.rows.length === 0) {
    return {
      success: false,
      batchId: "",
      itemsParsed: 0,
      errors: parsed.errors,
      stockItems: [],
      message: "Tidak ada data yang berhasil diparsing.",
    };
  }

  const batchId = generateBatchId();
  const savedTrx: string[] = [];

  // Map menu name → menu record
  for (const row of parsed.rows) {
    const menuRecord = await db.query.masterMenu.findFirst({
      where: sql`LOWER(${masterMenu.namaMenu}) = LOWER(${row.namaMenu})`,
    });

    if (!menuRecord) {
      parsed.errors.push(`Menu "${row.namaMenu}" tidak ditemukan di master_menu, dilewati.`);
      continue;
    }

    const trxId = await generateId("sales_transactions");
    await db.insert(salesTransactions).values({
      id: trxId,
      outletId,
      uploadBatchId: batchId,
      tanggalTransaksi: row.tanggalTransaksi,
      menuId: menuRecord.id,
      qtyTerjual: row.qtyTerjual,
    });
    savedTrx.push(trxId);
  }

  // Update avg_daily_consumption for affected bahan based on last 30 days
  await updateAvgDailyConsumption(outletId);

  // Build transient stock items from master_bahan
  // stok_akhir is derived from the upload (sum of stok_akhir from the uploaded data, simplified here)
  const stockItems = await buildStockSnapshot(outletId, parsed.rows);

  return {
    success: true,
    batchId,
    itemsParsed: savedTrx.length,
    errors: parsed.errors,
    stockItems,
    message: `${savedTrx.length} item berhasil diproses.`,
  };
}

async function updateAvgDailyConsumption(outletId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all bahan for outlet
  const bahanList = await db.query.masterBahan.findMany({
    where: eq(masterBahan.outletId, outletId),
  });

  for (const bahan of bahanList) {
    // Calculate total qty consumed via BOM in last 30 days
    const result = await db.execute(
      sql`
        SELECT SUM(st.qty_terjual * mr.qty) as total_consumed
        FROM sales_transactions st
        JOIN mapping_resep mr ON mr.parent_id = st.menu_id AND mr.parent_type = 'menu' AND mr.item_type = 'bahan_dasar' AND mr.item_id = ${bahan.id}
        WHERE st.outlet_id = ${outletId}
          AND st.tanggal_transaksi >= ${thirtyDaysAgo.toISOString().slice(0, 10)}
      `
    );

    const rows = result as unknown as Array<{ total_consumed: string | null }>;
    const totalConsumed = parseFloat(rows[0]?.total_consumed ?? "0") || 0;
    const avgPerDay = totalConsumed / 30;

    if (avgPerDay > 0) {
      await db
        .update(masterBahan)
        .set({
          avgDailyConsumption: avgPerDay,
          avgConsumptionSource: "auto",
          updatedAt: new Date(),
        })
        .where(eq(masterBahan.id, bahan.id));
    }
  }
}

async function buildStockSnapshot(
  outletId: string,
  parsedRows: Array<{ namaMenu: string; qtyTerjual: number; tanggalTransaksi: string }>
): Promise<UploadedStockItem[]> {
  const bahanList = await db.query.masterBahan.findMany({
    where: eq(masterBahan.outletId, outletId),
    with: {
      vendorBahan: {
        with: { vendor: true },
        where: (vb, { eq }) => eq(vb.isPrimary, true),
        limit: 1,
      },
    },
  });

  // For now, stok_akhir is a placeholder (0) unless actual stock card data is in the upload
  // In production, the Excel from Pawoon has current stock values per item
  return bahanList.map((b) => {
    const stokAkhir = 0; // transient — from actual upload stok_akhir column
    const status = calculateStockStatus({
      stokAkhir,
      stokMinimum: b.stokMinimum,
      leadTimeDays: b.leadTimeDays,
      avgDailyConsumption: b.avgDailyConsumption,
    });

    const primaryVendor = (b as any).vendorBahan?.[0]?.vendor;

    return {
      bahanId: b.id,
      namaBahan: b.namaBahan,
      tipeBahan: b.tipeBahan,
      stokAkhir,
      satuanDapur: b.satuanDapur,
      stokMinimum: b.stokMinimum,
      leadTimeDays: b.leadTimeDays,
      avgDailyConsumption: b.avgDailyConsumption,
      hargaBeli: b.hargaBeli,
      hargaPerSatuanPorsi: b.hargaPerSatuanPorsi,
      status,
      vendorNama: primaryVendor?.namaVendor,
      vendorId: primaryVendor?.id,
    };
  });
}
