"use client";

import { useState, useRef, useEffect } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { Package, CheckCircle2, AlertTriangle, XCircle, Users, CreditCard, Sparkles } from "lucide-react";
import { BadgeStatus, Badge } from "@/components/shared/badge-status";
import { estimasiHariHabis, formatMinStok, formatStokAkhir } from "@/lib/stock-status";
import { formatRupiah, formatDateTime } from "@/lib/formatters";
import { processUpload } from "@/actions/upload";
import type { UploadedStockItem } from "@/actions/upload";
import { createDraftPO } from "@/actions/purchase-order";
import { useSession } from "@/lib/auth-client";
import { buildWAUrl, DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";
import { exportToXlsx } from "@/lib/export-xlsx";
import type { MasterBahan, PurchaseOrder, MasterVendor } from "@/db/schema";

interface POCartItem {
  bahanId: string;
  namaBahan: string;
  vendorId: string;
  vendorNama: string;
  kontakWa: string | null;
  vendorPlatform: string;
  allVendors: Array<{ id: string; nama: string; kontakWa: string | null; platform: string }>;
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
  outletList?: Array<{ id: string; namaOutlet: string }>;
  waTemplates?: Record<string, string>;
}

export function DashboardClient({ totalBahan, recentPOs, allBahan, topContributors, auditData, outletList, waTemplates }: DashboardClientProps) {
  const { data: session } = useSession();
  const userOutletId = (session?.user as any)?.outletId ?? "OUT-001";
  const userOutletName = outletList?.find((o) => o.id === userOutletId)?.namaOutlet ?? "";
  const waTemplate = waTemplates?.[userOutletId] ?? DEFAULT_WA_TEMPLATE;
  const [stockItems, setStockItems] = useState<UploadedStockItem[]>([]);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [lastUploadInfo, setLastUploadInfo] = useState<{ matched: number; total: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [poCart, setPoCart] = useState<POCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ongkir, setOngkir] = useState(0);
  const [poDivisi, setPoDivisi] = useState("");
  const [poOutletId, setPoOutletId] = useState(userOutletId);
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
        isiSatuan: parseFloat(b.isiSatuan),
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
      platform: vb.vendor?.vendorPlatform ?? "offline",
    })) ?? [];
    const primaryVb = bahanFull?.vendorBahan?.find((vb: any) => vb.isPrimary) ?? bahanFull?.vendorBahan?.[0];
    const primaryVendorId = primaryVb?.vendor?.id ?? item.vendorId ?? "";
    const primaryVendorNama = primaryVb?.vendor?.namaVendor ?? item.vendorNama ?? "—";
    const primaryKontakWa = primaryVb?.vendor?.kontakWa ?? null;
    const primaryPlatform = primaryVb?.vendor?.vendorPlatform ?? "offline";
    setPoCart((prev) => [
      ...prev,
      {
        bahanId: item.bahanId!,
        namaBahan: item.namaBahan,
        vendorId: primaryVendorId,
        vendorNama: primaryVendorNama,
        kontakWa: primaryKontakWa,
        vendorPlatform: primaryPlatform,
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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>
          Overview persediaan & prediksi restock
        </p>
      </div>

      {/* Smart Batch Uploader */}
      <div
        style={{
          background: "var(--color-os-card)",
          border: "1px solid var(--color-os-border)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>Smart Batch Uploader</div>
          {lastUpload && lastUploadInfo && (
            <span
              style={{
                fontSize: 10,
                background: "color-mix(in srgb, var(--color-os-green) 10%, transparent)",
                color: "var(--color-os-green)",
                border: "1px solid color-mix(in srgb, var(--color-os-green) 30%, transparent)",
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
            border: `2px dashed ${uploading ? "var(--color-os-accent)" : "var(--color-os-border)"}`,
            borderRadius: 8,
            padding: "20px",
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-os-accent)"; }}
          onMouseLeave={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-os-border)"; }}
        >
          <div style={{ fontSize: 20, marginBottom: 8 }}>⬆</div>
          <div style={{ fontSize: 12, color: "var(--color-os-text)", fontWeight: 600 }}>
            {uploading ? "Memproses..." : "Click to upload or drag and drop"}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-os-muted)", marginTop: 4 }}>.xls and .xlsx supported</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        {uploadError && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-os-red)" }}>⚠ {uploadError}</div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Products" value={totalBahan} icon={Package} color="var(--color-os-blue)" />
        <StatCard label="Available Stocks" value={safeCount} icon={CheckCircle2} color="var(--color-os-green)" sub="Status SAFE" />
        <StatCard label="Warning + Critical" value={warnCount + critCount} icon={AlertTriangle} color="var(--color-os-amber)" sub="Butuh perhatian" />
        <StatCard label="Out of Stocks" value={critCount} icon={XCircle} color="var(--color-os-red)" sub="Status CRITICAL" />
      </div>

      {/* Widget Row 2×2 */}
      <div className="panel-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Widget 1 — Top Contributors */}
        <div style={{ background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Users size={13} style={{ color: "var(--color-os-blue)" }} /> Top Contributors</div>
          {topContributors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada aktivitas.</div>
          ) : (
            topContributors.map((u, idx) => {
              const initial = (u.nama || u.email).charAt(0).toUpperCase();
              const total = parseInt(u.po_count ?? "0");
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: idx < topContributors.length - 1 ? "1px solid var(--color-os-border)" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: `var(--color-os-bg)`, flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nama || u.email}</div>
                    <div style={{ fontSize: 10, color: "var(--color-os-muted)" }}>{total} POs dibuat</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: total > 0 ? "color-mix(in srgb, var(--color-os-accent) 10%, transparent)" : "color-mix(in srgb, var(--color-os-muted) 20%, transparent)", border: `1px solid ${total > 0 ? "color-mix(in srgb, var(--color-os-accent) 30%, transparent)" : "color-mix(in srgb, var(--color-os-muted) 30%, transparent)"}`, color: total > 0 ? "var(--color-os-accent)" : "var(--color-os-muted)" }}>
                    {total}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Widget 2 — Audit Pengeluaran */}
        <div style={{ background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><CreditCard size={13} style={{ color: "var(--color-os-blue)" }} /> Audit Pengeluaran</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>OUTSTANDING</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-os-amber)" }}>
                {auditData.outstanding >= 1_000_000
                  ? `Rp ${(auditData.outstanding / 1_000_000).toFixed(1)}jt`
                  : formatRupiah(auditData.outstanding)}
              </div>
            </div>
            <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>LUNAS</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-os-green)" }}>
                {auditData.paid >= 1_000_000
                  ? `Rp ${(auditData.paid / 1_000_000).toFixed(1)}jt`
                  : formatRupiah(auditData.paid)}
              </div>
            </div>
          </div>
          {auditData.topVendors.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--color-os-muted)" }}>Belum ada transaksi vendor.</div>
          ) : (
            auditData.topVendors.map((v) => {
              const maxTotal = parseFloat(auditData.topVendors[0]?.total ?? "1");
              const pct = (parseFloat(v.total) / maxTotal) * 100;
              const val = parseFloat(v.total);
              return (
                <div key={v.nama_vendor} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "var(--color-os-text)" }}>{v.nama_vendor}</span>
                    <span style={{ fontSize: 11, color: "var(--color-os-red)", fontWeight: 700 }}>
                      {val >= 1_000_000 ? `Rp ${(val / 1_000_000).toFixed(1)}jt` : formatRupiah(val)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "var(--color-os-border)", borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-os-red)", borderRadius: 2, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Widget 3 — Smart Stock Warning */}
        <div style={{ background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} style={{ color: "var(--color-os-amber)" }} /> Smart Stock Warning</div>
          {critWarning.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-os-muted)", fontSize: 12 }}>
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
                  borderBottom: "1px solid var(--color-os-border)",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{item.namaBahan}</div>
                  <div style={{ fontSize: 10, color: "var(--color-os-muted)" }}>
                    Stok: {item.stokAkhir} {item.satuanDapur} ·{" "}
                    {estimasiHariHabis(item.stokAkhir, item.avgDailyConsumption)} hari lagi
                  </div>
                </div>
                <BadgeStatus status={item.status} size="sm" detail={`${item.stokAkhir}/${item.stokMinimum} ${item.satuanDapur}`} />
              </div>
            ))
          )}
        </div>

        {/* Widget 4 — AI Predictive Restock */}
        <div
          style={{
            background: "var(--color-os-card)",
            border: "1px solid var(--color-os-border)",
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-accent)", marginBottom: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={13} style={{ color: "var(--color-os-accent)" }} /> AI Predictive Restock (Gemini)</span>
          </div>
          {stockItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>✦</div>
              <div style={{ fontSize: 11, color: "var(--color-os-muted)" }}>
                Upload kartu stok untuk mengaktifkan AI
              </div>
            </div>
          ) : (
            displayItems.filter((i) => i.status === "CRITICAL").slice(0, 2).map((item) => (
              <div
                key={item.bahanId}
                style={{ padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{item.namaBahan}</div>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginTop: 2 }}>
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
            background: "var(--color-os-card)",
            border: "1px solid var(--color-os-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {isMobile ? (
            /* ─── Mobile Header ─── */
            <div>
              {/* Row 1: title + count/filter */}
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--color-os-text)" }}>Tabel inventory</span>
                {invViewMode === "card" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{filteredItems.length} item</span>
                    <button
                      onClick={() => setFilterOpen(prev => !prev)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: filterOpen ? "1px solid color-mix(in srgb, var(--color-os-accent) 50%, transparent)" : "1px solid var(--color-os-border)", background: filterOpen ? "color-mix(in srgb, var(--color-os-accent) 8%, transparent)" : "transparent", color: filterOpen ? "var(--color-os-accent)" : "var(--color-os-sub)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    >
                      ⊟ Filter
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{filteredItems.length} item · {rowsPerPage} baris</span>
                )}
              </div>
              {/* Row 2: search */}
              <div style={{ padding: "0 12px 10px" }}>
                <input
                  value={invSearch}
                  onChange={(e) => { setInvSearch(e.target.value); setCurrentPage(0); }}
                  placeholder="Cari nama bahan..."
                  style={{ width: "100%", background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {/* Row 3: status quick-filter tabs (card view, filter closed) */}
              {invViewMode === "card" && !filterOpen && (
                <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
                  {([
                    { key: "" as const, label: "Semua", count: displayItems.length, color: "var(--color-os-text)" },
                    { key: "CRITICAL" as const, label: "Critical", count: critCount, color: "var(--color-os-red)" },
                    { key: "WARNING" as const, label: "Warning", count: warnCount, color: "var(--color-os-amber)" },
                    { key: "SAFE" as const, label: "Safe", count: safeCount, color: "var(--color-os-green)" },
                  ] as const).map(({ key, label, count, color }) => {
                    const active = invStatusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { setInvStatusFilter(key); setCurrentPage(0); }}
                        style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? color : "var(--color-os-border)"}`, background: active ? `${color}22` : "transparent", color: active ? color : "var(--color-os-muted)", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}
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
                  <div style={{ background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 10, padding: "14px 14px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>Filter &amp; sort</span>
                      <button
                        onClick={() => { setInvSearch(""); setInvStatusFilter(""); setInvVendorFilter(""); setInvTipeBahanFilter(""); setRowsPerPage(20); setCurrentPage(0); }}
                        style={{ fontSize: 11, color: "var(--color-os-blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >Reset</button>
                    </div>
                    {/* STATUS */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Status</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {([
                          { key: "" as const, label: "Semua", count: displayItems.length, color: "var(--color-os-text)" },
                          { key: "CRITICAL" as const, label: `Critical (${critCount})`, color: "var(--color-os-red)" },
                          { key: "WARNING" as const, label: `Warning (${warnCount})`, color: "var(--color-os-amber)" },
                          { key: "SAFE" as const, label: `Safe (${safeCount})`, color: "var(--color-os-green)" },
                        ] as const).map(({ key, label, color }) => {
                          const active = invStatusFilter === key;
                          return (
                            <button key={key} onClick={() => setInvStatusFilter(key)}
                              style={{ padding: "5px 11px", borderRadius: 6, border: `1px solid ${active ? color : "var(--color-os-border)"}`, background: active ? `${color}18` : "transparent", color: active ? color : "var(--color-os-sub)", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* VENDOR */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Vendor</div>
                      <div style={{ position: "relative" }}>
                        <select value={invVendorFilter} onChange={(e) => setInvVendorFilter(e.target.value)}
                          style={{ width: "100%", background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 8, padding: "8px 30px 8px 12px", fontSize: 12, color: invVendorFilter ? "var(--color-os-text)" : "var(--color-os-muted)", outline: "none", appearance: "none", WebkitAppearance: "none" as any }}>
                          <option value="">Semua Vendor</option>
                          {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-os-muted)", pointerEvents: "none", fontSize: 10 }}>▼</span>
                      </div>
                    </div>
                    {/* TIPE BAHAN */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Tipe Bahan</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([
                          { key: "" as const, label: "Semua" },
                          { key: "packaged" as const, label: "Packaged" },
                          { key: "raw_bulk" as const, label: "Raw/Bulk" },
                        ] as const).map(({ key, label }) => {
                          const active = invTipeBahanFilter === key;
                          return (
                            <button key={key} onClick={() => setInvTipeBahanFilter(key)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? "var(--color-os-text)" : "var(--color-os-border)"}`, background: active ? "color-mix(in srgb, var(--color-os-text) 12%, transparent)" : "transparent", color: active ? "var(--color-os-text)" : "var(--color-os-sub)", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* BARIS PER HALAMAN */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Baris per Halaman</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[20, 30, 40, 50].map(n => {
                          const active = rowsPerPage === n;
                          return (
                            <button key={n} onClick={() => { setRowsPerPage(n); setCurrentPage(0); }}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? "var(--color-os-text)" : "var(--color-os-border)"}`, background: active ? "color-mix(in srgb, var(--color-os-text) 12%, transparent)" : "transparent", color: active ? "var(--color-os-text)" : "var(--color-os-sub)", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* TAMPILAN */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Tampilan</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([{ key: "card" as const, label: "Card" }, { key: "table" as const, label: "Tabel" }] as const).map(({ key, label }) => {
                          const active = invViewMode === key;
                          return (
                            <button key={key} onClick={() => setInvViewMode(key)}
                              style={{ padding: "5px 20px", borderRadius: 6, border: `1px solid ${active ? "var(--color-os-text)" : "var(--color-os-border)"}`, background: active ? "color-mix(in srgb, var(--color-os-text) 12%, transparent)" : "transparent", color: active ? "var(--color-os-text)" : "var(--color-os-sub)", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
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
              <div style={{ borderBottom: "1px solid var(--color-os-border)" }} />
            </div>
          ) : (
            /* ─── Desktop Header ─── */
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginRight: 4 }}>Tabel Inventory</span>
              {stockItems.length > 0 && (
                <button
                  onClick={() => { setStockItems([]); setLastUpload(null); setLastUploadInfo(null); }}
                  title="Hapus data kartu stok dari tampilan"
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-red) 8%, transparent)", color: "var(--color-os-red)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                  Clear Dashboard
                </button>
              )}
              <input
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                placeholder="Cari nama bahan..."
                style={{ flex: "1 1 160px", minWidth: 120, background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "var(--color-os-text)", outline: "none" }}
              />
              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value as any)}
                style={{ background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invStatusFilter ? "var(--color-os-text)" : "var(--color-os-muted)", outline: "none" }}
              >
                <option value="">Semua Status</option>
                <option value="SAFE">SAFE</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <select
                value={invVendorFilter}
                onChange={(e) => setInvVendorFilter(e.target.value)}
                style={{ background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invVendorFilter ? "var(--color-os-text)" : "var(--color-os-muted)", outline: "none" }}
              >
                <option value="">Semua Vendor</option>
                {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={invTipeBahanFilter}
                onChange={(e) => setInvTipeBahanFilter(e.target.value as any)}
                style={{ background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: invTipeBahanFilter ? "var(--color-os-text)" : "var(--color-os-muted)", outline: "none" }}
              >
                <option value="">Semua Tipe</option>
                <option value="packaged">Packaged</option>
                <option value="raw_bulk">Raw/Bulk</option>
              </select>
              {(invSearch || invStatusFilter || invVendorFilter || invTipeBahanFilter) && (
                <button onClick={() => { setInvSearch(""); setInvStatusFilter(""); setInvVendorFilter(""); setInvTipeBahanFilter(""); }}
                  style={{ background: "none", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 10, color: "var(--color-os-sub)", cursor: "pointer" }}>
                  ✕ Reset
                </button>
              )}
              <button
                onClick={() => exportToXlsx(filteredItems.map(i => ({
                  "ID Bahan": i.bahanId ?? "", "Nama Bahan": i.namaBahan, Tipe: i.tipeBahan ?? "",
                  "Stok Akhir": i.stokAkhir, "Satuan": i.satuanDapur, "Min. Stok": i.stokMinimum,
                  Status: i.status, Vendor: i.vendorNama ?? "", "Harga Beli": parseFloat(i.hargaBeli),
                })), "Inventory_Dashboard", "Inventory")}
                style={{ flexShrink: 0, fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-os-border)", background: "var(--color-os-bg)", color: "var(--color-os-sub)", cursor: "pointer", fontWeight: 600 }}
              >↓ Export</button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>{filteredItems.length} item</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(0); }}
                  style={{ background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "4px 6px", fontSize: 10, color: "var(--color-os-sub)", outline: "none" }}
                >
                  {[20, 30, 40, 50].map((n) => <option key={n} value={n}>{n} baris</option>)}
                </select>
              </div>
            </div>
          )}
          {isMobile && invViewMode === "card" ? (
            <div className="inv-card-list">
              {pagedItems.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
                  {displayItems.length === 0 ? "Upload kartu stok untuk melihat inventory." : "Tidak ada item yang cocok."}
                </div>
              ) : pagedItems.map((item) => {
                const statusColor = item.status === "CRITICAL" ? "var(--color-os-red)" : item.status === "WARNING" ? "var(--color-os-amber)" : "var(--color-os-green)";
                const inCart = item.bahanId ? poCart.find((c) => c.bahanId === item.bahanId) : false;
                return (
                  <div key={item.bahanId ?? item.namaBahan} className="inv-card" style={{ borderLeft: `3px solid ${statusColor}` }}>
                    <div className="inv-card-body">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{item.namaBahan}</span>
                        <BadgeStatus status={item.status} size="sm" detail={`${item.stokAkhir}/${item.stokMinimum} ${item.satuanDapur}`} />
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--color-os-muted)", marginTop: 2 }}>{item.bahanId ?? "—"}</div>
                      <div className="inv-card-data-grid">
                        {[
                          { label: "Stok Akhir", value: (() => {
                            if (item.isiSatuan && item.isiSatuan > 0 && item.satuanBeli) {
                              const pkg = Math.floor(item.stokAkhir / item.isiSatuan);
                              return `${item.stokAkhir} ${item.satuanDapur} (${pkg} ${item.satuanBeli})`;
                            }
                            return `${item.stokAkhir} ${item.satuanDapur}`;
                          })() },
                          { label: "Min. Stok", value: (() => {
                            if (item.isiSatuan && item.isiSatuan > 0 && item.satuanBeli) {
                              const f = formatMinStok(item.stokMinimum, item.isiSatuan, item.satuanDapur, item.satuanBeli);
                              return f.secondary ? `${f.primary} (${f.secondary})` : f.primary;
                            }
                            return `${item.stokMinimum} ${item.satuanDapur}`;
                          })() },
                          { label: "Harga Beli", value: formatRupiah(parseFloat(item.hargaBeli)) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "var(--color-os-card)", borderRadius: 6, padding: "5px 7px" }}>
                            <div style={{ fontSize: 8, color: "var(--color-os-muted)", textTransform: "uppercase" }}>{label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-os-text)", marginTop: 2 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {item.tipeBahan && <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">{item.tipeBahan}</Badge>}
                        {item.vendorNama && <span style={{ fontSize: 9, color: "var(--color-os-muted)" }}>{item.vendorNama}</span>}
                      </div>
                    </div>
                    {item.bahanId && (
                      <div className="inv-card-cta" style={{ borderTopColor: statusColor, background: `${statusColor}18` }}>
                        <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>
                          {item.status === "CRITICAL" ? "Stok kritis" : item.status === "WARNING" ? "Perlu restock" : "Stok aman"}
                        </span>
                        {inCart
                          ? <span style={{ fontSize: 10, color: "var(--color-os-green)", fontWeight: 700 }}>✓ In Cart</span>
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
                <tr style={{ background: "var(--color-os-surface)" }}>
                  {["#", "ID Bahan", "Nama Bahan", "Tipe", "Stok Akhir", "Min. Stok", "Status", "Vendor", "Harga Beli", "Aksi"].map(
                    (h) => (
                      <th
                        key={h}
                        className={h === "Nama Bahan" ? "col-sticky-nama" : h === "#" || h === "ID Bahan" ? "col-hide-mobile" : undefined}
                        style={{
                          padding: "10px 14px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--color-os-muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          textAlign: "left",
                          borderBottom: "1px solid var(--color-os-border)",
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
                    <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
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
                        style={{ borderBottom: "1px solid var(--color-os-border)", transition: "background 0.1s" }}
                      >
                        <td className="col-hide-mobile" style={{ padding: "10px 14px", fontSize: 10, color: "var(--color-os-muted)" }}>{globalIdx + 1}</td>
                        <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-muted)" }}>
                          {item.bahanId ?? <span style={{ color: "var(--color-os-red)", fontSize: 10 }}>unmatched</span>}
                        </td>
                        <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>
                          {item.namaBahan}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {item.tipeBahan ? (
                            <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">
                              {item.tipeBahan === "packaged" ? "📦 packaged" : "🌿 raw_bulk"}
                            </Badge>
                          ) : <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>
                          <span style={{ fontWeight: 600 }}>{item.stokAkhir}</span>{" "}
                          <span style={{ fontSize: 9, color: "var(--color-os-muted)" }}>{item.satuanDapur}</span>
                          {item.isiSatuan && item.isiSatuan > 0 && item.satuanBeli && (
                            <span style={{ display: "block", fontSize: 9, color: "var(--color-os-muted)" }}>
                              ({Math.floor(item.stokAkhir / item.isiSatuan)} {item.satuanBeli})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-muted)" }}>
                          {(() => {
                            if (item.isiSatuan && item.isiSatuan > 0 && item.satuanBeli) {
                              const fmt = formatMinStok(item.stokMinimum, item.isiSatuan, item.satuanDapur, item.satuanBeli);
                              return <><span>{fmt.primary}</span>{fmt.secondary && <span style={{ display: "block", fontSize: 9 }}>{fmt.secondary}</span>}</>
                            }
                            return `${item.stokMinimum} ${item.satuanDapur}`;
                          })()}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <BadgeStatus status={item.status} size="sm" detail={`${item.stokAkhir}/${item.stokMinimum} ${item.satuanDapur}`} />
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>
                          {item.vendorNama ?? "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)", whiteSpace: "nowrap" }}>
                          {formatRupiah(parseFloat(item.hargaBeli))}
                          {item.satuanBeli && <span style={{ fontSize: 9, color: "var(--color-os-muted)", marginLeft: 4 }}>/{item.satuanBeli}</span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {item.bahanId ? (
                            inCart ? (
                              <span style={{ fontSize: 10, color: "var(--color-os-green)", fontWeight: 700 }}>✓ In Cart</span>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${item.status === "CRITICAL" ? "color-mix(in srgb, var(--color-os-red) 40%, transparent)" : item.status === "WARNING" ? "color-mix(in srgb, var(--color-os-amber) 40%, transparent)" : "color-mix(in srgb, var(--color-os-green) 40%, transparent)"}`,
                                  background: `${item.status === "CRITICAL" ? "color-mix(in srgb, var(--color-os-red) 10%, transparent)" : item.status === "WARNING" ? "color-mix(in srgb, var(--color-os-amber) 10%, transparent)" : "color-mix(in srgb, var(--color-os-green) 10%, transparent)"}`,
                                  color: item.status === "CRITICAL" ? "var(--color-os-red)" : item.status === "WARNING" ? "var(--color-os-amber)" : "var(--color-os-green)",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                + Rancang PO
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>No master</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {isMobile && (
              <div style={{ textAlign: "center", padding: "8px 0 6px", color: "var(--color-os-muted)", fontSize: 10 }}>— Scroll horizontal —</div>
            )}
          </div>
          )}
          {/* Pagination controls */}
          {totalPages > 1 && (
            isMobile ? (
              <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-os-muted)", flexShrink: 0 }}>
                  {safePage * rowsPerPage + 1}–{Math.min((safePage + 1) * rowsPerPage, filteredItems.length)} dari {filteredItems.length}
                </span>
                <div style={{ display: "flex", gap: 3, overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                    style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage === 0 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>‹</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                    const p = start + i;
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: `1px solid ${p === safePage ? "color-mix(in srgb, var(--color-os-accent) 40%, transparent)" : "var(--color-os-border)"}`, background: p === safePage ? "color-mix(in srgb, var(--color-os-accent) 10%, transparent)" : "transparent", color: p === safePage ? "var(--color-os-accent)" : "var(--color-os-sub)", fontSize: 11, cursor: "pointer", fontWeight: p === safePage ? 700 : 400 }}>
                        {p + 1}
                      </button>
                    );
                  })}
                  {totalPages > 5 && safePage < totalPages - 3 && (
                    <>
                      <span style={{ padding: "4px 4px", color: "var(--color-os-muted)", fontSize: 11 }}>…</span>
                      <button onClick={() => setCurrentPage(totalPages - 1)}
                        style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: "var(--color-os-sub)", fontSize: 11, cursor: "pointer" }}>
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                    style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage >= totalPages - 1 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>›</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>
                  Halaman {safePage + 1} dari {totalPages} ({filteredItems.length} item)
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setCurrentPage(0)} disabled={safePage === 0}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage === 0 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage === 0 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                    const p = start + i;
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${p === safePage ? "color-mix(in srgb, var(--color-os-accent) 40%, transparent)" : "var(--color-os-border)"}`, background: p === safePage ? "color-mix(in srgb, var(--color-os-accent) 10%, transparent)" : "transparent", color: p === safePage ? "var(--color-os-accent)" : "var(--color-os-sub)", fontSize: 11, cursor: "pointer", fontWeight: p === safePage ? 700 : 400 }}>
                        {p + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage >= totalPages - 1 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>Next ›</button>
                  <button onClick={() => setCurrentPage(totalPages - 1)} disabled={safePage >= totalPages - 1}
                    style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border)", background: "transparent", color: safePage >= totalPages - 1 ? "var(--color-os-border)" : "var(--color-os-sub)", fontSize: 11, cursor: safePage >= totalPages - 1 ? "default" : "pointer" }}>»</button>
                </div>
              </div>
            )
          )}
        </div>

        {/* PO Cart — below table */}
        {(cartOpen || poCart.length > 0) && (
          <div
            style={{
              background: "var(--color-os-card)",
              border: "1px solid var(--color-os-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--color-os-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>Keranjang PO</span>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--color-os-accent)",
                  color: `var(--color-os-bg)`,
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
              {/* Outlet + Divisi identification */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 9, color: "var(--color-os-muted)", textTransform: "uppercase", marginBottom: 2, display: "block" }}>Outlet</label>
                  <select
                    value={poOutletId}
                    onChange={(e) => setPoOutletId(e.target.value)}
                    style={{ width: "100%", background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "var(--color-os-text)", outline: "none" }}
                  >
                    {outletList?.map((o) => <option key={o.id} value={o.id}>{o.namaOutlet}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 9, color: "var(--color-os-muted)", textTransform: "uppercase", marginBottom: 2, display: "block" }}>Divisi</label>
                  <input
                    type="text"
                    value={poDivisi}
                    onChange={(e) => setPoDivisi(e.target.value)}
                    placeholder="e.g. waiters, kitchen, bar"
                    style={{ width: "100%", background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "var(--color-os-text)", outline: "none" }}
                  />
                </div>
              </div>
              {poCart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-os-muted)", fontSize: 12 }}>
                  🛒 Tambahkan bahan dari tabel untuk membuat PO
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {poCart.map((item) => (
                  <div
                    key={item.bahanId}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--color-os-border)",
                      borderRadius: 8,
                      background: "var(--color-os-bg)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-os-text)", marginBottom: 3 }}>{item.namaBahan}</div>
                        {item.allVendors.length > 1 ? (
                          <select
                            value={item.vendorId}
                            onChange={(e) => {
                              const sel = item.allVendors.find((v) => v.id === e.target.value);
                              setPoCart((prev) => prev.map((c) => c.bahanId === item.bahanId
                                ? { ...c, vendorId: sel?.id ?? "", vendorNama: sel?.nama ?? "—", kontakWa: sel?.kontakWa ?? null, vendorPlatform: sel?.platform ?? "offline" }
                                : c));
                            }}
                            style={{ width: "100%", background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 5, padding: "3px 6px", fontSize: 10, color: "var(--color-os-text)", outline: "none", marginBottom: 3 }}
                          >
                            {item.allVendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.nama}</option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-os-text)", marginBottom: 2 }}>{item.vendorNama}</div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Badge color={item.tipeBahan === "packaged" ? "blue" : "green"} size="sm">
                            {item.tipeBahan}
                          </Badge>
                          {item.kontakWa && (
                            <>
                              <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>{item.kontakWa}</span>
                              <a
                                href={buildWAUrl(item.kontakWa, waTemplate, userOutletName)}
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
                        style={{ background: "none", border: "none", color: "var(--color-os-red)", cursor: "pointer", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--color-os-bg)", borderRadius: 6, border: "1px solid var(--color-os-border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--color-os-muted)", flexShrink: 0 }}>Harga satuan:</span>
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
                          style={{ flex: 1, background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--color-os-text)", outline: "none" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "var(--color-os-muted)", flexShrink: 0 }}>Qty:</span>
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
                          style={{ width: 70, background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--color-os-text)", outline: "none" }}
                        />
                        {item.hargaSatuan > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-os-accent)", marginLeft: "auto" }}>
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
                const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
                const outletName = outletList?.find((o) => o.id === poOutletId)?.namaOutlet ?? "";
                const userName = (session?.user as any)?.nama ?? session?.user?.name ?? "";

                lines.push("📋 PURCHASE ORDER — OMNI-STOCK");
                lines.push(`📅 ${dateStr}`);
                lines.push("");
                lines.push(`pengajuan ${poDivisi}${poDivisi ? " " : ""}${outletName} ${dateStr}:`);
                lines.push(`Dibuat oleh: ${userName}`);
                lines.push("");

                // Group by vendor platform
                const tunaiItems: POCartItem[] = [];
                const shopeeItems: POCartItem[] = [];
                const tokopediaItems: POCartItem[] = [];
                for (const c of poCart) {
                  const p = (c.vendorPlatform ?? "offline").toLowerCase();
                  if (p === "shopee") shopeeItems.push(c);
                  else if (p === "tokopedia") tokopediaItems.push(c);
                  else tunaiItems.push(c);
                }

                const sections: Array<{ label: string; items: POCartItem[] }> = [];
                if (tunaiItems.length > 0) sections.push({ label: "Tunai", items: tunaiItems });
                if (shopeeItems.length > 0) sections.push({ label: "Shopee", items: shopeeItems });
                if (tokopediaItems.length > 0) sections.push({ label: "Tokopedia", items: tokopediaItems });

                let total = 0;

                for (const section of sections) {
                  lines.push(`${section.label}:`);
                  let sectionSub = 0;
                  let num = 1;

                  if (section.label === "Tunai") {
                    // Sub-group by vendor name
                    const byVendor = new Map<string, POCartItem[]>();
                    for (const c of section.items) {
                      if (!byVendor.has(c.vendorNama)) byVendor.set(c.vendorNama, []);
                      byVendor.get(c.vendorNama)!.push(c);
                    }
                    for (const [vName, items] of byVendor) {
                      const first = items[0];
                      lines.push(`🏪 ${vName}${first.kontakWa ? ` — WA: ${first.kontakWa}` : ""}`);
                      for (const c of items) {
                        const lineTotal = c.qty * c.hargaSatuan;
                        sectionSub += lineTotal;
                        lines.push(`${num}. ${c.namaBahan} — ${c.qty}x @ Rp ${c.hargaSatuan.toLocaleString("id-ID")} = Rp ${lineTotal.toLocaleString("id-ID")}`);
                        num++;
                      }
                    }
                  } else {
                    for (const c of section.items) {
                      const lineTotal = c.qty * c.hargaSatuan;
                      sectionSub += lineTotal;
                      lines.push(`${num}. ${c.namaBahan} — ${c.qty}x @ Rp ${c.hargaSatuan.toLocaleString("id-ID")} = Rp ${lineTotal.toLocaleString("id-ID")}`);
                      num++;
                    }
                  }

                  lines.push(`Subtotal: Rp ${sectionSub.toLocaleString("id-ID")}`);
                  lines.push("");
                  total += sectionSub;
                }

                if (ongkir > 0) {
                  lines.push(`🚚 Ongkir: Rp ${ongkir.toLocaleString("id-ID")}`);
                  total += ongkir;
                }
                lines.push(`✅ Total: Rp ${total.toLocaleString("id-ID")}`);
                return lines.join("\n");
              }
              return (
                <div style={{ padding: 12, borderTop: "1px solid var(--color-os-border)" }}>
                  {/* Totals */}
                  <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--color-os-bg)", borderRadius: 8, border: "1px solid var(--color-os-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>Subtotal ({poCart.length} item)</span>
                      <span style={{ fontSize: 11, color: "var(--color-os-text)", fontWeight: 600 }}>Rp {subtotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--color-os-muted)", flexShrink: 0 }}>Ongkir (Rp)</span>
                      <input
                        type="number"
                        value={ongkir || ""}
                        min={0}
                        placeholder="0"
                        onChange={(e) => setOngkir(parseFloat(e.target.value) || 0)}
                        style={{ width: 120, background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--color-os-text)", outline: "none", textAlign: "right" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--color-os-border)" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>Grand Total</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-os-accent)" }}>Rp {grandTotal.toLocaleString("id-ID")}</span>
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
          background: "var(--color-os-card)",
          border: "1px solid var(--color-os-border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-os-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>PO Logs Terbaru</span>
        </div>
        <div className="table-scroll-wrapper">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-os-surface)" }}>
              {["PO ID", "Tanggal", "Vendor", "Total Item", "Total Biaya", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--color-os-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "left",
                    borderBottom: "1px solid var(--color-os-border)",
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
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
                  Belum ada PO
                </td>
              </tr>
            ) : (
              recentPOs.map((po) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-accent)", fontWeight: 700 }}>
                    {po.id}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>
                    {formatDateTime(po.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>
                    {(po as any).vendor?.namaVendor ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>1</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-red)", fontWeight: 700 }}>
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
                        border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)",
                        background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)",
                        color: "var(--color-os-blue)",
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
                        border: "1px solid var(--color-os-border)",
                        background: "transparent",
                        color: "var(--color-os-sub)",
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
