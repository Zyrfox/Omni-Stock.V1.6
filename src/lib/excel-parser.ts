/**
 * OMNI-STOCK — Excel Parser (Pawoon POS format)
 * Uses SheetJS / xlsx library
 */

import * as XLSX from "xlsx";

export interface ParsedStockRow {
  namaMenu: string;
  qtyTerjual: number;
  tanggalTransaksi: string; // YYYY-MM-DD
}

export interface ParsedStockResult {
  rows: ParsedStockRow[];
  errors: string[];
  totalRows: number;
  successRows: number;
}

/**
 * Parse Pawoon POS Excel file (.xls or .xlsx)
 * Expected columns (flexible matching):
 *   - Menu name: "nama_menu", "menu", "item", "produk"
 *   - Qty sold: "qty", "jumlah", "terjual", "sold"
 *   - Date: "tanggal", "date", "tgl"
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): ParsedStockResult {
  const errors: string[] = [];
  const rows: ParsedStockRow[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { rows: [], errors: ["File tidak dapat dibaca. Pastikan format .xls atau .xlsx."], totalRows: 0, successRows: 0 };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawData.length === 0) {
    return { rows: [], errors: ["Sheet kosong atau tidak ada data."], totalRows: 0, successRows: 0 };
  }

  // Detect column names from first row
  const firstRow = rawData[0];
  const allKeys = Object.keys(firstRow).map((k) => k.toLowerCase().trim());

  const menuCol = allKeys.find((k) => ["nama_menu", "menu", "item", "produk", "nama produk", "name"].includes(k));
  const qtyCol = allKeys.find((k) => ["qty", "jumlah", "terjual", "sold", "qty_terjual", "quantity"].includes(k));
  const dateCol = allKeys.find((k) => ["tanggal", "date", "tgl", "tanggal_transaksi"].includes(k));

  if (!menuCol) errors.push("Kolom nama menu tidak ditemukan. Harap gunakan header: nama_menu / menu / item");
  if (!qtyCol) errors.push("Kolom qty tidak ditemukan. Harap gunakan header: qty / jumlah / terjual");
  if (!dateCol) errors.push("Kolom tanggal tidak ditemukan. Harap gunakan header: tanggal / date / tgl");

  if (!menuCol || !qtyCol || !dateCol) {
    return { rows: [], errors, totalRows: rawData.length, successRows: 0 };
  }

  // Find the original key names (case-sensitive)
  const originalKeys = Object.keys(firstRow);
  const origMenuCol = originalKeys.find((k) => k.toLowerCase().trim() === menuCol)!;
  const origQtyCol = originalKeys.find((k) => k.toLowerCase().trim() === qtyCol)!;
  const origDateCol = originalKeys.find((k) => k.toLowerCase().trim() === dateCol)!;

  rawData.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 because row 1 is header
    const namaMenu = String(row[origMenuCol] ?? "").trim();
    const qtyRaw = row[origQtyCol];
    const dateRaw = row[origDateCol];

    if (!namaMenu) {
      errors.push(`Baris ${rowNum}: Nama menu kosong, dilewati.`);
      return;
    }

    const qtyTerjual = parseFloat(String(qtyRaw));
    if (isNaN(qtyTerjual) || qtyTerjual < 0) {
      errors.push(`Baris ${rowNum}: Qty tidak valid (${qtyRaw}), dilewati.`);
      return;
    }

    let tanggal = String(dateRaw ?? "").trim();
    // Try parsing date
    if (!tanggal) {
      tanggal = new Date().toISOString().slice(0, 10);
    } else {
      const parsed = new Date(tanggal);
      if (!isNaN(parsed.getTime())) {
        tanggal = parsed.toISOString().slice(0, 10);
      } else {
        errors.push(`Baris ${rowNum}: Format tanggal tidak valid (${dateRaw}), menggunakan hari ini.`);
        tanggal = new Date().toISOString().slice(0, 10);
      }
    }

    rows.push({ namaMenu, qtyTerjual, tanggalTransaksi: tanggal });
  });

  return {
    rows,
    errors,
    totalRows: rawData.length,
    successRows: rows.length,
  };
}
