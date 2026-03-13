"use server";

import { db } from "@/db";
import { systemConfigs, outlets, masterBahan, masterMenu } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

export async function runMigration(): Promise<{ success: boolean; message: string }> {
  // Check if already migrated
  const existing = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "is_initial_migration_done"),
  });
  if (existing?.value === "true") {
    return { success: false, message: "Migrasi sudah pernah dilakukan. Tombol dikunci." };
  }

  try {
    const spreadsheetId = process.env.GSHEET_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("GSHEET_SPREADSHEET_ID belum diisi di .env.local");
    }

    // Load service account credentials: env var first, then JSON file
    let credentials: Record<string, string>;
    const envKey = process.env.GSHEET_SERVICE_ACCOUNT_KEY;
    if (envKey && envKey.trim().length > 0) {
      credentials = JSON.parse(envKey);
    } else {
      const keyFilePath = path.join(process.cwd(), "media-project-backend-c2f5832fb342.json");
      if (!fs.existsSync(keyFilePath)) {
        throw new Error(
          "Service account key tidak ditemukan. Set GSHEET_SERVICE_ACCOUNT_KEY atau letakkan file JSON di root project."
        );
      }
      credentials = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
    }

    const authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map((s) => s.properties?.title ?? "") ?? [];

    let outletCount = 0;
    let menuCount = 0;
    let bahanCount = 0;

    // ── 1. sys_outlets → outlets ─────────────────────────────
    // Expected columns: A=ID Outlet, B=Nama Cabang
    const outletSheet = sheetNames.find((s) => s.toLowerCase() === "sys_outlets");
    if (outletSheet) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${outletSheet}!A:B` });
      const rows = res.data.values ?? [];
      for (let i = 1; i < rows.length; i++) {
        const [id, namaOutlet] = rows[i];
        if (!namaOutlet?.trim()) continue;
        const outletId = id?.trim() || await generateId("outlets");
        await db.insert(outlets).values({ id: outletId, namaOutlet: namaOutlet.trim() }).onConflictDoNothing();
        outletCount++;
      }
    }

    // ── 2. pawoon_products → master_menu ─────────────────────
    // Expected columns: A=id_menu (may be empty), B=nama_product
    const menuSheet = sheetNames.find((s) => s.toLowerCase() === "pawoon_products");
    if (menuSheet) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${menuSheet}!A:B` });
      const rows = res.data.values ?? [];
      for (let i = 1; i < rows.length; i++) {
        const [, namaProduct] = rows[i];
        if (!namaProduct?.trim()) continue;
        const id = await generateId("master_menu");
        // Derive kategori: "beverage" if name contains known drink keywords, else "food"
        const lower = namaProduct.toLowerCase();
        const kategori = lower.includes("minuman") || lower.includes("drink") || lower.includes("juice")
          || lower.includes("ice cream") || lower.includes("es ")
          ? "beverage" : "food";
        await db.insert(masterMenu).values({
          id,
          namaMenu: namaProduct.trim(),
          kategori,
        }).onConflictDoNothing();
        menuCount++;
      }
    }

    // ── 3. mapping_pawoon → master_bahan ─────────────────────
    // Expected columns: A=id_bahan (may be empty), B=nama_pawoon (bahan name)
    const bahanSheet = sheetNames.find((s) => s.toLowerCase() === "mapping_pawoon");
    if (bahanSheet) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${bahanSheet}!A:B` });
      const rows = res.data.values ?? [];
      for (let i = 1; i < rows.length; i++) {
        const [, namaPawoon] = rows[i];
        if (!namaPawoon?.trim()) continue;
        const id = await generateId("master_bahan");
        await db.insert(masterBahan).values({
          id,
          namaBahan: namaPawoon.trim(),
          tipeBahan: "packaged",
          hargaBeli: "0",
          satuanBeli: "1_pcs",
          isiSatuan: "1",
          satuanDapur: "pcs",
          stokMinimum: 0,
          leadTimeDays: 1,
          avgDailyConsumption: 0,
        }).onConflictDoNothing();
        bahanCount++;
      }
    }

    // Lock migration permanently
    await db.insert(systemConfigs)
      .values({ key: "is_initial_migration_done", value: "true" })
      .onConflictDoUpdate({ target: systemConfigs.key, set: { value: "true" } });

    const parts = [];
    if (outletCount) parts.push(`${outletCount} outlet`);
    if (menuCount) parts.push(`${menuCount} menu`);
    if (bahanCount) parts.push(`${bahanCount} bahan`);

    return {
      success: true,
      message: `✅ Migrasi berhasil: ${parts.join(", ")} diimport. Tombol dikunci permanen.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      message: `❌ Migrasi gagal: ${message}`,
    };
  }
}
