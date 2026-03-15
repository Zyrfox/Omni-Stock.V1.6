"use client";

import { useState, useRef } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { BadgeStatus, Badge } from "@/components/shared/badge-status";
import { calculateStockStatus, estimasiHariHabis } from "@/lib/stock-status";
import { formatRupiah, formatDateTime } from "@/lib/formatters";
import { processUpload } from "@/actions/upload";
import type { UploadedStockItem } from "@/actions/upload";
import { createDraftPO } from "@/actions/purchase-order";
import { useSession } from "@/lib/auth-client";
import type { MasterBahan, PurchaseOrder, MasterVendor } from "@/db/schema";

interface POCartItem {
  bahanId: string;
  namaBahan: string;
  vendorId: string;
  vendorNama: string;
  kontakWa: string | null;
  allVendors: Array<{ id: string; nama: string; kontakWa: string | null }>;
  tipeBahan: "packaged" | "raw_bulk";
  qty: number;
  hargaSatuan: number;
  stokAkhir: number;
}

function formatWANumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits;
}

interface DashboardClientProps {
  totalBahan: number;
  recentPOs: Array<PurchaseOrder & { vendor: MasterVendor; bahan: MasterBahan }>;
  allBahan: Array<MasterBahan & { vendorBahan: Array<{ vendor: MasterVendor; isPrimary: boolean }> }>;
  topContributors: Array<{ id: string; nama: string; email: string; role: string; po_count: string }>;
  auditData: { outstanding: number; paid: number; topVendors: Array<{ nama_vendor: string; total: string }> };
}

