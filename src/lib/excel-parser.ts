/**
 * OMNI-STOCK — Excel Parser (Kartu Stok format)
 * Uses SheetJS / xlsx library
 *
 * Kartu Stok file structure:
 *   Row 1:   "Kartu Stok"
 *   Row 3:   "Outlet" = "Back To Mie Kitchen"   (or same cell: "Outlet : Back To Mie Kitchen")
 *   Row 4:   "Tanggal" = "07-03-2026"
 *   Row 8:   Headers: Produk | Kategori | Stok Awal | Stok Masuk | Stok Keluar | Penjualan | Transfer | Penyesuaian | Stok Akhir | Satuan
 *   Row 9+:  Data rows (one product per row)
 */

import * as XLSX from "xlsx";

export interface ParsedKartuStokRow {
  produkName: string;
  kategori: string;
  stokAwal: number;
  stokMasuk: number;
  stokKeluar: number;
  penjualan: number;
  transfer: number;
  penyesuaian: number;
  stokAkhir: number;
  satuan: string;
}

export interface ParsedKartuStok {
  outletName: string;    // extracted from header rows
  tanggal: string;       // YYYY-MM-DD extracted from header rows
  rows: ParsedKartuStokRow[];
  errors: string[];
  totalRows: number;
}

/**
 * Parse Kartu Stok Excel file (.xls or .xlsx)
 */
