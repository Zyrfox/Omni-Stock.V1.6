export const revalidate = 60;

import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { Truck, Clock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah, formatDateTime, calculateETA } from "@/lib/formatters";
import { DeliveryActions } from "./delivery-actions";
import { ExportButton } from "@/components/shared/export-button";

export default async function DeliveryPage() {
  const orders = await db.query.purchaseOrders.findMany({
    where: (po, { inArray }) => inArray(po.status, ["sent", "received"]),
    with: { vendor: true, bahan: true, outlet: true },
    orderBy: (po, { desc }) => [desc(po.tanggalKirim)],
  });

  const [statsResult] = await db.execute(
    sql`SELECT
      COUNT(*) FILTER (WHERE status = 'sent') as in_transit,
      COUNT(*) FILTER (WHERE status = 'draft') as pending,
      COUNT(*) FILTER (WHERE status = 'received') as delivered
    FROM purchase_orders`
  ) as unknown as Array<{ in_transit: string; pending: string; delivered: string }>;

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Delivery Tracking</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Pantau status pengiriman bahan baku</p>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="In Transit" value={parseInt(statsResult?.in_transit ?? "0")} icon={Truck} color="var(--color-os-blue)" />
        <StatCard label="Pending" value={parseInt(statsResult?.pending ?? "0")} icon={Clock} color="var(--color-os-amber)" />
        <StatCard label="Delivered" value={parseInt(statsResult?.delivered ?? "0")} icon={CheckCircle2} color="var(--color-os-green)" />
      </div>

      <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", justifyContent: "flex-end" }}>
          <ExportButton
            rows={orders.map((po, idx) => ({
              "DEL ID": `DEL-${String(idx + 1).padStart(3, "0")}`, "PO ID": po.id,
              Vendor: (po as any).vendor?.namaVendor ?? "", Bahan: (po as any).bahan?.namaBahan ?? "",
              Qty: `${po.qtyOrder} ${(po as any).bahan?.satuanDapur ?? ""}`,
              Status: po.status === "received" ? "Delivered" : po.status === "sent" ? "In Transit" : "Pending",
            }))}
            fileName="Delivery"
            sheetName="Delivery"
          />
        </div>
        <div className="table-scroll-wrapper">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: `var(--color-os-row-hover)` }}>
              {["DEL ID", "PO ID", "Vendor", "Bahan", "Qty", "ETA", "Status", "Aksi"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada pengiriman aktif.</td></tr>
            ) : (
              orders.map((po, idx) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-muted)" }}>DEL-{String(idx + 1).padStart(3, "0")}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-accent)" }}>{po.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{(po as any).vendor?.namaVendor}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>{(po as any).bahan?.namaBahan}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>{po.qtyOrder} {(po as any).bahan?.satuanDapur}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>
                    {po.tanggalKirim ? calculateETA(po.tanggalKirim, (po as any).vendor?.estimasiPengiriman ?? 1) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge color={po.status === "received" ? "green" : po.status === "sent" ? "blue" : "amber"} size="sm">
                      {po.status === "received" ? "Delivered" : po.status === "sent" ? "In Transit" : "Pending"}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {po.status !== "received" ? (
                      <DeliveryActions poId={po.id} />
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--color-os-green)", fontWeight: 600 }}>✓ Selesai</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
