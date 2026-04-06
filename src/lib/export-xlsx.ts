import * as XLSX from "xlsx";

/**
 * Export data to .xlsx file and trigger browser download.
 * @param rows   Array of objects — each key becomes a column header
 * @param fileName  File name without extension
 * @param sheetName  Optional sheet name (default "Data")
 */
export function exportToXlsx(
  rows: Record<string, unknown>[],
  fileName: string,
  sheetName = "Data",
) {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
