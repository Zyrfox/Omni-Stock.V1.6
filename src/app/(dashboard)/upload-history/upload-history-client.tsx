"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatDateTime, formatDate } from "@/lib/formatters";
import { deleteUploadBatch, refreshUploadCache } from "@/actions/upload";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/app-context";
import { exportToXlsx } from "@/lib/export-xlsx";

interface Batch {
  id: string;
  outletId: string | null;
  outletNameRaw: string | null;
  tanggalKartuStok: string;
  totalProduk: number;
  matchedBahan: number;
  createdAt: Date | string | null;
  outlet?: { namaOutlet: string } | null;
  uploadedByUser?: { nama?: string | null; email?: string } | null;
}

interface Props {
  batches: Batch[];
}

export function UploadHistoryClient({ batches: initialBatches }: Props) {
  const router = useRouter();
  const { userRole } = useAppContext();
  const isAdmin = userRole === "admin";
  const [batches, setBatches] = useState(initialBatches);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  async function handleDelete(batchId: string) {
    if (!confirm(`Hapus batch ${batchId}? Data upload ini akan dihapus permanen.`)) return;
    setDeletingId(batchId);
    const result = await deleteUploadBatch(batchId);
    if (result.success) {
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
    } else {
      alert(result.message);
    }
    setDeletingId(null);
  }

  function handleRefresh() {
    startRefresh(async () => {
      await refreshUploadCache();
      router.refresh();
    });
  }

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Upload History</h1>
          <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Log semua sesi upload kartu stok</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: isRefreshing ? "not-allowed" : "pointer",
            border: "1px solid var(--color-os-border2)", background: `var(--color-os-card)`, color: "var(--color-os-text)",
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          {isRefreshing ? "Memuat..." : "Refresh Data"}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => exportToXlsx(batches.map(b => ({
              "Batch ID": b.id, Outlet: b.outlet?.namaOutlet ?? b.outletNameRaw ?? "",
              "Tgl Kartu Stok": b.tanggalKartuStok, "Total Produk": b.totalProduk,
              "Matched Bahan": b.matchedBahan, "Upload Oleh": b.uploadedByUser?.nama ?? "",
              "Tanggal Upload": b.createdAt ? new Date(b.createdAt).toLocaleDateString("id-ID") : "",
            })), "Upload_History", "Upload History")}
            style={{ fontSize: 11, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "var(--color-os-surface)", color: "var(--color-os-sub)", cursor: "pointer", fontWeight: 600 }}
          >↓ Export</button>
        </div>
        <div className="table-scroll-wrapper" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["Batch ID", "Outlet", "Tgl Kartu Stok", "Total Produk", "Matched Bahan", "Upload Oleh", "Status", "Tanggal Upload", ...(isAdmin ? ["Aksi"] : [])].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
                    Belum ada upload history. Upload kartu stok dari Dashboard untuk memulai.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const matchPct = b.totalProduk > 0
                    ? Math.round((b.matchedBahan / b.totalProduk) * 100) : 0;
                  return (
                    <tr key={b.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-accent)", fontWeight: 700 }}>
                        {b.id}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <Badge color="blue" size="sm">
                          {b.outlet?.namaOutlet ?? b.outletNameRaw ?? b.outletId ?? "—"}
                        </Badge>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>
                        {formatDate(b.tanggalKartuStok)}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>
                        {b.totalProduk}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: matchPct >= 80 ? "var(--color-os-green)" : matchPct >= 50 ? "var(--color-os-amber)" : "var(--color-os-red)", fontWeight: 700 }}>
                            {b.matchedBahan}/{b.totalProduk}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>({matchPct}%)</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>
                        {b.uploadedByUser?.nama ?? b.uploadedByUser?.email ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <Badge color={matchPct >= 80 ? "green" : matchPct >= 50 ? "amber" : "red"} size="sm">
                          {matchPct >= 80 ? "✓ Sukses" : matchPct >= 50 ? "⚠ Parsial" : "✗ Rendah"}
                        </Badge>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>
                        {b.createdAt ? formatDateTime(b.createdAt) : "—"}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={deletingId === b.id}
                            style={{
                              fontSize: 11, padding: "3px 10px", borderRadius: 4,
                              border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-red) 10%, transparent)",
                              color: "var(--color-os-red)", cursor: deletingId === b.id ? "not-allowed" : "pointer",
                              opacity: deletingId === b.id ? 0.5 : 1,
                            }}
                          >
                            {deletingId === b.id ? "..." : "Hapus"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
