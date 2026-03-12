"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createBahan } from "@/actions/bahan";

interface BahanItem {
  id: string; namaBahan: string; kategoriBahan: string | null;
  outletId: string | null; stokMinimum: number; hargaBeli: string;
}

const EMPTY_FORM = {
  namaBahan: "", kategoriBahan: "Barang Habis Pakai",
  hargaBeli: "", satuanBeli: "pcs", satuanDapur: "pcs",
  stokMinimum: "", isiSatuan: "1", leadTimeDays: "1", outletId: "OUT-001",
};

export function CategoryClient({ bahanList }: { bahanList: BahanItem[] }) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<BahanItem[]>(bahanList);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const tabs = ["Barang Habis Pakai", "Aset Tetap", "Mutasi Antar Cabang"];

  const consumables = items.filter((b) =>
    b.kategoriBahan?.toLowerCase().includes("habis") ||
    b.kategoriBahan?.toLowerCase().includes("consumable") ||
    b.kategoriBahan?.toLowerCase().includes("pakai") ||
    !b.kategoriBahan
  );

  async function handleSave() {
    if (!form.namaBahan.trim()) return;
    setSaving(true);
    try {
      await createBahan({
        outletId: form.outletId,
        namaBahan: form.namaBahan.trim(),
        tipeBahan: "packaged",
        kategoriBahan: form.kategoriBahan,
        hargaBeli: parseFloat(form.hargaBeli) || 0,
        satuanBeli: form.satuanBeli,
        isiSatuan: parseFloat(form.isiSatuan) || 1,
        satuanDapur: form.satuanDapur,
        stokMinimum: parseInt(form.stokMinimum) || 0,
        leadTimeDays: parseInt(form.leadTimeDays) || 1,
      });
      setItems((prev) => [...prev, {
        id: "...",
        namaBahan: form.namaBahan.trim(),
        kategoriBahan: form.kategoriBahan,
        outletId: form.outletId,
        stokMinimum: parseInt(form.stokMinimum) || 0,
        hargaBeli: form.hargaBeli,
      }]);
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0F0F18", border: "1px solid #2D2D44",
    borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Assets & Inventory</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen barang habis pakai, aset, dan mutasi</p>
        </div>
        {activeTab === 1 && (
          <button
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
            className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
          >
            + Tambah Barang
          </button>
        )}
      </div>

      <div style={{ background: "#14142A", padding: 4, borderRadius: 8, display: "inline-flex", gap: 2, marginBottom: 16 }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab((i + 1) as 1 | 2 | 3)}
            style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
              fontWeight: activeTab === i + 1 ? 700 : 400, background: activeTab === i + 1 ? "#1E1E2E" : "transparent",
              color: activeTab === i + 1 ? "#E2E8F0" : "#4B5563", transition: "all 0.15s" }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 1 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID", "Nama Barang", "Kategori", "Outlet", "Min. Stok", "Harga Beli", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consumables.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada data barang habis pakai. Klik "+ Tambah Barang" untuk memulai.</td></tr>
              ) : (
                consumables.map((b, idx) => (
                  <tr key={b.id + idx} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{b.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{b.kategoriBahan ?? "Umum"}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{b.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#4B5563" }}>{b.stokMinimum}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{formatRupiah(parseFloat(b.hargaBeli) || 0)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>✏</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 2 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🏭</div>
          <div style={{ fontSize: 12, color: "#4B5563" }}>Belum ada data aset tetap.</div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>Fitur ini akan tersedia di update berikutnya.</div>
        </div>
      )}

      {activeTab === 3 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>↔</div>
          <div style={{ fontSize: 12, color: "#4B5563" }}>Belum ada data mutasi antar cabang.</div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>Mutasi akan muncul di sini saat ada transfer bahan antar outlet.</div>
        </div>
      )}

      {/* Modal Tambah Barang Habis Pakai */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 460, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Barang Habis Pakai</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Barang *</label>
                  <input value={form.namaBahan} onChange={(e) => setForm((f) => ({ ...f, namaBahan: e.target.value }))} placeholder="cth: Tisu Meja" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori</label>
                  <input value={form.kategoriBahan} onChange={(e) => setForm((f) => ({ ...f, kategoriBahan: e.target.value }))} placeholder="Barang Habis Pakai" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Satuan</label>
                  <input value={form.satuanBeli} onChange={(e) => setForm((f) => ({ ...f, satuanBeli: e.target.value, satuanDapur: e.target.value }))} placeholder="pcs / pack / box" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Min. Stok *</label>
                  <input type="number" value={form.stokMinimum} onChange={(e) => setForm((f) => ({ ...f, stokMinimum: e.target.value }))} placeholder="10" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Harga Beli (Rp)</label>
                  <input type="number" value={form.hargaBeli} onChange={(e) => setForm((f) => ({ ...f, hargaBeli: e.target.value }))} placeholder="50000" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Lead Time (hari)</label>
                  <input type="number" value={form.leadTimeDays} onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))} placeholder="1" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSave} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
