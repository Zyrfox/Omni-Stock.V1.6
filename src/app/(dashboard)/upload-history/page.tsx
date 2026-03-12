import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Badge } from "@/components/shared/badge-status";
import { formatDateTime } from "@/lib/formatters";

export default async function UploadHistoryPage() {
  const batches = await db.execute(
    sql`SELECT
      upload_batch_id,
      outlet_id,
      MIN(created_at) as created_at,
      COUNT(*) as items_parsed,
      COUNT(DISTINCT menu_id) as unique_menus
    FROM sales_transactions
    GROUP BY upload_batch_id, outlet_id
    ORDER BY MIN(created_at) DESC
    LIMIT 50`
  ) as unknown as Array<{
    upload_batch_id: string; outlet_id: string;
    created_at: string; items_parsed: string; unique_menus: string;
  }>;

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Upload History</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Log semua sesi upload kartu stok</p>
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["ID", "Batch ID", "Outlet", "Items Parsed", "Menu Unik", "Status", "Tanggal"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada upload history.</td></tr>
            ) : (
              batches.map((b, idx) => (
                <tr key={b.upload_batch_id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>UPL-{String(idx + 1).padStart(3, "0")}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#E2E8F0" }}>📄 {b.upload_batch_id}</td>
                  <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{b.outlet_id}</Badge></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{b.items_parsed}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.unique_menus}</td>
                  <td style={{ padding: "10px 14px" }}><Badge color="green" size="sm">✓ Success</Badge></td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{formatDateTime(b.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
