export const dynamic = "force-dynamic";

import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah, formatDateTime } from "@/lib/formatters";
import { BillingActions } from "./billing-actions";

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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Billing</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen invoice & pembayaran</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Invoice" value={parseInt(stats?.total ?? "0")} icon="📄" color="#60A5FA" />
        <StatCard label="Outstanding" value={formatRupiah(parseFloat(stats?.outstanding ?? "0"))} icon="⏳" color="#F59E0B" sub={`${stats?.outstanding_count ?? 0} invoice`} />
        <StatCard label="Lunas" value={formatRupiah(parseFloat(stats?.lunas ?? "0"))} icon="✅" color="#22C55E" sub={`${stats?.lunas_count ?? 0} invoice`} />
        <StatCard label="Bulan Ini" value={formatRupiah(parseFloat(stats?.bulan_ini ?? "0"))} icon="📊" color="#C8F135" />
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["Invoice ID", "Tanggal", "Vendor", "Total Item", "Total Biaya", "Status", "Action"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada invoice.</td></tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#C8F135", fontWeight: 700 }}>{po.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{formatDateTime(po.createdAt)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{(po as any).vendor?.namaVendor}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>1</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#EF4444", fontWeight: 700 }}>{formatRupiah(parseFloat(po.totalHarga))}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge color={po.status === "received" ? "green" : "amber"} size="sm">
                      {po.status === "received" ? "✓ LUNAS" : "⏳ UNPAID"}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Detail</button>
                      <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #2D2D44", background: "transparent", color: "#6B7280", cursor: "pointer" }}>PDF</button>
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