export function parseKartuStok(buffer: Buffer | ArrayBuffer): ParsedKartuStok {
  const errors: string[] = [];
  let outletName = "";
  let tanggal = new Date().toISOString().slice(0, 10);
  const rows: ParsedKartuStokRow[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  } catch {
    return {
      outletName, tanggal, rows: [],
      errors: ["File tidak dapat dibaca. Pastikan format .xls atau .xlsx."],
      totalRows: 0,
    };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"]) {
    return { outletName, tanggal, rows: [], errors: ["Sheet kosong."], totalRows: 0 };
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);

  function cellStr(r: number, c: number): string {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    if (!cell) return "";
    return String(cell.v ?? "").trim();
  }

  function cellNum(r: number, c: number): number {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    if (!cell) return 0;
    // Numeric cells: use raw JS value directly — avoids locale ambiguity
    if (cell.t === "n") return typeof cell.v === "number" && !isNaN(cell.v) ? cell.v : 0;
    // Text/string cells: handle Indonesian locale (comma = decimal, dot = thousands)
    // e.g. "10,00" → 10, "10.000" → 10000, "1.234,56" → 1234.56
    let s = String(cell.v ?? "0").trim();
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      // Mixed: e.g. "1.234,56" — dot is thousands, comma is decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      // Comma only: treat as decimal separator (Indonesian format "10,00" → 10)
      s = s.replace(",", ".");
    }
    // If dot only, it's either a decimal or thousands — parseFloat handles it correctly
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  // ── Phase 1: Extract metadata from first 15 rows ──────────────────────────
  for (let r = 0; r <= Math.min(14, range.e.r); r++) {
    for (let c = 0; c <= Math.min(6, range.e.c); c++) {
      const raw = cellStr(r, c);
      const lo = raw.toLowerCase();

      // "Outlet : Back To Mie Kitchen" or "Outlet" with next cell = name
      if (lo.startsWith("outlet") || lo.startsWith("cabang")) {
        // Check for inline format: "Outlet : Value" or "Outlet = Value"
        const colonIdx = raw.search(/[:=]/);
        if (colonIdx !== -1) {
          const candidate = raw.slice(colonIdx + 1).trim();
          if (candidate) { outletName = candidate; continue; }
        }
        // Check adjacent cells
        for (let nc = c + 1; nc <= Math.min(c + 4, range.e.c); nc++) {
          const nv = cellStr(r, nc);
          if (nv && !nv.toLowerCase().startsWith("outlet")) {
            outletName = nv;
            break;
          }
        }
      }

      if (lo.startsWith("tanggal") || lo.startsWith("date") || lo.startsWith("tgl")) {
        const colonIdx = raw.search(/[:=]/);
        if (colonIdx !== -1) {
          const candidate = raw.slice(colonIdx + 1).trim();
          if (candidate) { tanggal = parseTanggalStr(candidate); continue; }
        }
        for (let nc = c + 1; nc <= Math.min(c + 4, range.e.c); nc++) {
          const nv = cellStr(r, nc);
          if (nv && !nv.toLowerCase().startsWith("tanggal")) {
            tanggal = parseTanggalStr(nv);
            break;
          }
        }
      }
    }
  }

  // ── Phase 2: Find header row ───────────────────────────────────────────────
  let headerRow = -1;
  const colMap: Record<string, number> = {};

  for (let r = 0; r <= Math.min(20, range.e.r); r++) {
    const rowVals: string[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      rowVals.push(cellStr(r, c).toLowerCase().replace(/\s+/g, " ").trim());
    }

    const hasProduk = rowVals.some((v) =>
      v === "produk" || v === "nama produk" || v === "item" || v === "bahan"
    );
    const hasStokAkhir = rowVals.some((v) =>
      v.includes("stok akhir") || v.includes("stock akhir") ||
      v.includes("saldo akhir") || v.includes("ending stock") || v.includes("akhir")
    );

    if (hasProduk && hasStokAkhir) {
      headerRow = r;
      rowVals.forEach((v, c) => {
        if (v === "produk" || v === "nama produk" || v === "item" || v === "bahan")
          colMap["produk"] = c;
        else if (v === "kategori" || v === "category" || v === "kat")
          colMap["kategori"] = c;
        else if (v.includes("stok awal") || v.includes("opening") || v.includes("saldo awal"))
          colMap["stokAwal"] = c;
        else if (v.includes("stok masuk") || (v.includes("masuk") && !v.includes("keluar")))
          colMap["stokMasuk"] = c;
        else if (v.includes("stok keluar") || (v.includes("keluar") && !v.includes("masuk")))
          colMap["stokKeluar"] = c;
        else if (v === "penjualan" || v === "sales" || v === "terjual" || v === "jual")
          colMap["penjualan"] = c;
        else if (v === "transfer")
          colMap["transfer"] = c;
        else if (v.includes("penyesuaian") || v.includes("adjustment") || v.includes("adj"))
          colMap["penyesuaian"] = c;
        else if (v.includes("stok akhir") || v.includes("ending") || v.includes("saldo akhir") ||
                 v.includes("stock akhir") || v === "akhir")
          colMap["stokAkhir"] = c;
        else if (v === "satuan" || v === "unit" || v === "uom" || v === "uom/satuan")
          colMap["satuan"] = c;
      });
      break;
    }
  }

  if (headerRow === -1) {
    errors.push(
      "Baris header tidak ditemukan. Pastikan file mengandung kolom 'Produk' dan 'Stok Akhir'."
    );
    return { outletName, tanggal, rows: [], errors, totalRows: 0 };
  }

  if (colMap["produk"] === undefined) {
    errors.push("Kolom 'Produk' tidak ditemukan.");
    return { outletName, tanggal, rows: [], errors, totalRows: 0 };
  }
  if (colMap["stokAkhir"] === undefined) {
    errors.push("Kolom 'Stok Akhir' tidak ditemukan.");
    return { outletName, tanggal, rows: [], errors, totalRows: 0 };
  }

  // ── Phase 3: Parse data rows ───────────────────────────────────────────────
  let totalRows = 0;
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const produkName = cellStr(r, colMap["produk"]);
    if (!produkName) continue;

    const plo = produkName.toLowerCase();
    if (plo === "total" || plo.startsWith("jumlah") || plo.startsWith("total")) continue;

    totalRows++;
    rows.push({
      produkName,
      kategori: colMap["kategori"] !== undefined ? cellStr(r, colMap["kategori"]) : "",
      stokAwal: colMap["stokAwal"] !== undefined ? cellNum(r, colMap["stokAwal"]) : 0,
      stokMasuk: colMap["stokMasuk"] !== undefined ? cellNum(r, colMap["stokMasuk"]) : 0,
      stokKeluar: colMap["stokKeluar"] !== undefined ? cellNum(r, colMap["stokKeluar"]) : 0,
      penjualan: colMap["penjualan"] !== undefined ? cellNum(r, colMap["penjualan"]) : 0,
      transfer: colMap["transfer"] !== undefined ? cellNum(r, colMap["transfer"]) : 0,
      penyesuaian: colMap["penyesuaian"] !== undefined ? cellNum(r, colMap["penyesuaian"]) : 0,
      stokAkhir: cellNum(r, colMap["stokAkhir"]),
      satuan: colMap["satuan"] !== undefined ? cellStr(r, colMap["satuan"]) : "",
    });
  }

  return { outletName, tanggal, rows, errors, totalRows };
}

function parseTanggalStr(raw: string): string {
  // DD-MM-YYYY or DD/MM/YYYY
  const m1 = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try generic parse
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
