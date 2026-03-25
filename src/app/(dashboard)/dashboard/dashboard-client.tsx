"use client";

import { useState, useRef, useEffect } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { BadgeStatus, Badge } from "@/components/shared/badge-status";
import { estimasiHariHabis } from "@/lib/stock-status";
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
  const [ongkir, setOngkir] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [invViewMode, setInvViewMode] = useState<"card" | "table">("card");

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function onFab() { fileRef.current?.click(); }
    window.addEventListener("omni:fab-upload", onFab);
    return () => window.removeEventListener("omni:fab-upload", onFab);
  }, []);

  // Always base from allBahan, overlay matched upload data by bahanId
  const displayItems: UploadedStockItem[] = (() => {
    const byBahanId = new Map<string, UploadedStockItem>(
      stockItems.filter(s => s.bahanId).map(s => [s.bahanId!, s])
    );
    return allBahan.map((b) => {
      const uploaded = byBahanId.get(b.id);
      const vendorPrimary = (b.vendorBahan as any)?.[0]?.vendor;
      if (uploaded) return uploaded;
      return {
        bahanId: b.id,
        namaBahan: b.namaBahan,
        kategori: b.kategoriBahan ?? "",
        tipeBahan: b.tipeBahan,
        stokAkhir: 0,
        satuanDapur: b.satuanDapur,
        stokMinimum: b.stokMinimum,
        leadTimeDays: b.leadTimeDays,
        avgDailyConsumption: b.avgDailyConsumption,
        hargaBeli: b.hargaBeli,
        satuanBeli: b.satuanBeli,
        hargaPerSatuanPorsi: b.hargaPerSatuanPorsi,
        status: "CRITICAL" as const,
        vendorNama: vendorPrimary?.namaVendor,
        vendorId: vendorPrimary?.id,
      };
    });
  })();

  const [invSearch, setInvSearch] = useState("");
  const [invStatusFilter, setInvStatusFilter] = useState<"" | "SAFE" | "WARNING" | "CRITICAL">("");
  const [invVendorFilter, setInvVendorFilter] = useState("");
  const [invTipeBahanFilter, setInvTipeBahanFilter] = useState<"" | "packaged" | "raw_bulk">("");
  const [filterOpen, setFilterOpen] = useState(false);

  const vendorOptions = Array.from(new Set(displayItems.map((i) => i.vendorNama).filter(Boolean))) as string[];

  const filteredItems = displayItems.filter((i) => {
    if (invSearch && !i.namaBahan.toLowerCase().includes(invSearch.toLowerCase())) return false;
    if (invStatusFilter && i.status !== invStatusFilter) return false;
    if (invVendorFilter && i.vendorNama !== invVendorFilter) return false;
    if (invTipeBahanFilter && i.tipeBahan !== invTipeBahanFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  const pagedItems = filteredItems.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

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
      <div className="panel-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Table */}
        <div
          style={{
            background: "#13131F",
            border: "1px solid #1E1E2E",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {isMobile ? (
            /* ─── Mobile Header ─── */
            <div>
              {/* Row 1: title + count/filter */}
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#E2E8F0" }}>Tabel inventory</span>
                {invViewMode === "card" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#4B5563" }}>{filteredItems.length} item</span>
                    <button
                      onClick={() => setFilterOpen(prev => !prev)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: filterOpen ? "1px solid rgba(200,241,53,0.5)" : "1px solid #2D2D44", background: filterOpen ? "rgba(200,241,53,0.08)" : "transparent", color: filterOpen ? "#C8F135" : "#6B7280", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    >
                      ⊟ Filter
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "#4B5563" }}>{filteredItems.length} item · {rowsPerPage} baris</span>
                )}
              </div>
              {/* Row 2: search */}
              <div style={{ padding: "0 12px 10px" }}>
                <input
                  value={invSearch}
                  onChange={(e) => { setInvSearch(e.target.value); setCurrentPage(0); }}
                  placeholder="Cari nama bahan..."
                  style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {/* Row 3: status quick-filter tabs (card view, filter closed) */}
              {invViewMode === "card" && !filterOpen && (
                <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
                  {([
                    { key: "" as const, label: "Semua", count: displayItems.length, color: "#E2E8F0" },
                    { key: "CRITICAL" as const, label: "Critical", count: critCount, color: "#EF4444" },
                    { key: "WARNING" as const, label: "Warning", count: warnCount, color: "#F59E0B" },
                    { key: "SAFE" as const, label: "Safe", count: safeCount, color: "#22C55E" },
                  ] as const).map(({ key, label, count, color }) => {
                    const active = invStatusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { setInvStatusFilter(key); setCurrentPage(0); }}
                        style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? color : "#2D2D44"}`, background: active ? `${color}22` : "transparent", color: active ? color : "#4B5563", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Row 4: expandable filter panel */}
              {filterOpen && (
                <div style={{ padding: "0 12px 14px" }}>
                  <div style={{ background: "#0F0F18", border: "1px solid #1E1E2E", borderRadius: 10, padding: "14px 14px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Filter &amp; sort</span>
                      <button
                        onClick={() => { setInvSearch(""); setInvStatusFilter(""); setInvVendorFilter(""); setInvTipeBahanFilter(""); setRowsPerPage(20); setCurrentPage(0); }}
                        style={{ fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >Reset</button>
                    </div>
                    {/* STATUS */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#4B5563", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Status</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {([
                          { key: "" as const, label: "Semua", count: displayItems.length, color: "#E2E8F0" },
                          { key: "CRITICAL" as const, label: `Critical (${critCount})`, color: "#EF4444" },
                          { key: "WARNING" as const, label: `Warning (${warnCount})`, color: "#F59E0B" },
                          { key: "SAFE" as const, label: `Safe (${safeCount})`, color: "#22C55E" },
                        ] as const).map(({ key, label, color }) => {
                          const active = invStatusFilter === key;
                          return (
                            <button key={key} onClick={() => setInvStatusFilter(key)}
                              style={{ padding: "5px 11px", borderRadius: 6, border: `1px solid ${active ? color : "#2D2D44"}`, background: active ? `${color}18` : "transparent", color: active ? color : "#6B7280", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* VENDOR */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#4B5563", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Vendor</div>
                      <div style={{ position: "relative" }}>
                        <select value={invVendorFilter} onChange={(e) => setInvVendorFilter(e.target.value)}
                          style={{ width: "100%", background: "#13131F", border: "1px solid #2D2D44", borderRadius: 8, padding: "8px 30px 8px 12px", fontSize: 12, color: invVendorFilter ? "#E2E8F0" : "#4B5563", outline: "none", appearance: "none", WebkitAppearance: "none" as any }}>
                          <option value="">Semua Vendor</option>
                          {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563", pointerEvents: "none", fontSize: 10 }}>▼</span>
                      </div>
                    </div>
                    {/* TIPE BAHAN */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#4B5563", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Tipe Bahan</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([
                          { key: "" as const, label: "Semua" },
                          { key: "packaged" as const, label: "Packaged" },
                          { key: "raw_bulk" as const, label: "Raw/Bulk" },
                        ] as const).map(({ key, label }) => {
                          const active = invTipeBahanFilter === key;
                          return (
                            <button key={key} onClick={() => setInvTipeBahanFilter(key)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? "#E2E8F0" : "#2D2D44"}`, background: active ? "rgba(226,232,240,0.12)" : "transparent", color: active ? "#E2E8F0" : "#6B7280", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* BARIS PER HALAMAN */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#4B5563", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Baris per Halaman</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[20, 30, 40, 50].map(n => {
                          const active = rowsPerPage === n;
                          return (
                            <button key={n} onClick={() => { setRowsPerPage(n); setCurrentPage(0); }}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? "#E2E8F0" : "#2D2D44"}`, background: active ? "rgba(226,232,240,0.12)" : "transparent", color: active ? "#E2E8F0" : "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* TAMPILAN */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#4B5563", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Tampilan</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([{ key: "card" as const, label: "Card" }, { key: "table" as const, label: "Tabel" }] as const).map(({ key, label }) => {
                          const active = invViewMode === key;
                          return (
                            <button key={key} onClick={() => setInvViewMode(key)}
                              style={{ padding: "5px 20px", borderRadius: 6, border: `1px solid ${active ? "#E2E8F0" : "#2D2D44"}`, background: active ? "rgba(226,232,240,0.12)" : "transparent", color: active ? "#E2E8F0" : "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Apply */}
                    <button onClick={() => setFilterOpen(false)} className="btn-accent"
                      style={{ width: "100%", padding: "12px", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, borderRadius: 8 }}>
                      Terapkan Filter
                    </button>
                  </div>
                </div>
              )}
              <div style={{ borderBottom: "1px solid #1E1E2E" }} />
            </div>
          ) : (
            /* ─── Desktop Header ─── */
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1E1E2E", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginRight: 4 }}>Tabel Inventory</span>
              <input
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                placeholder="Cari nama bahan..."
                style={{ flex: "1 1 160px", minWidth: 120, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#E2E8F0", outline: "none" }}
              />
              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value as any)}
                style={{ background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invStatusFilter ? "#E2E8F0" : "#4B5563", outline: "none" }}
              >
                <option value="">Semua Status</option>
                <option value="SAFE">SAFE</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <select
                value={invVendorFilter}
                onChange={(e) => setInvVendorFilter(e.target.value)}
                style={{ background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invVendorFilter ? "#E2E8F0" : "#4B5563", outline: "none" }}
              >
                <option value="">Semua Vendor</option>
                {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={invTipeBahanFilter}
                onChange={(e) => setInvTipeBahanFilter(e.target.value as any)}
                style={{ background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invTipeBahanFilter ? "#E2E8F0" : "#4B5563", outline: "none" }}
              >
                <option value="">Semua Tipe</option>
                <option value="packaged">Packaged</option>
                <option value="raw_bulk">Raw/Bulk</option>
              </select>
              {(invSearch || invStatusFilter || invVendorFilter || invTipeBahanFilter) && (
                <button onClick={() => { setInvSearch(""); setInvStatusFilter(""); setInvVendorFilter(""); setInvTipeBahanFilter(""); }}
                  style={{ background: "none", border: "1px solid #2D2D44", borderRadius: 6, padding: "5px 8px", fontSize: 10, color: "#6B7280", cursor: "pointer" }}>
                  ✕ Reset
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span style={{ fontSize: 10, color: "#4B5563" }}>{filteredItems.length} item</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(0); }}
                  style={{ background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "4px 6px", fontSize: 10, color: "#6B7280", outline: "none" }}
                >
                  {[20, 30, 40, 50].map((n) => <option key={n} value={n}>{n} baris</option>)}
                </select>
              </div>
            </div>
          )}
          {isMobile && invViewMode === "card" ? (
            <div className="inv-card-list">
              {pagedItems.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  {displayItems.length === 0 ? "Upload kartu stok untuk melihat inventory." : "Tidak ada item yang cocok."}
                </div>
              ) : pagedItems.map((item) => {
                const statusColor = item.status === "CRITICAL" ? "#EF4444" : item.status === "WARNING" ? "#F59E0B" : "#22C55E";
                const inCart = item.bahanId ? poCart.find((c) => c.bahanId === item.bahanId) : false;
                return (
                  <div key={item.bahanId ?? item.namaBahan} className="inv-card" style={{ borderLeft: `3px solid ${statusColor}` }}>
                    <div className="inv-card-body">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{item.namaBahan}</span>
                        <BadgeStatus status={item.status} size="sm" />
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4B5563", marginTop: 2 }}>{item.bahanId ?? "—"}</div>
                      <div className="inv-card-data-grid">
                        {[
                          { label: "Stok Akhir", value: `${item.stokAkhir} ${item.satuanDapur}` },
                          { label: "Min. Stok", value: String(item.stokMinimum) },
                          { label: "Harga Beli", value: formatRupiah(parseFloat(item.hargaBeli)) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "#13131F", borderRadius: 6, padding: "5px 7px" }}>
                            <div style={{ fontSize: 8, color: "#4B5563", textTransform: "uppercase" }}>{label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", marginTop: 2 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {item.tipeBahan && <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">{item.tipeBahan}</Badge>}
                        {item.vendorNama && <span style={{ fontSize: 9, color: "#4B5563" }}>{item.vendorNama}</span>}
                      </div>
                    </div>
                    {item.status !== "SAFE" && item.bahanId && (
                      <div className="inv-card-cta" style={{ borderTopColor: statusColor, background: `${statusColor}18` }}>
                        <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>
                          {item.status === "CRITICAL" ? "Stok kritis" : "Perlu restock"}
                        </span>
                        {inCart
                          ? <span style={{ fontSize: 10, color: "#22C55E", fontWeight: 700 }}>✓ In Cart</span>
                          : <button onClick={() => addToCart(item)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: `1px solid ${statusColor}40`, background: `${statusColor}18`, color: statusColor, cursor: "pointer" }}>+ Rancang PO</button>
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="table-scroll-wrapper" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#14142A" }}>
                  {["#", "ID Bahan", "Nama Bahan", "Tipe", "Stok Akhir", "Min. Stok", "Status", "Vendor", "Harga Beli", "Aksi"].map(
                    (h) => (
                      <th
                        key={h}
                        className={h === "Nama Bahan" ? "col-sticky-nama" : h === "#" || h === "ID Bahan" ? "col-hide-mobile" : undefined}
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
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                      {displayItems.length === 0 ? "Belum ada data. Upload kartu stok untuk melihat inventory." : "Tidak ada item yang cocok dengan filter."}
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((item, idx) => {
                    const inCart = item.bahanId ? poCart.find((c) => c.bahanId === item.bahanId) : false;
                    const globalIdx = safePage * rowsPerPage + idx;
                    return (
                      <tr
                        key={item.bahanId ?? item.namaBahan}
                        className="table-row-hover"
                        style={{ borderBottom: "1px solid #131320", transition: "background 0.1s" }}
                      >
                        <td className="col-hide-mobile" style={{ padding: "10px 14px", fontSize: 10, color: "#4B5563" }}>{globalIdx + 1}</td>
                        <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>
                          {item.bahanId ?? <span style={{ color: "#EF4444", fontSize: 10 }}>unmatched</span>}
                        </td>
                        <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>
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
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0", whiteSpace: "nowrap" }}>
                          {formatRupiah(parseFloat(item.hargaBeli))}
                          {item.satuanBeli && <span style={{ fontSize: 9, color: "#4B5563", marginLeft: 4 }}>/{item.satuanBeli}</span>}
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
            {isMobile && (
              <div style={{ textAlign: "center", padding: "8px 0 6px", color: "#374151", fontSize: 10 }}>— Scroll horizontal —</div>
            )}
          </div>
          )}
          {/* Pagination controls */}
          {totalPages > 1 && (
            isMobile ? (
              <div style={{ padding: "10px 12px", borderTop: "1px solid #1E1E2E", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#4B5563", flexShrink: 0 }}>
                  {safePage * rowsPerPage + 1}–{Math.min((safePage + 1) * rowsPerPage, filteredItems.length)} dari {filteredItems.length}
                </span>
                <div style={{ display: "flex", gap: 3, overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                    style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>‹</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                    const p = start + i;
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: `1px solid ${p === safePage ? "rgba(200,241,53,0.4)" : "#2D2D44"}`, background: p === safePage ? "rgba(200,241,53,0.1)" : "transparent", color: p === safePage ? "#C8F135" : "#6B7280", fontSize: 11, cursor: "pointer", fontWeight: p === safePage ? 700 : 400 }}>
                        {p + 1}
                      </button>
                    );
                  })}
                  {totalPages > 5 && safePage < totalPages - 3 && (
                    <>
                      <span style={{ padding: "4px 4px", color: "#4B5563", fontSize: 11 }}>…</span>
                      <button onClick={() => setCurrentPage(totalPages - 1)}
                        style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: "#6B7280", fontSize: 11, cursor: "pointer" }}>
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                    style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage >= totalPages - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>›</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 16px", borderTop: "1px solid #1E1E2E", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>
                  Halaman {safePage + 1} dari {totalPages} ({filteredItems.length} item)
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setCurrentPage(0)} disabled={safePage === 0}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage === 0 ? "#2D2D44" : "#6B7280", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage === 0 ? "#2D2D44" : "#6B7280", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                    const p = start + i;
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${p === safePage ? "rgba(200,241,53,0.4)" : "#2D2D44"}`, background: p === safePage ? "rgba(200,241,53,0.1)" : "transparent", color: p === safePage ? "#C8F135" : "#6B7280", fontSize: 11, cursor: "pointer", fontWeight: p === safePage ? 700 : 400 }}>
                        {p + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage >= totalPages - 1 ? "#2D2D44" : "#6B7280", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>Next ›</button>
                  <button onClick={() => setCurrentPage(totalPages - 1)} disabled={safePage >= totalPages - 1}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #2D2D44", background: "transparent", color: safePage >= totalPages - 1 ? "#2D2D44" : "#6B7280", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>»</button>
                </div>
              </div>
            )
          )}
        </div>

        {/* PO Cart — below table */}
        {(cartOpen || poCart.length > 0) && (
          <div
            style={{
              background: "#13131F",
              border: "1px solid #1E1E2E",
              borderRadius: 12,
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

            <div style={{ padding: 12 }}>
              {poCart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#4B5563", fontSize: 12 }}>
                  🛒 Tambahkan bahan dari tabel untuk membuat PO
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {poCart.map((item) => (
                  <div
                    key={item.bahanId}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #1E1E2E",
                      borderRadius: 8,
                      background: "#0F0F18",
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
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#E2E8F0", marginBottom: 2 }}>{item.vendorNama}</div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">
                            {item.tipeBahan}
                          </Badge>
                          {item.kontakWa && (
                            <>
                              <span style={{ fontSize: 10, color: "#4B5563" }}>{item.kontakWa}</span>
                              <a
                                href={`https://wa.me/${formatWANumber(item.kontakWa)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)", color: "#25D366", textDecoration: "none", whiteSpace: "nowrap" }}
                              >
                                📱 WA
                              </a>
                            </>
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
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "#131320", borderRadius: 6, border: "1px solid #1E1E2E" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: "#4B5563", flexShrink: 0 }}>Harga satuan:</span>
                        <input
                          type="number"
                          value={item.hargaSatuan}
                          min={0}
                          onChange={(e) =>
                            setPoCart((prev) =>
                              prev.map((c) =>
                                c.bahanId === item.bahanId
                                  ? { ...c, hargaSatuan: parseFloat(e.target.value) || 0 }
                                  : c
                              )
                            )
                          }
                          style={{ flex: 1, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#E2E8F0", outline: "none" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "#4B5563", flexShrink: 0 }}>Qty:</span>
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
                          style={{ width: 70, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#E2E8F0", outline: "none" }}
                        />
                        {item.hargaSatuan > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#C8F135", marginLeft: "auto" }}>
                            = Rp {(item.qty * item.hargaSatuan).toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>

            {poCart.length > 0 && (() => {
              const subtotal = poCart.reduce((sum, c) => sum + c.qty * c.hargaSatuan, 0);
              const grandTotal = subtotal + ongkir;
              function buildWAText() {
                const lines: string[] = [];
                lines.push("📋 *PURCHASE ORDER — OMNI-STOCK*");
                lines.push(`📅 ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`);
                lines.push("");
                // Group by vendor
                const byVendor = new Map<string, typeof poCart>();
                for (const c of poCart) {
                  if (!byVendor.has(c.vendorNama)) byVendor.set(c.vendorNama, []);
                  byVendor.get(c.vendorNama)!.push(c);
                }
                for (const [vName, items] of byVendor) {
                  const firstItem = items[0];
                  lines.push(`🏪 *${vName}*${firstItem.kontakWa ? ` — WA: ${firstItem.kontakWa}` : ""}`);
                  for (const c of items) {
                    const sub = c.qty * c.hargaSatuan;
                    lines.push(`  • ${c.namaBahan} — ${c.qty}x${c.hargaSatuan > 0 ? ` @ Rp ${c.hargaSatuan.toLocaleString("id-ID")} = Rp ${sub.toLocaleString("id-ID")}` : ""}`);
                  }
                  lines.push("");
                }
                lines.push(`💰 *Subtotal: Rp ${subtotal.toLocaleString("id-ID")}*`);
                if (ongkir > 0) lines.push(`🚚 Ongkir: Rp ${ongkir.toLocaleString("id-ID")}`);
                lines.push(`✅ *TOTAL: Rp ${grandTotal.toLocaleString("id-ID")}*`);
                return lines.join("\n");
              }
              return (
                <div style={{ padding: 12, borderTop: "1px solid #1E1E2E" }}>
                  {/* Totals */}
                  <div style={{ marginBottom: 12, padding: "10px 14px", background: "#0F0F18", borderRadius: 8, border: "1px solid #1E1E2E" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "#4B5563" }}>Subtotal ({poCart.length} item)</span>
                      <span style={{ fontSize: 11, color: "#E2E8F0", fontWeight: 600 }}>Rp {subtotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
                      <span style={{ fontSize: 11, color: "#4B5563", flexShrink: 0 }}>Ongkir (Rp)</span>
                      <input
                        type="number"
                        value={ongkir || ""}
                        min={0}
                        placeholder="0"
                        onChange={(e) => setOngkir(parseFloat(e.target.value) || 0)}
                        style={{ width: 120, background: "#131320", border: "1px solid #2D2D44", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", textAlign: "right" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #1E1E2E" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Grand Total</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#C8F135" }}>Rp {grandTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(buildWAText());
                        alert("Teks PO disalin! Tempel ke grup WhatsApp.");
                      }}
                      style={{ flex: 1, padding: "9px", border: "1px solid rgba(37,211,102,0.4)", borderRadius: 8, background: "rgba(37,211,102,0.08)", color: "#25D366", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                    >
                      📋 Salin untuk WA
                    </button>
                    <button
                      onClick={createDraftPOs}
                      className="btn-accent"
                      style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      + Buat {poCart.length} Draft PO
                    </button>
                  </div>
                </div>
              );
            })()}
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
        <div className="table-scroll-wrapper">
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
    </div>
  );
}
