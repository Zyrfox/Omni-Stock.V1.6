export const dynamic = "force-dynamic";

import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { FileText, Clock, CheckCircle2, BarChart2 } from "lucide-react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah, formatDateTime } from "@/lib/formatters";
import { BillingActions } from "./billing-actions";
import { ExportButton } from "@/components/shared/export-button";

async function getBillingData() {
  const orders = await db.query.purchaseOrders.findMany({
    with: { vendor: true, bahan: true, outlet: true },
    orderBy: (po, { desc }) => [desc(po.createdAt)],
  });

  const [statsResult] = await db.execute(
    sql`SELECT
      COUNT(*) as total,
      COALESCE(SUM(total_harga) FILTER (WHERE status != 'received'), 0) as outstanding,
      COUNT(*) FILTER (WHERE status != 'received') as outstanding_count,
      COALESCE(SUM(total_harga) FILTER (WHERE status = 'received'), 0) as lunas,
      COUNT(*) FILTER (WHERE status = 'received') as lunas_count,
      COALESCE(SUM(total_harga) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0) as bulan_ini
    FROM purchase_orders`
  ) as unknown as Array<{ total: string; outstanding: string; outstanding_count: string; lunas: string; lunas_count: string; bulan_ini: string }>;

  return { orders, stats: statsResult };
}

export default async function BillingPage() {
  const { orders, stats } = await getBillingData();

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Billing</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Manajemen invoice & pembayaran</p>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Invoice" value={parseInt(stats?.total ?? "0")} icon={FileText} color="var(--color-os-blue)" />
        <StatCard label="Outstanding" value={formatRupiah(parseFloat(stats?.outstanding ?? "0"))} icon={Clock} color="var(--color-os-amber)" sub={`${stats?.outstanding_count ?? 0} invoice`} />
        <StatCard label="Lunas" value={formatRupiah(parseFloat(stats?.lunas ?? "0"))} icon={CheckCircle2} color="var(--color-os-green)" sub={`${stats?.lunas_count ?? 0} invoice`} />
        <StatCard label="Bulan Ini" value={formatRupiah(parseFloat(stats?.bulan_ini ?? "0"))} icon={BarChart2} color="var(--color-os-accent)" />
      </div>

      <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", justifyContent: "flex-end" }}>
          <ExportButton
            rows={orders.map((po) => ({
              "Invoice ID": po.id, Tanggal: po.createdAt ? new Date(po.createdAt).toLocaleDateString("id-ID") : "",
              Vendor: (po as any).vendor?.namaVendor ?? "", "Total Biaya": parseFloat(po.totalHarga),
              Status: po.status === "received" ? "LUNAS" : "UNPAID",
            }))}
            fileName="Billing"
            sheetName="Billing"
          />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: `var(--color-os-row-hover)` }}>
              {["Invoice ID", "Tanggal", "Vendor", "Total Item", "Total Biaya", "Status", "Action"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada invoice.</td></tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-accent)", fontWeight: 700 }}>{po.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>{formatDateTime(po.createdAt)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{(po as any).vendor?.namaVendor}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>1</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-red)", fontWeight: 700 }}>{formatRupiah(parseFloat(po.totalHarga))}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge color={po.status === "received" ? "green" : "amber"} size="sm">
                      {po.status === "received" ? "✓ LUNAS" : "⏳ UNPAID"}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", color: "var(--color-os-blue)", cursor: "pointer" }}>Detail</button>
                      <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--color-os-border2)", background: "transparent", color: "var(--color-os-sub)", cursor: "pointer" }}>PDF</button>
                      {po.status !== "received" && <BillingActions poId={po.id} />}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
