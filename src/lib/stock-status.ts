/**
 * OMNI-STOCK — 3-Color Stock Status Logic
 * Section 18 of PRD — calculated server-side, NEVER by AI.
 */

export type StockStatus = "SAFE" | "WARNING" | "CRITICAL";

export interface StockStatusInput {
  stokAkhir: number;
  stokMinimum: number;
  leadTimeDays: number;
  avgDailyConsumption: number;
}

/**
 * Calculate stock status based on PRD Section 18 formula.
 *
 * SAFE:     stok_akhir > (stok_minimum + (lead_time_days × avg_daily_consumption))
 * WARNING:  stok_akhir ≤ (stok_minimum + (lead_time_days × avg_daily_consumption))
 * CRITICAL: stok_akhir ≤ stok_minimum
 */
export function calculateStockStatus(input: StockStatusInput): StockStatus {
  const { stokAkhir, stokMinimum, leadTimeDays, avgDailyConsumption } = input;
  const warningThreshold = stokMinimum + leadTimeDays * avgDailyConsumption;

  if (stokAkhir <= stokMinimum) return "CRITICAL";
  if (stokAkhir <= warningThreshold) return "WARNING";
  return "SAFE";
}

/**
 * Estimate days until stock runs out.
 */
export function estimasiHariHabis(stokAkhir: number, avgDailyConsumption: number): number {
  if (avgDailyConsumption <= 0) return 999;
  return Math.floor(stokAkhir / avgDailyConsumption);
}

export const STATUS_CONFIG = {
  SAFE: {
    label: "SAFE",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.3)",
    dot: "bg-green-500",
  },
  WARNING: {
    label: "WARNING",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.3)",
    dot: "bg-amber-500",
  },
  CRITICAL: {
    label: "CRITICAL",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.3)",
    dot: "bg-red-500",
  },
} as const;

/**
 * Format stokMinimum in both satuanDapur and kemasan units.
 * Example: stokMinimum=60, isiSatuan=20, satuanDapur="pcs", satuanBeli="Pack"
 *   → { primary: "60 pcs", secondary: "3 Pack" }
 */
export function formatMinStok(
  stokMinimum: number,
  isiSatuan: number,
  satuanDapur: string,
  satuanBeli: string
): { primary: string; secondary: string | null } {
  const primary = `${stokMinimum} ${satuanDapur}`;
  if (isiSatuan <= 0) return { primary, secondary: null };
  const kemasan = Math.ceil(stokMinimum / isiSatuan);
  return { primary, secondary: `${kemasan} ${satuanBeli}` };
}
