"use server";

import { db } from "@/db";
import { systemConfigs, outlets, masterBahan, masterMenu, masterVendor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { google } from "googleapis";

export async function runMigration(): Promise<{ success: boolean; message: string }> {
  // Check if already migrated
  const existing = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "is_initial_migration_done"),
  });
  if (existing?.value === "true") {
    return { success: false, message: "Migrasi sudah pernah dilakukan. Tombol dikunci." };
  }

  try {
    const serviceAccountKey = process.env.GSHEET_SERVICE_ACCOUNT_KEY;
    const spreadsheetId = process.env.GSHEET_SPREADSHEET_ID;

    if (!serviceAccountKey || !spreadsheetId) {
      throw new Error("GSHEET_SERVICE_ACCOUNT_KEY atau GSHEET_SPREADSHEET_ID belum diisi di .env.local");
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Get list of sheets in the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map((s) => s.properties?.title ?? "") ?? [];

    let importedCount = 0;

    // Try to import outlets
    if (sheetNames.includes("Outlets") || sheetNames.includes("outlets")) {
      const sheetName = sheetNames.find((s) => s.toLowerCase() === "outlets") ?? "Outlets";
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:B`,
      });
      const rows = response.data.values ?? [];
      for (let i = 1; i < rows.length; i++) {
        const [id, namaOutlet] = rows[i];
        if (!namaOutlet) continue;
        const outletId = id || await generateId("outlets");
        await db.insert(outlets).values({ id: outletId, namaOutlet }).onConflictDoNothing();
        importedCount++;
      }
    }

    // Try to import master_bahan
    if (sheetNames.includes("Bahan") || sheetNames.includes("master_bahan")) {
      const sheetName = sheetNames.find((s) => s.toLowerCase().includes("bahan")) ?? "Bahan";
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:L`,
      });
      const rows = response.data.values ?? [];
      const header = rows[0]?.map((h: string) => h.toLowerCase().trim()) ?? [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowObj: Record<string, string> = {};
        header.forEach((h, idx) => { rowObj[h] = row[idx] ?? ""; });

        const namaBahan = rowObj.nama_bahan || rowObj.nama || rowObj.name;
        if (!namaBahan) continue;

        const id = rowObj.id || await generateId("master_bahan");
        await db.insert(masterBahan).values({
          id,
          outletId: rowObj.outlet_id || null,
          namaBahan,
          tipeBahan: (rowObj.tipe_bahan as any) ?? "packaged",
          kategoriBahan: rowObj.kategori || null,
          hargaBeli: rowObj.harga_beli || "0",
          satuanBeli: rowObj.satuan_beli || "1_pcs",
          isiSatuan: rowObj.isi_satuan || "1",
          satuanDapur: rowObj.satuan_dapur || "pcs",
          stokMinimum: parseInt(rowObj.stok_minimum ?? "0") || 0,
          leadTimeDays: parseInt(rowObj.lead_time_days ?? "1") || 1,
          avgDailyConsumption: parseFloat(rowObj.avg_daily_consumption ?? "0") || 0,
        }).onConflictDoNothing();
        importedCount++;
      }
    }

    // Lock migration — cannot be done again
    await db.insert(systemConfigs)
      .values({ key: "is_initial_migration_done", value: "true" })
      .onConflictDoUpdate({ target: systemConfigs.key, set: { value: "true" } });

    return {
      success: true,
      message: `✅ Migrasi berhasil. ${importedCount} record diimport. Tombol dikunci permanen.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `❌ Migrasi gagal: ${err.message}`,
    };
  }
}
