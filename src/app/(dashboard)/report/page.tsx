export const revalidate = 60;

import { db } from "@/db";
import { purchaseOrders, masterBahan } from "@/db/schema";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { TrendingDown, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatRupiah } from "@/lib/formatters";
import { MONTHS_ID } from "@/lib/constants";
import { Badge } from "@/components/shared/badge-status";

async function getReportData() {
  const [statsResult] = await db.execute(
    sql`SELECT
      COALESCE(SUM(total_harga), 0) as total_pengeluaran,
      COUNT(*) FILTER (WHERE status = 'received') as total_po_selesai,
      AVG(v.estimasi_pengiriman) as avg_lead_time
    FROM purchase_orders po
    LEFT JOIN master_vendor v ON v.id = po.vendor_id`
  ) as unknown as Array<{ total_pengeluaran: string; total_po_selesai: string; avg_lead_time: string }>;

  const monthlyData = await db.execute(
    sql`SELECT
      EXTRACT(MONTH FROM created_at) as month,
      COALESCE(SUM(total_harga), 0) as total
    FROM purchase_orders
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    GROUP BY month
    ORDER BY month`
  ) as unknown as Array<{ month: string; total: string }>;

  const topBahan = await db.execute(
    sql`SELECT mb.nama_bahan, COALESCE(SUM(po.total_harga), 0) as total
    FROM purchase_orders po
    JOIN master_bahan mb ON mb.id = po.bahan_id
    GROUP BY mb.nama_bahan
    ORDER BY total DESC
    LIMIT 5`
  ) as unknown as Array<{ nama_bahan: string; total: string }>;

  const vendorPerforma = await db.execute(
    sql`SELECT
      mv.nama_vendor,
      mv.estimasi_pengiriman as lead_time_estimasi,
      AVG(EXTRACT(DAY FROM po.tanggal_terima - po.tanggal_kirim)) as lead_time_aktual
    FROM purchase_orders po
    JOIN master_vendor mv ON mv.id = po.vendor_id
    WHERE po.status = 'received' AND po.tanggal_kirim IS NOT NULL AND po.tanggal_terima IS NOT NULL
    GROUP BY mv.nama_vendor, mv.estimasi_pengiriman
    LIMIT 5`
  ) as unknown as Array<{ nama_vendor: string; lead_time_estimasi: string; lead_time_aktual: string }>;

  return { statsResult, monthlyData, topBahan, vendorPerforma };
}

export default async function ReportPage() {
  const { statsResult, monthlyData, topBahan, vendorPerforma } = await getReportData();

  // Build 12-month chart data
  const monthMap = new Map<number, number>();
  monthlyData.forEach((m) => monthMap.set(parseInt(m.month), parseFloat(m.total)));
  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, value: monthMap.get(i + 1) ?? 0,
  }));
  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Report</h1>
          <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Analitik pengeluaran & performa</p>
        </div>
        <button style={{ fontSize: 12, padding: "8px 14px", borderRadius: 7, border: "1px solid var(--color-os-border2)", background: "transparent", color: "var(--color-os-sub)", cursor: "pointer" }}>
          Export Excel
        </button>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Pengeluaran" value={formatRupiah(parseFloat(statsResult?.total_pengeluaran ?? "0"))} icon={TrendingDown} color="var(--color-os-red)" />
        <StatCard label="Total PO Selesai" value={parseInt(statsResult?.total_po_selesai ?? "0")} icon={CheckCircle2} color="var(--color-os-green)" />
        <StatCard label="Avg Lead Time" value={`${Math.round(parseFloat(statsResult?.avg_lead_time ?? "0"))} hari`} icon={Clock} color="var(--color-os-blue)" />
        <StatCard label="Item Critical" value="0" icon={XCircle} color="var(--color-os-red)" />
      </div>

      {/* Bar Chart */}
      <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>Tren Pengeluaran (Tahun Ini)</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {chartData.map((d) => {
            const heightPct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            const isCurrentMonth = d.month === currentMonth;
            return (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {d.value > 0 && (
                  <span style={{ fontSize: 8, color: "var(--color-os-accent)", marginBottom: 2 }}>
                    {d.value >= 1_000_000 ? `${(d.value / 1_000_000).toFixed(0)}jt` : `${(d.value / 1000).toFixed(0)}k`}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(heightPct, 3)}%`,
                    borderRadius: "3px 3px 0 0",
                    background: isCurrentMonth
                      ? "linear-gradient(180deg, var(--color-os-accent), var(--color-os-accentD))"
                      : "color-mix(in srgb, var(--color-os-accent) 20%, transparent)",
                    border: isCurrentMonth ? "none" : "1px solid color-mix(in srgb, var(--color-os-accent) 10%, transparent)",
                    transition: "height 0.3s",
                  }}
                />
                <span style={{ fontSize: 9, color: "var(--color-os-muted)" }}>{MONTHS_ID[d.month - 1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid 2 kolom */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Top 5 Bahan */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 12 }}>Top 5 Bahan by Pengeluaran</div>
          {topBahan.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--color-os-muted)" }}>Belum ada data.</div>
          ) : (
            topBahan.map((b) => {
              const pct = (parseFloat(b.total) / (parseFloat(topBahan[0].total) || 1)) * 100;
              return (
                <div key={b.nama_bahan} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--color-os-text)" }}>{b.nama_bahan}</span>
                    <span style={{ fontSize: 12, color: "var(--color-os-red)", fontWeight: 700 }}>{formatRupiah(parseFloat(b.total))}</span>
                  </div>
                  <div style={{ height: 4, background: `var(--color-os-border)`, borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD))", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Performa Vendor */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 12 }}>Performa Vendor</div>
          {vendorPerforma.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--color-os-muted)" }}>Belum ada data pengiriman selesai.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Vendor", "Est.", "Aktual", "Status"].map((h) => (
                    <th key={h} style={{ fontSize: 10, color: "var(--color-os-muted)", textAlign: "left", paddingBottom: 8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorPerforma.map((v) => {
                  const onTime = parseFloat(v.lead_time_aktual ?? "0") <= parseFloat(v.lead_time_estimasi);
                  return (
                    <tr key={v.nama_vendor} style={{ borderTop: "1px solid var(--color-os-border)" }}>
                      <td style={{ padding: "8px 0", fontSize: 12, color: "var(--color-os-text)" }}>{v.nama_vendor}</td>
                      <td style={{ padding: "8px 4px", fontSize: 11, color: "var(--color-os-sub)" }}>{v.lead_time_estimasi}h</td>
                      <td style={{ padding: "8px 4px", fontSize: 11, color: "var(--color-os-sub)" }}>{Math.round(parseFloat(v.lead_time_aktual ?? "0"))}h</td>
                      <td style={{ padding: "8px 0" }}>
                        <Badge color={onTime ? "green" : "amber"} size="sm">
                          {onTime ? "⭐ On Time" : "⚠ Terlambat"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
