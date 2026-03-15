"use server";

import { db } from "@/db";
import { masterBahan, uploadBatches } from "@/db/schema";
import { eq, sql, or, isNull } from "drizzle-orm";
import { parseKartuStok } from "@/lib/excel-parser";
import { calculateStockStatus } from "@/lib/stock-status";
import { generateId } from "@/lib/id-generator";

export interface UploadedStockItem {
  bahanId: string | null;
  namaBahan: string;
  kategori: string;
  tipeBahan: "packaged" | "raw_bulk" | null;
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
  outletName: string;
  tanggalKartuStok: string;
  itemsParsed: number;
  matchedBahan: number;
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
    return {
      success: false, batchId: "", outletName: "", tanggalKartuStok: "",
      itemsParsed: 0, matchedBahan: 0,
      errors: ["File tidak ditemukan."], stockItems: [], message: "Gagal: file tidak ada.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = parseKartuStok(buffer);

  if (parsed.rows.length === 0) {
    return {
      success: false, batchId: "", outletName: parsed.outletName,
      tanggalKartuStok: parsed.tanggal,
      itemsParsed: 0, matchedBahan: 0,
      errors: parsed.errors,
      stockItems: [],
      message: "Tidak ada data yang berhasil diparsing. " + parsed.errors.join("; "),
    };
  }

  // Fetch all bahan — include outlet-specific AND null-outlet items
  const allBahan = await db.query.masterBahan.findMany({
    where: or(eq(masterBahan.outletId, outletId), isNull(masterBahan.outletId)),
    with: {
      vendorBahan: {
        with: { vendor: true },
        where: (vb, { eq: eqF }) => eqF(vb.isPrimary, true),
        limit: 1,
      },
    },
  });

  function normalizeName(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[-–—]/g, "-");
  }

  // Build lookup maps: exact + normalized
  const bahanExact = new Map<string, typeof allBahan[0]>();
  const bahanNorm = new Map<string, typeof allBahan[0]>();
  for (const b of allBahan) {
    bahanExact.set(b.namaBahan.toLowerCase().trim(), b);
    bahanNorm.set(normalizeName(b.namaBahan), b);
  }

  function findBahan(produkName: string): typeof allBahan[0] | undefined {
    const exact = bahanExact.get(produkName.toLowerCase().trim());
    if (exact) return exact;
    const norm = bahanNorm.get(normalizeName(produkName));
    if (norm) return norm;
    // Partial match: bahan name contains produk name or vice versa (min 5 chars)
    const np = normalizeName(produkName);
    if (np.length >= 5) {
      for (const [key, bahan] of bahanNorm) {
        if (key.length >= 5 && (key.includes(np) || np.includes(key))) return bahan;
      }
    }
    return undefined;
  }

  // Match each parsed row to master_bahan
  const stockItems: UploadedStockItem[] = [];
  let matchedCount = 0;

  // Calculate elapsed days since tanggalKartuStok for avgDailyConsumption
  const kartuDate = new Date(parsed.tanggal);
  const now = new Date();
  const elapsedDays = Math.max(1, Math.round((now.getTime() - kartuDate.getTime()) / 86400000) + 1);

  for (const row of parsed.rows) {
    const matchedBahanRecord = findBahan(row.produkName);

    if (matchedBahanRecord) {
      matchedCount++;

      // Update avgDailyConsumption based on penjualan from this Kartu Stok
      if (row.penjualan > 0) {
        const avgPerDay = row.penjualan / elapsedDays;
        await db
          .update(masterBahan)
          .set({
            avgDailyConsumption: avgPerDay,
            avgConsumptionSource: "auto",
            updatedAt: new Date(),
          })
          .where(eq(masterBahan.id, matchedBahanRecord.id));
        matchedBahanRecord.avgDailyConsumption = avgPerDay;
      }

      const status = calculateStockStatus({
        stokAkhir: row.stokAkhir,
        stokMinimum: matchedBahanRecord.stokMinimum,
        leadTimeDays: matchedBahanRecord.leadTimeDays,
        avgDailyConsumption: matchedBahanRecord.avgDailyConsumption,
      });

      const primaryVendor = (matchedBahanRecord as any).vendorBahan?.[0]?.vendor;

      stockItems.push({
        bahanId: matchedBahanRecord.id,
        namaBahan: matchedBahanRecord.namaBahan,
        kategori: row.kategori,
        tipeBahan: matchedBahanRecord.tipeBahan,
        stokAkhir: row.stokAkhir,
        satuanDapur: row.satuan || matchedBahanRecord.satuanDapur,
        stokMinimum: matchedBahanRecord.stokMinimum,
        leadTimeDays: matchedBahanRecord.leadTimeDays,
        avgDailyConsumption: matchedBahanRecord.avgDailyConsumption,
        hargaBeli: matchedBahanRecord.hargaBeli,
        hargaPerSatuanPorsi: matchedBahanRecord.hargaPerSatuanPorsi,
        status,
        vendorNama: primaryVendor?.namaVendor,
        vendorId: primaryVendor?.id,
      });
    } else {
      // Unmatched — still show in table but without bahan data
      parsed.errors.push(`Produk "${row.produkName}" tidak cocok dengan master_bahan, dilewati dari stok tracking.`);
      stockItems.push({
        bahanId: null,
        namaBahan: row.produkName,
        kategori: row.kategori,
        tipeBahan: null,
        stokAkhir: row.stokAkhir,
        satuanDapur: row.satuan,
        stokMinimum: 0,
        leadTimeDays: 0,
        avgDailyConsumption: 0,
        hargaBeli: "0",
        hargaPerSatuanPorsi: null,
        status: "CRITICAL",
      });
    }
  }

  // Save upload_batches record
  const batchId = await generateId("upload_batches");
  await db.insert(uploadBatches).values({
    id: batchId,
    outletId,
    tanggalKartuStok: parsed.tanggal,
    outletNameRaw: parsed.outletName || null,
    totalProduk: parsed.totalRows,
    matchedBahan: matchedCount,
    uploadedBy: uploadedBy || null,
  });

  return {
    success: true,
    batchId,
    outletName: parsed.outletName,
    tanggalKartuStok: parsed.tanggal,
    itemsParsed: parsed.totalRows,
    matchedBahan: matchedCount,
    errors: parsed.errors,
    stockItems,
    message: `${matchedCount} dari ${parsed.totalRows} produk berhasil di-match ke master bahan.`,
  };
}