export function DashboardClient({ totalBahan, recentPOs, allBahan, topContributors, auditData }: DashboardClientProps) {
  const { data: session } = useSession();
  const [stockItems, setStockItems] = useState<UploadedStockItem[]>([]);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [lastUploadInfo, setLastUploadInfo] = useState<{ matched: number; total: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [poCart, setPoCart] = useState<POCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Compute stats from stockItems or allBahan fallback
  const displayItems: UploadedStockItem[] = stockItems.length > 0 ? stockItems : allBahan.map((b) => ({
    bahanId: b.id,
    namaBahan: b.namaBahan,
    kategori: "",
    tipeBahan: b.tipeBahan,
    stokAkhir: 0,
    satuanDapur: b.satuanDapur,
    stokMinimum: b.stokMinimum,
    leadTimeDays: b.leadTimeDays,
    avgDailyConsumption: b.avgDailyConsumption,
    hargaBeli: b.hargaBeli,
    hargaPerSatuanPorsi: b.hargaPerSatuanPorsi,
    status: "CRITICAL" as const,
    vendorNama: (b.vendorBahan as any)?.[0]?.vendor?.namaVendor,
    vendorId: (b.vendorBahan as any)?.[0]?.vendor?.id,
  }));

  const safeCount = displayItems.filter((i) => i.status === "SAFE").length;
  const warnCount = displayItems.filter((i) => i.status === "WARNING").length;
  const critCount = displayItems.filter((i) => i.status === "CRITICAL").length;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const outletId = (session?.user as any)?.outletId ?? "OUT-001";
      const userId = session?.user?.id ?? "";
      const result = await processUpload(formData, outletId, userId);

      if (result.success) {
        setStockItems(result.stockItems);
        setLastUpload(new Date().toLocaleString("id-ID"));
        setLastUploadInfo({ matched: result.matchedBahan, total: result.itemsParsed });
      } else {
        setUploadError(result.message + " " + result.errors.slice(0, 2).join("; "));
      }
    } catch (err) {
      setUploadError("Upload gagal. Coba lagi.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addToCart(item: UploadedStockItem) {
    if (!item.bahanId) return; // can't create PO for unmatched items
    if (poCart.find((c) => c.bahanId === item.bahanId)) return;
    const bahanFull = allBahan.find((b) => b.id === item.bahanId);
    const vendorList = bahanFull?.vendorBahan?.map((vb: any) => ({
      id: vb.vendor?.id ?? "",
      nama: vb.vendor?.namaVendor ?? "—",
      kontakWa: vb.vendor?.kontakWa ?? null,
    })) ?? [];
    const primaryVb = bahanFull?.vendorBahan?.find((vb: any) => vb.isPrimary) ?? bahanFull?.vendorBahan?.[0];
    const primaryVendorId = primaryVb?.vendor?.id ?? item.vendorId ?? "";
    const primaryVendorNama = primaryVb?.vendor?.namaVendor ?? item.vendorNama ?? "—";
    const primaryKontakWa = primaryVb?.vendor?.kontakWa ?? null;
    setPoCart((prev) => [
      ...prev,
      {
        bahanId: item.bahanId!,
        namaBahan: item.namaBahan,
        vendorId: primaryVendorId,
        vendorNama: primaryVendorNama,
        kontakWa: primaryKontakWa,
        allVendors: vendorList,
        tipeBahan: item.tipeBahan ?? "packaged",
        qty: 1,
        hargaSatuan: parseFloat(item.hargaBeli) || 0,
        stokAkhir: item.stokAkhir,
      },
    ]);
    setCartOpen(true);
  }

  function removeFromCart(bahanId: string) {
    setPoCart((prev) => prev.filter((c) => c.bahanId !== bahanId));
  }

  async function createDraftPOs() {
    const userId = session?.user?.id ?? "";
    const outletId = (session?.user as any)?.outletId ?? "OUT-001";
    for (const item of poCart) {
      if (!item.vendorId) continue;
      await createDraftPO({
        outletId,
        vendorId: item.vendorId,
        bahanId: item.bahanId,
        qtyOrder: item.qty,
        hargaSatuan: item.hargaSatuan,
        createdBy: userId,
        stokAkhir: item.stokAkhir,
      });
    }
    setPoCart([]);
    setCartOpen(false);
  }

  const critWarning = displayItems.filter((i) => i.status === "CRITICAL" || i.status === "WARNING").slice(0, 3);

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>
          Overview persediaan & prediksi restock
        </p>
      </div>

      {/* Smart Batch Uploader */}
      <div
        style={{
          background: "#13131F",
          border: "1px solid #1E1E2E",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Smart Batch Uploader</div>
          {lastUpload && lastUploadInfo && (
            <span
              style={{
                fontSize: 10,
                background: "rgba(34,197,94,0.1)",
                color: "#22C55E",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 4,
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              {lastUpload} · {lastUploadInfo.matched}/{lastUploadInfo.total} matched
            </span>
          )}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${uploading ? "#C8F135" : "#2D2D44"}`,
            borderRadius: 8,
            padding: "20px",
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "#C8F135"; }}
          onMouseLeave={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "#2D2D44"; }}
        >
          <div style={{ fontSize: 20, marginBottom: 8 }}>⬆</div>
          <div style={{ fontSize: 12, color: "#E2E8F0", fontWeight: 600 }}>
            {uploading ? "Memproses..." : "Click to upload or drag and drop"}
          </div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>.xls and .xlsx supported</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        {uploadError && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#EF4444" }}>⚠ {uploadError}</div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Products" value={totalBahan} icon="📦" color="#60A5FA" />
        <StatCard label="Available Stocks" value={safeCount} icon="✅" color="#22C55E" sub="Status SAFE" />
        <StatCard label="Warning + Critical" value={warnCount + critCount} icon="⚠" color="#F59E0B" sub="Butuh perhatian" />
        <StatCard label="Out of Stocks" value={critCount} icon="🚫" color="#EF4444" sub="Status CRITICAL" />
      </div>

      {/* Widget Row 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Widget 1 — Top Contributors */}
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>👥 Top Contributors</div>
          {topContributors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#4B5563", fontSize: 12 }}>Belum ada aktivitas.</div>
          ) : (
            topContributors.map((u, idx) => {
              const initial = (u.nama || u.email).charAt(0).toUpperCase();
              const total = parseInt(u.po_count ?? "0");
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: idx < topContributors.length - 1 ? "1px solid #1E1E2E" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #C8F135, #86EF3C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#0A0A0F", flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nama || u.email}</div>
                    <div style={{ fontSize: 10, color: "#4B5563" }}>{total} POs dibuat</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: total > 0 ? "rgba(200,241,53,0.1)" : "rgba(75,85,99,0.2)", border: `1px solid ${total > 0 ? "rgba(200,241,53,0.3)" : "rgba(75,85,99,0.3)"}`, color: total > 0 ? "#C8F135" : "#4B5563" }}>
                    {total}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Widget 2 — Audit Pengeluaran */}
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>💳 Audit Pengeluaran</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "#0F0F18", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 4 }}>OUTSTANDING</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F59E0B" }}>
                {auditData.outstanding >= 1_000_000
                  ? `Rp ${(auditData.outstanding / 1_000_000).toFixed(1)}jt`
                  : formatRupiah(auditData.outstanding)}
              </div>
            </div>
            <div style={{ background: "#0F0F18", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 4 }}>LUNAS</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#22C55E" }}>
                {auditData.paid >= 1_000_000
                  ? `Rp ${(auditData.paid / 1_000_000).toFixed(1)}jt`
                  : formatRupiah(auditData.paid)}
              </div>
            </div>
          </div>
          {auditData.topVendors.length === 0 ? (
            <div style={{ fontSize: 11, color: "#4B5563" }}>Belum ada transaksi vendor.</div>
          ) : (
            auditData.topVendors.map((v) => {
              const maxTotal = parseFloat(auditData.topVendors[0]?.total ?? "1");
              const pct = (parseFloat(v.total) / maxTotal) * 100;
              const val = parseFloat(v.total);
              return (
                <div key={v.nama_vendor} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#E2E8F0" }}>{v.nama_vendor}</span>
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700 }}>
                      {val >= 1_000_000 ? `Rp ${(val / 1_000_000).toFixed(1)}jt` : formatRupiah(val)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#1E1E2E", borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#EF4444", borderRadius: 2, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Widget 3 — Smart Stock Warning */}
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>⚠ Smart Stock Warning</div>
          {critWarning.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#4B5563", fontSize: 12 }}>
              🔥 Semua stok aman
            </div>
          ) : (
            critWarning.map((item) => (
              <div
                key={item.bahanId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #1E1E2E",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{item.namaBahan}</div>
                  <div style={{ fontSize: 10, color: "#4B5563" }}>
                    Stok: {item.stokAkhir} {item.satuanDapur} ·{" "}
                    {estimasiHariHabis(item.stokAkhir, item.avgDailyConsumption)} hari lagi
                  </div>
                </div>
                <BadgeStatus status={item.status} size="sm" />
              </div>
            ))
          )}
        </div>

        {/* Widget 4 — AI Predictive Restock */}
        <div
          style={{
            background: "#13131F",
            border: "1px solid #1E1E2E",
            borderRadius: 12,
            padding: 18,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              fontSize: 80,
              opacity: 0.04,
              userSelect: "none",
            }}
          >
            ✦
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#C8F135", marginBottom: 12 }}>
            ✦ AI Predictive Restock (Gemini)
          </div>
          {stockItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>✦</div>
              <div style={{ fontSize: 11, color: "#4B5563" }}>
                Upload kartu stok untuk mengaktifkan AI
              </div>
            </div>
          ) : (
            displayItems.filter((i) => i.status === "CRITICAL").slice(0, 2).map((item) => (
              <div
                key={item.bahanId}
                style={{ padding: "8px 0", borderBottom: "1px solid #1E1E2E" }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{item.namaBahan}</div>
                <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>
                  Habis dalam {estimasiHariHabis(item.stokAkhir, item.avgDailyConsumption)} hari ·{" "}
                  <Badge color="blue" size="sm">{item.tipeBahan}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inventory Table + PO Cart */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Table */}
        <div
          style={{
            flex: 1,
            background: "#13131F",
            border: "1px solid #1E1E2E",
            borderRadius: 12,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #1E1E2E" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Tabel Inventory</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#14142A" }}>
                  {["#", "ID Bahan", "Nama Bahan", "Tipe", "Stok Akhir", "Min. Stok", "Status", "Vendor", "Harga Beli", "Aksi"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#4B5563",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          textAlign: "left",
                          borderBottom: "1px solid #1E1E2E",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                      Belum ada data. Upload kartu stok untuk melihat inventory.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item, idx) => {
                    const inCart = item.bahanId ? poCart.find((c) => c.bahanId === item.bahanId) : false;
                    return (
                      <tr
                        key={item.bahanId ?? item.namaBahan}
                        className="table-row-hover"
                        style={{ borderBottom: "1px solid #131320", transition: "background 0.1s" }}
                      >
                        <td style={{ padding: "10px 14px", fontSize: 10, color: "#4B5563" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>
                          {item.bahanId ?? <span style={{ color: "#EF4444", fontSize: 10 }}>unmatched</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>
                          {item.namaBahan}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {item.tipeBahan ? (
                            <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">
                              {item.tipeBahan === "packaged" ? "📦 packaged" : "🌿 raw_bulk"}
                            </Badge>
                          ) : <span style={{ fontSize: 10, color: "#4B5563" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>
                          <span style={{ fontWeight: 600 }}>{item.stokAkhir}</span>{" "}
                          <span style={{ fontSize: 9, color: "#4B5563" }}>{item.satuanDapur}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#4B5563" }}>{item.stokMinimum}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <BadgeStatus status={item.status} size="sm" />
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>
                          {item.vendorNama ?? "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>
                          {formatRupiah(parseFloat(item.hargaBeli))}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {item.status !== "SAFE" && item.bahanId ? (
                            inCart ? (
                              <span style={{ fontSize: 10, color: "#22C55E", fontWeight: 700 }}>✓ In Cart</span>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${item.status === "CRITICAL" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
                                  background: `${item.status === "CRITICAL" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)"}`,
                                  color: item.status === "CRITICAL" ? "#EF4444" : "#F59E0B",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                + Rancang PO
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: 10, color: "#4B5563" }}>
                              {item.status === "SAFE" ? "—" : "No master"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PO Cart Sidebar */}
        {(cartOpen || poCart.length > 0) && (
          <div
            style={{
              width: 300,
              background: "#13131F",
              border: "1px solid #1E1E2E",
              borderRadius: 12,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #1E1E2E",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Keranjang PO</span>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#C8F135",
                  color: "#0A0A0F",
                  fontSize: 10,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {poCart.length}
              </span>
            </div>

            <div style={{ padding: 12, maxHeight: 400, overflowY: "auto" }}>
              {poCart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#4B5563", fontSize: 12 }}>
                  🛒 Tambahkan bahan dari tabel untuk membuat PO
                </div>
              ) : (
                poCart.map((item) => (
                  <div
                    key={item.bahanId}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #1E1E2E",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#E2E8F0", marginBottom: 3 }}>{item.namaBahan}</div>
                        {item.allVendors.length > 1 ? (
                          <select
                            value={item.vendorId}
                            onChange={(e) => {
                              const sel = item.allVendors.find((v) => v.id === e.target.value);
                              setPoCart((prev) => prev.map((c) => c.bahanId === item.bahanId
                                ? { ...c, vendorId: sel?.id ?? "", vendorNama: sel?.nama ?? "—", kontakWa: sel?.kontakWa ?? null }
                                : c));
                            }}
                            style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 5, padding: "3px 6px", fontSize: 10, color: "#E2E8F0", outline: "none", marginBottom: 3 }}
                          >
                            {item.allVendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.nama}</option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 3 }}>{item.vendorNama}</div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">
                            {item.tipeBahan}
                          </Badge>
                          {item.kontakWa && (
                            <a
                              href={`https://wa.me/${formatWANumber(item.kontakWa)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)", color: "#25D366", textDecoration: "none", whiteSpace: "nowrap" }}
                            >
                              📱 WA
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.bahanId)}
                        style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "#4B5563" }}>Qty:</span>
                      <input
                        type="number"
                        value={item.qty}
                        min={1}
                        onChange={(e) =>
                          setPoCart((prev) =>
                            prev.map((c) =>
                              c.bahanId === item.bahanId
                                ? { ...c, qty: parseInt(e.target.value) || 1 }
                                : c
                            )
                          )
                        }
                        style={{
                          width: 60,
                          background: "#0F0F18",
                          border: "1px solid #2D2D44",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 12,
                          color: "#E2E8F0",
                          outline: "none",
                        }}
                      />
                    </div>
                    {item.tipeBahan === "raw_bulk" && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 8px",
                          background: "rgba(200,241,53,0.05)",
                          border: "1px solid rgba(200,241,53,0.15)",
                          borderRadius: 6,
                          fontSize: 10,
                          color: "#C8F135",
                        }}
                      >
                        ✦ AI Research — estimasi harga & yield akan di-generate saat buat PO
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {poCart.length > 0 && (
              <div style={{ padding: 12, borderTop: "1px solid #1E1E2E" }}>
                <button
                  onClick={createDraftPOs}
                  className="btn-accent"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  + Buat {poCart.length} Draft PO
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PO Logs Section */}
      <div
        style={{
          marginTop: 20,
          background: "#13131F",
          border: "1px solid #1E1E2E",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1E1E2E" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>PO Logs Terbaru</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["PO ID", "Tanggal", "Vendor", "Total Item", "Total Biaya", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#4B5563",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "left",
                    borderBottom: "1px solid #1E1E2E",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentPOs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  Belum ada PO
                </td>
              </tr>
            ) : (
              recentPOs.map((po) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#C8F135", fontWeight: 700 }}>
                    {po.id}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>
                    {formatDateTime(po.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>
                    {(po as any).vendor?.namaVendor ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>1</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#EF4444", fontWeight: 700 }}>
                    {formatRupiah(parseFloat(po.totalHarga))}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge
                      color={po.status === "received" ? "green" : po.status === "sent" ? "amber" : "gray"}
                      size="sm"
                    >
                      {po.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(96,165,250,0.3)",
                        background: "rgba(96,165,250,0.1)",
                        color: "#60A5FA",
                        cursor: "pointer",
                        marginRight: 6,
                      }}
                    >
                      Detail
                    </button>
                    <button
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "1px solid #2D2D44",
                        background: "transparent",
                        color: "#6B7280",
                        cursor: "pointer",
                      }}
                    >
                      PDF
                    </button>
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
