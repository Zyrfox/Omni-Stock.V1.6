"use client";

import { exportToXlsx } from "@/lib/export-xlsx";

interface ExportButtonProps {
  rows: Record<string, unknown>[];
  fileName: string;
  sheetName?: string;
}

export function ExportButton({ rows, fileName, sheetName }: ExportButtonProps) {
  return (
    <button
      onClick={() => exportToXlsx(rows, fileName, sheetName)}
      style={{
        fontSize: 11,
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid var(--color-os-border2)",
        background: "var(--color-os-surface)",
        color: "var(--color-os-sub)",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      ↓ Export
    </button>
  );
}
