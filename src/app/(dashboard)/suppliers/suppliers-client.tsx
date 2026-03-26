"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/shared/stat-card";
import { Truck, Package, Smartphone } from "lucide-react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createVendor, updateVendor, getVendorPOs } from "@/actions/vendor";
import { useAppContext } from "@/contexts/app-context";

interface VendorItem {
  id: string; namaVendor: string; kontakWa: string | null;
  noRekening: string | null; estimasiPengiriman: number;
  totalPengeluaran: number; totalBahan: number;
  vendorPlatform?: string | null; linkToko?: string | null;
}

type POItem = Awaited<ReturnType<typeof getVendorPOs>>[number];

interface SuppliersClientProps {
  vendors: VendorItem[];
  allBahan?: Array<{ id: string; namaBahan: string }>;
  stats: { totalVendor: number; totalBahan: number; vendorDenganWa: number };
}

const STATUS_COLOR: Record<string, "amber" | "blue" | "green" | "gray"> = {
  draft: "amber", sent: "blue", received: "green",
};

function formatWANumber(wa: string) {
  const clean = wa.replace(/\D/g, "");
  if (clean.startsWith("0")) return "62" + clean.slice(1);
  if (clean.startsWith("62")) return clean;
  return "62" + clean;
}

export function SuppliersClient({ vendors, stats }: SuppliersClientProps) {
  const { isGuest } = useAppContext();
  const router = useRouter();
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [vendorPOs, setVendorPOs] = useState<POItem[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showEditVendor, setShowEditVendor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    namaVendor: "", kontakWa: "", noRekening: "", estimasiPengiriman: "3",
    vendorPlatform: "offline", linkToko: "",
  });

  async function openVendorDetail(v: VendorItem) {
    setSelectedVendor(v);
    setVendorPOs([]);
    setLoadingPOs(true);
    try {
      const pos = await getVendorPOs(v.id);
      setVendorPOs(pos as POItem[]);
    } finally {
      setLoadingPOs(false);
    }
  }
  const [form, setForm] = useState({
    namaVendor: "", kontakWa: "", noRekening: "", estimasiPengiriman: "3",
    vendorPlatform: "offline", linkToko: "",
  });

  async function handleSaveVendor() {
    setSaving(true);
    try {
      await createVendor({
        namaVendor: form.namaVendor,
        kontakWa: form.kontakWa || undefined,
        noRekening: form.noRekening || undefined,
        estimasiPengiriman: parseInt(form.estimasiPengiriman),
        vendorPlatform: form.vendorPlatform,
        linkToko: form.linkToko || undefined,
      });
      setShowAddVendor(false);
      setForm({ namaVendor: "", kontakWa: "", noRekening: "", estimasiPengiriman: "3", vendorPlatform: "offline", linkToko: "" });
    } finally {
      setSaving(false);
    }
  }

  function openEditVendor() {
    if (!selectedVendor) return;
    setEditForm({
      namaVendor: selectedVendor.namaVendor,
      kontakWa: selectedVendor.kontakWa ?? "",
      noRekening: selectedVendor.noRekening ?? "",
      estimasiPengiriman: String(selectedVendor.estimasiPengiriman),
      vendorPlatform: selectedVendor.vendorPlatform ?? "offline",
      linkToko: selectedVendor.linkToko ?? "",
    });
    setShowEditVendor(true);
  }

  async function handleEditVendor() {
    if (!selectedVendor) return;
    setSaving(true);
    try {
      await updateVendor(selectedVendor.id, {
        namaVendor: editForm.namaVendor,
        kontakWa: editForm.kontakWa || undefined,
        noRekening: editForm.noRekening || undefined,
        estimasiPengiriman: parseInt(editForm.estimasiPengiriman),
        vendorPlatform: editForm.vendorPlatform,
        linkToko: editForm.linkToko || undefined,
      });
      setSelectedVendor((v) => v ? {
        ...v,
        namaVendor: editForm.namaVendor,
        kontakWa: editForm.kontakWa || null,
        noRekening: editForm.noRekening || null,
        estimasiPengiriman: parseInt(editForm.estimasiPengiriman),
        vendorPlatform: editForm.vendorPlatform,
        linkToko: editForm.linkToko || null,
      } : v);
      setShowEditVendor(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (selectedVendor) {
    return (
      <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
        <button onClick={() => setSelectedVendor(null)}
          style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          ← Kembali ke Daftar Vendor
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>{selectedVendor.namaVendor}</h1>
          {!isGuest && (
            <button onClick={openEditVendor}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "1px solid #2D2D44", background: "#1E1E2E", color: "#E2E8F0", cursor: "pointer", fontWeight: 600 }}>
              ✏ Edit Vendor
            </button>
          )}
        </div>
        <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>📞 Kontak WA</div>
            {selectedVendor.kontakWa ? (
              <a href={`https://wa.me/${formatWANumber(selectedVendor.kontakWa)}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#22C55E", fontWeight: 600, textDecoration: "none", display: "block" }}>
                📱 {selectedVendor.kontakWa} ↗
              </a>
            ) : (
              <div style={{ fontSize: 13, color: "#4B5563" }}>—</div>
            )}
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>💳 Info Pembayaran</div>
            <div style={{ fontSize: 12, color: "#E2E8F0" }}>{selectedVendor.noRekening ?? "—"}</div>
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>⏱ Lead Time</div>
            <Badge color="blue">{selectedVendor.estimasiPengiriman} hari</Badge>
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>📈 Total Pengeluaran</div>
            <div style={{ fontSize: 13, color: "#C8F135", fontWeight: 700 }}>{formatRupiah(selectedVendor.totalPengeluaran)}</div>
          </div>
        </div>
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1E1E2E", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Riwayat PO</div>
            <div style={{ fontSize: 11, color: "#4B5563" }}>{vendorPOs.length} transaksi</div>
          </div>
          {loadingPOs ? (
            <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Memuat...</div>
          ) : vendorPOs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada PO untuk vendor ini.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#14142A" }}>
                    {["PO ID", "Bahan", "Outlet", "Qty", "Harga Satuan", "Total", "Status", "Tanggal"].map((h) => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorPOs.map((po) => (
                    <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "#60A5FA", fontWeight: 600 }}>{po.id}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#E2E8F0" }}>{po.bahan?.namaBahan ?? "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "#6B7280" }}>{po.outlet?.namaOutlet ?? "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#E2E8F0" }}>{parseFloat(po.qtyOrder)} {po.bahan?.satuanBeli ?? ""}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#E2E8F0" }}>{formatRupiah(parseFloat(po.hargaSatuan))}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>{formatRupiah(parseFloat(po.totalHarga))}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <Badge color={STATUS_COLOR[po.status] ?? "gray"} size="sm">{po.status.toUpperCase()}</Badge>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Edit Vendor */}
        {showEditVendor && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="modal-fadein" style={{ width: 440, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
              <div style={{ padding: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Edit Vendor</h2>
                {[
                  { label: "Nama Vendor *", key: "namaVendor", placeholder: "CV Maju Bersama" },
                  { label: "Nomor WhatsApp", key: "kontakWa", placeholder: "08123456789" },
                  { label: "Lead Time (hari) *", key: "estimasiPengiriman", placeholder: "3", type: "number" },
                  { label: "Info Rekening / Pembayaran", key: "noRekening", placeholder: "BCA 1234567890 a/n ..." },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                    <input
                      type={type ?? "text"}
                      value={(editForm as any)[key]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Platform</label>
                  <select
                    value={editForm.vendorPlatform}
                    onChange={(e) => setEditForm((f) => ({ ...f, vendorPlatform: e.target.value, linkToko: "" }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="offline">🏪 Toko Fisik / Offline</option>
                    <option value="whatsapp">📱 WhatsApp</option>
                    <option value="shopee">🛒 Shopee</option>
                    <option value="tokopedia">🟢 Tokopedia</option>
                    <option value="lainnya">🔗 Lainnya</option>
                  </select>
                </div>
                {(editForm.vendorPlatform === "shopee" || editForm.vendorPlatform === "tokopedia" || editForm.vendorPlatform === "lainnya") && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Link Toko</label>
                    <input
                      type="text"
                      value={editForm.linkToko}
                      onChange={(e) => setEditForm((f) => ({ ...f, linkToko: e.target.value }))}
                      placeholder="https://shopee.co.id/namaToko"
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowEditVendor(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                  <button onClick={handleEditVendor} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Suppliers</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen vendor & pemasok bahan baku</p>
        </div>
        {!isGuest && (
          <button onClick={() => setShowAddVendor(true)} className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
            + Tambah Vendor
          </button>
        )}
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Vendor" value={stats.totalVendor} icon={Truck} color="#60A5FA" />
        <StatCard label="Total Bahan" value={stats.totalBahan} icon={Package} color="#22C55E" />
        <StatCard label="Vendor dengan WA" value={stats.vendorDenganWa} icon={Smartphone} color="#C8F135" />
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["Nama Vendor", "Platform", "WhatsApp", "Info Pembayaran", "Lead Time", "Item", "Pengeluaran", "Aksi"].map((h) => (
                <th key={h} className={h === "Nama Vendor" ? "col-sticky-nama" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada vendor.</td></tr>
            ) : (
              vendors.map((v) => {
                const platformIcon: Record<string, string> = {
                  offline: "🏪", shopee: "🛒", tokopedia: "🟢", whatsapp: "📱", lainnya: "🔗",
                };
                const platform = v.vendorPlatform ?? "offline";
                return (
                <tr key={v.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320", cursor: "pointer" }} onClick={() => openVendorDetail(v)}>
                  <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{v.namaVendor}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Badge color={platform === "shopee" ? "amber" : platform === "tokopedia" ? "green" : "gray"} size="sm">
                        {platformIcon[platform] ?? "🔗"} {platform}
                      </Badge>
                      {v.linkToko && (
                        <a href={v.linkToko} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 10, color: "#60A5FA", textDecoration: "underline" }}>
                          Buka →
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: v.kontakWa ? "#22C55E" : "#4B5563" }}>
                    {v.kontakWa ? `📱 ${v.kontakWa}` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{v.noRekening ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">⏱ {v.estimasiPengiriman} hari</Badge></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{v.totalBahan}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>{formatRupiah(v.totalPengeluaran)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>
                      Detail →
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal Tambah Vendor */}
      {showAddVendor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 440, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Vendor</h2>
              {[
                { label: "Nama Vendor *", key: "namaVendor", placeholder: "CV Maju Bersama" },
                { label: "Nomor WhatsApp", key: "kontakWa", placeholder: "08123456789" },
                { label: "Lead Time (hari) *", key: "estimasiPengiriman", placeholder: "3", type: "number" },
                { label: "Info Rekening / Pembayaran", key: "noRekening", placeholder: "BCA 1234567890 a/n ..." },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                  <input
                    type={type ?? "text"}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Platform</label>
                <select
                  value={form.vendorPlatform}
                  onChange={(e) => setForm((f) => ({ ...f, vendorPlatform: e.target.value, linkToko: "" }))}
                  style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                >
                  <option value="offline">🏪 Toko Fisik / Offline</option>
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="shopee">🛒 Shopee</option>
                  <option value="tokopedia">🟢 Tokopedia</option>
                  <option value="lainnya">🔗 Lainnya</option>
                </select>
              </div>
              {(form.vendorPlatform === "shopee" || form.vendorPlatform === "tokopedia" || form.vendorPlatform === "lainnya") && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Link Toko</label>
                  <input
                    type="text"
                    value={form.linkToko}
                    onChange={(e) => setForm((f) => ({ ...f, linkToko: e.target.value }))}
                    placeholder="https://shopee.co.id/namaToko"
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddVendor(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveVendor} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan Vendor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
