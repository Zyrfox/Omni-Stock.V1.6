import { db } from "@/db";
import { outlets, purchaseOrders, masterMenu, salesTransactions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";

export default async function StoresPage() {
  const outletList = await db.query.outlets.findMany();

  const [statsResult] = await db.execute(
    sql`SELECT COUNT(*) as total FROM outlets`
  ) as unknown as Array<{ total: string }>;

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Stores</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Compliance & performa per outlet</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Outlet" value={parseInt(statsResult?.total ?? "0")} icon="🏪" color="#60A5FA" sub="Aktif" />
        <StatCard label="Inventory Net Worth" value="Rp 0" icon="💰" color="#22C55E" sub="Total semua cabang" />
        <StatCard label="Avg Upload Compliance" value="0%" icon="📊" color="#F59E0B" sub="Target: 80%" />
        <StatCard label="Butuh Perhatian" value="0" icon="⚠" color="#EF4444" sub="Compliance rendah" />
      </div>

      {/* Tab: Overview */}
      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1E1E2E" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Upload Compliance per Outlet</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["Outlet ID", "Nama Outlet", "Upload Compliance", "Inventory Net Worth", "Critical", "Warning", "Aksi"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outletList.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada outlet terdaftar.</td></tr>
            ) : (
              outletList.map((o) => (
                <tr key={o.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{o.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{o.namaOutlet}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 80, height: 4, background: "#1E1E2E", borderRadius: 2 }}>
                        <div style={{ width: "0%", height: "100%", background: "#EF4444", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#EF4444" }}>0%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0", fontWeight: 600 }}>Rp 0</td>
                  <td style={{ padding: "10px 14px" }}><Badge color="red" size="sm">0</Badge></td>
                  <td style={{ padding: "10px 14px" }}><Badge color="amber" size="sm">0</Badge></td>
                  <td style={{ padding: "10px 14px" }}>
                    <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Detail</button>
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
