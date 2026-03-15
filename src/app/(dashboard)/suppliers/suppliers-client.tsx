"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createVendor, updateVendor, deleteVendor, setVendorBahan } from "@/actions/vendor";
import { useRouter } from "next/navigation";

interface BahanOption { id: string; namaBahan: string; }

interface VendorItem {
  id: string; namaVendor: string; kontakWa: string | null;
  noRekening: string | null; estimasiPengiriman: number;
  totalPengeluaran: number; totalBahan: number;
  vendorPlatform?: string | null; linkToko?: string | null;
  vendorBahan?: Array<{ bahanId: string; bahan: { namaBahan: string; satuanDapur: string } | null }>;
}

interface SuppliersClientProps {
  vendors: VendorItem[];
  allBahan: BahanOption[];
  stats: { totalVendor: number; totalBahan: number; vendorDenganWa: number };
}

const emptyForm = { namaVendor: "", kontakWa: "", noRekening: "", estimasiPengiriman: "3", vendorPlatform: "offline", linkToko: "" };

export function SuppliersClient({ vendors, allBahan, stats }: SuppliersClientProps) {
  const router = useRouter();
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<VendorItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedBahan, setSelectedBahan] = useState<Array<{ bahanId: string; namaBahan: string }>>([]);
  const [bahanSearch, setBahanSearch] = useState("");
  const [bahanDropOpen, setBahanDropOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const bahanInputRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setSelectedBahan([]);
    setBahanSearch("");
    setShowModal(true);
  }

  function openEdit(v: VendorItem) {
    setEditTarget(v);
    setForm({
      namaVendor: v.namaVendor,
      kontakWa: v.kontakWa ?? "",
      noRekening: v.noRekening ?? "",
      estimasiPengiriman: String(v.estimasiPengiriman),
      vendorPlatform: v.vendorPlatform ?? "offline",
      linkToko: v.linkToko ?? "",
    });
    setSelectedBahan(
      (v.vendorBahan ?? []).map((vb) => ({ bahanId: vb.bahanId, namaBahan: vb.bahan?.namaBahan ?? vb.bahanId }))
    );
    setBahanSearch("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.namaVendor.trim()) return;
    setSaving(true);
    try {
      let vendorId: string;
      if (editTarget) {
        await updateVendor(editTarget.id, {
          namaVendor: form.namaVendor,
          kontakWa: form.kontakWa || undefined,
          noRekening: form.noRekening || undefined,
          estimasiPengiriman: parseInt(form.estimasiPengiriman),
        });
        vendorId = editTarget.id;
      } else {
        const result = await createVendor({
          namaVendor: form.namaVendor,
          kontakWa: form.kontakWa || undefined,
          noRekening: form.noRekening || undefined,
          estimasiPengiriman: parseInt(form.estimasiPengiriman),
          vendorPlatform: form.vendorPlatform,
          linkToko: form.linkToko || undefined,
        });
        vendorId = result.id;
      }
      await setVendorBahan(vendorId, selectedBahan.map((b) => ({ bahanId: b.bahanId })));
      setShowModal(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteVendor(id);
    setConfirmDelete(null);
    if (selectedVendor?.id === id) setSelectedVendor(null);
    router.refresh();
  }

  const filteredBahanOptions = allBahan.filter(
    (b) => !selectedBahan.find((s) => s.bahanId === b.id) &&
      (!bahanSearch || b.namaBahan.toLowerCase().includes(bahanSearch.toLowerCase()))
  );

  const platformIcon: Record<string, string> = { offline: "🏪", shopee: "🛒", tokopedia: "🟢", whatsapp: "📱", lainnya: "🔗" };

  function renderModal() {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
        <div className="modal-fadein" style={{ width: 500, maxHeight: "90vh", background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", overflow: "hidden" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)", flexShrink: 0 }} />
          <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>
              {editTarget ? `Edit Vendor — ${editTarget.namaVendor}` : "Tambah Vendor"}
            </h2>

            {/* Info fields */}
            {([
              { label: "Nama Vendor *", key: "namaVendor", placeholder: "CV Maju Bersama", type: "text" },
              { label: "Nomor WhatsApp", key: "kontakWa", placeholder: "08123456789", type: "text" },
              { label: "Lead Time (hari) *", key: "estimasiPengiriman", placeholder: "3", type: "number" },
              { label: "Info Rekening / Pembayaran", key: "noRekening", placeholder: "BCA 1234567890 a/n ...", type: "text" },
            ] as Array<{ label: string; key: string; placeholder: string; type: string }>).map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 12 }}>
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

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Platform</label>
              <select value={form.vendorPlatform} onChange={(e) => setForm((f) => ({ ...f, vendorPlatform: e.target.value, linkToko: "" }))}
                style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}>
                <option value="offline">🏪 Toko Fisik / Offline</option>
                <option value="whatsapp">📱 WhatsApp</option>
                <option value="shopee">🛒 Shopee</option>
                <option value="tokopedia">🟢 Tokopedia</option>
                <option value="lainnya">🔗 Lainnya</option>
              </select>
            </div>

            {(form.vendorPlatform === "shopee" || form.vendorPlatform === "tokopedia" || form.vendorPlatform === "lainnya") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Link Toko</label>
                <input type="text" value={form.linkToko} onChange={(e) => setForm((f) => ({ ...f, linkToko: e.target.value }))}
                  placeholder="https://shopee.co.id/namaToko"
                  style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {/* Bahan yang disuplai */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1E1E2E" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 8, textTransform: "uppercase" }}>
                📦 Bahan yang Disuplai ({selectedBahan.length})
              </label>

              {selectedBahan.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {selectedBahan.map((b) => (
                    <div key={b.bahanId} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 6px 3px 10px", background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.25)", borderRadius: 20, fontSize: 11, color: "#C8F135" }}>
                      {b.namaBahan}
                      <button type="button" onClick={() => setSelectedBahan((prev) => prev.filter((x) => x.bahanId !== b.bahanId))}
                        style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={bahanInputRef}
                value={bahanSearch}
                onChange={(e) => {
                  setBahanSearch(e.target.value);
                  setBahanDropOpen(true);
                  const r = bahanInputRef.current?.getBoundingClientRect();
                  if (r) setDropRect(r);
                }}
                onFocus={() => {
                  setBahanDropOpen(true);
                  const r = bahanInputRef.current?.getBoundingClientRect();
                  if (r) setDropRect(r);
                }}
                onBlur={() => setTimeout(() => setBahanDropOpen(false), 150)}
                placeholder="Cari dan pilih bahan..."
                style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 12px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={handleSave} disabled={saving || !form.namaVendor.trim()} className="btn-accent"
                style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8, opacity: !form.namaVendor.trim() ? 0.5 : 1 }}>
                {saving ? "Menyimpan..." : editTarget ? "Simpan Perubahan" : "Simpan Vendor"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedVendor) {
    const v = selectedVendor;
    return (
      <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => setSelectedVendor(null)}
            style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            ← Kembali ke Daftar Vendor
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openEdit(v)} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>
              ✏️ Edit
            </button>
            <button onClick={() => setConfirmDelete(v.id)} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer" }}>
              🗑 Hapus
            </button>
          </div>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: "0 0 20px" }}>{v.namaVendor}</h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>📞 Kontak WA</div>
            <div style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>{v.kontakWa ? `📱 ${v.kontakWa}` : "—"}</div>
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>💳 Info Pembayaran</div>
            <div style={{ fontSize: 12, color: "#E2E8F0" }}>{v.noRekening ?? "—"}</div>
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>⏱ Lead Time</div>
            <Badge color="blue">{v.estimasiPengiriman} hari</Badge>
          </div>
          <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 6 }}>📈 Total Pengeluaran</div>
            <div style={{ fontSize: 13, color: "#C8F135", fontWeight: 700 }}>{formatRupiah(v.totalPengeluaran)}</div>
          </div>
        </div>

        {/* Bahan yang disuplai */}
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>
              📦 Bahan yang Disuplai <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400 }}>({(v.vendorBahan ?? []).length} item)</span>
            </div>
            <button onClick={() => openEdit(v)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.07)", color: "#C8F135", cursor: "pointer" }}>
              + Kelola Bahan
            </button>
          </div>
          {(v.vendorBahan ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "#4B5563" }}>Belum ada bahan. Klik "Kelola Bahan" untuk menambahkan.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(v.vendorBahan ?? []).map((vb) => (
                <div key={vb.bahanId} style={{ padding: "5px 12px", background: "#14142A", border: "1px solid #2D2D44", borderRadius: 20, fontSize: 11, color: "#E2E8F0" }}>
                  {vb.bahan?.namaBahan ?? vb.bahanId}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>Riwayat PO</div>
          <div style={{ fontSize: 12, color: "#4B5563" }}>Belum ada data PO untuk vendor ini.</div>
        </div>

        {showModal && renderModal()}
        {confirmDelete && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
            <div style={{ background: "#13131F", border: "1px solid #2D2D44", borderRadius: 12, padding: 24, width: 360 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>Hapus Vendor?</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>Semua data bahan terkait vendor ini akan ikut terhapus.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={() => handleDelete(confirmDelete)} style={{ padding: "7px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#EF4444", fontSize: 12, cursor: "pointer" }}>Hapus</button>
              </div>
            </div>
          </div>
        )}
        {bahanDropOpen && dropRect && filteredBahanOptions.length > 0 && typeof window !== "undefined" && createPortal(
          <div style={{ position: "fixed", top: dropRect.bottom + 2, left: dropRect.left, width: dropRect.width, background: "#13131F", border: "1px solid #2D2D44", borderRadius: 7, zIndex: 9999, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}>
            {filteredBahanOptions.slice(0, 30).map((b) => (
              <div key={b.id} onMouseDown={() => { setSelectedBahan((prev) => [...prev, { bahanId: b.id, namaBahan: b.namaBahan }]); setBahanSearch(""); }}
                style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#E2E8F0" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                {b.namaBahan}
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Suppliers</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen vendor & pemasok bahan baku</p>
        </div>
        <button onClick={openAdd} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
          + Tambah Vendor
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Vendor" value={stats.totalVendor} icon="🚚" color="#60A5FA" />
        <StatCard label="Total Bahan" value={stats.totalBahan} icon="📦" color="#22C55E" />
        <StatCard label="Vendor dengan WA" value={stats.vendorDenganWa} icon="📱" color="#C8F135" />
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["Nama Vendor", "Platform", "WhatsApp", "Info Pembayaran", "Lead Time", "Bahan Disuplai", "Pengeluaran", "Aksi"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada vendor.</td></tr>
            ) : (
              vendors.map((v) => {
                const platform = v.vendorPlatform ?? "offline";
                const bahanList = v.vendorBahan ?? [];
                return (
                  <tr key={v.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320", cursor: "pointer" }} onClick={() => setSelectedVendor(v)}>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{v.namaVendor}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Badge color={platform === "shopee" ? "amber" : platform === "tokopedia" ? "green" : "gray"} size="sm">
                          {platformIcon[platform] ?? "🔗"} {platform}
                        </Badge>
                        {v.linkToko && (
                          <a href={v.linkToko} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: 10, color: "#60A5FA", textDecoration: "underline" }}>Buka →</a>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: v.kontakWa ? "#22C55E" : "#4B5563" }}>
                      {v.kontakWa ? `📱 ${v.kontakWa}` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{v.noRekening ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">⏱ {v.estimasiPengiriman} hari</Badge></td>
                    <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                      {bahanList.length === 0 ? (
                        <span style={{ fontSize: 10, color: "#374151" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {bahanList.slice(0, 3).map((vb) => (
                            <span key={vb.bahanId} style={{ fontSize: 9, padding: "2px 7px", background: "#14142A", border: "1px solid #2D2D44", borderRadius: 10, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                              {vb.bahan?.namaBahan ?? vb.bahanId}
                            </span>
                          ))}
                          {bahanList.length > 3 && (
                            <span style={{ fontSize: 9, padding: "2px 7px", background: "#14142A", border: "1px solid #2D2D44", borderRadius: 10, color: "#4B5563" }}>
                              +{bahanList.length - 3} lagi
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>{formatRupiah(v.totalPengeluaran)}</td>
                    <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEdit(v)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => setConfirmDelete(v.id)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && renderModal()}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#13131F", border: "1px solid #2D2D44", borderRadius: 12, padding: 24, width: 360 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>Hapus Vendor?</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>Semua data bahan terkait vendor ini akan ikut terhapus.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: "7px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#EF4444", fontSize: 12, cursor: "pointer" }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Bahan dropdown portal */}
      {bahanDropOpen && dropRect && filteredBahanOptions.length > 0 && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", top: dropRect.bottom + 2, left: dropRect.left, width: dropRect.width, background: "#13131F", border: "1px solid #2D2D44", borderRadius: 7, zIndex: 9999, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}>
          {filteredBahanOptions.slice(0, 30).map((b) => (
            <div key={b.id} onMouseDown={() => { setSelectedBahan((prev) => [...prev, { bahanId: b.id, namaBahan: b.namaBahan }]); setBahanSearch(""); }}
              style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#E2E8F0" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {b.namaBahan}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
