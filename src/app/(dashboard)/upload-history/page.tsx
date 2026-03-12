import { db } from "@/db";
import { uploadBatches } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/shared/badge-status";
import { formatDateTime, formatDate } from "@/lib/formatters";

export default async function UploadHistoryPage() {
  const batches = await db.query.uploadBatches.findMany({
    orderBy: [desc(uploadBatches.createdAt)],
    limit: 50,
    with: {
      outlet: true,
      uploadedByUser: true,
    },
  });

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
              {["Batch ID", "Outlet", "Tgl Kartu Stok", "Total Produk", "Matched Bahan", "Upload Oleh", "Status", "Tanggal Upload"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  Belum ada upload history. Upload kartu stok dari Dashboard untuk memulai.
                </td>
              </tr>
            ) : (
              batches.map((b) => {
                const matchPct = b.totalProduk > 0
                  ? Math.round((b.matchedBahan / b.totalProduk) * 100)
                  : 0;
                return (
                  <tr key={b.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#C8F135", fontWeight: 700 }}>
                      📄 {b.id}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge color="blue" size="sm">
                        {(b as any).outlet?.namaOutlet ?? b.outletNameRaw ?? b.outletId ?? "—"}
                      </Badge>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>
                      {formatDate(b.tanggalKartuStok)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>
                      {b.totalProduk}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: matchPct >= 80 ? "#22C55E" : matchPct >= 50 ? "#F59E0B" : "#EF4444", fontWeight: 700 }}>
                          {b.matchedBahan}/{b.totalProduk}
                        </span>
                        <span style={{ fontSize: 10, color: "#4B5563" }}>({matchPct}%)</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>
                      {(b as any).uploadedByUser?.nama ?? (b as any).uploadedByUser?.email ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge color={matchPct >= 80 ? "green" : matchPct >= 50 ? "amber" : "red"} size="sm">
                        {matchPct >= 80 ? "✓ Sukses" : matchPct >= 50 ? "⚠ Parsial" : "✗ Rendah"}
                      </Badge>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>
                      {formatDateTime(b.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
