"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createBahan, updateBahan, deleteBahan } from "@/actions/bahan";

interface BahanItem {
  id: string; namaBahan: string; kategoriBahan: string | null;
  outletId: string | null; stokMinimum: number; hargaBeli: string;
  satuanBeli: string; satuanDapur: string; isiSatuan: string;
}

const EMPTY_FORM = {
  namaBahan: "", kategoriBahan: "Barang Habis Pakai",
  hargaBeli: "", satuanBeli: "pcs", satuanDapur: "pcs",
  stokMinimum: "", isiSatuan: "1", leadTimeDays: "1", outletId: "OUT-001",
};

const SATUAN_OPTS = ["pcs", "pack", "box", "gram", "ml", "liter", "kg", "porsi", "gelas", "lembar", "buah", "botol", "karung"];

export function CategoryClient({ bahanList }: { bahanList: BahanItem[] }) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<BahanItem[]>(bahanList);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<BahanItem | null>(null);
  const [editForm, setEditForm] = useState({ namaBahan: "", kategoriBahan: "", hargaBeli: "", satuanBeli: "", satuanDapur: "", stokMinimum: "", isiSatuan: "", leadTimeDays: "1" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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
      const result = await createBahan({
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
        id: result.id,
        namaBahan: form.namaBahan.trim(),
        kategoriBahan: form.kategoriBahan,
        outletId: form.outletId,
        stokMinimum: parseInt(form.stokMinimum) || 0,
        hargaBeli: form.hargaBeli,
        satuanBeli: form.satuanBeli,
        satuanDapur: form.satuanDapur,
        isiSatuan: form.isiSatuan,
      }]);
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b: BahanItem) {
    setEditTarget(b);
    setEditForm({
      namaBahan: b.namaBahan,
      kategoriBahan: b.kategoriBahan ?? "",
      hargaBeli: b.hargaBeli,
      satuanBeli: b.satuanBeli,
      satuanDapur: b.satuanDapur,
      stokMinimum: String(b.stokMinimum),
      isiSatuan: b.isiSatuan,
      leadTimeDays: "1",
    });
  }

  async function handleUpdate() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateBahan(editTarget.id, {
        namaBahan: editForm.namaBahan,
        kategoriBahan: editForm.kategoriBahan,
        hargaBeli: parseFloat(editForm.hargaBeli) || 0,
        satuanBeli: editForm.satuanBeli,
        satuanDapur: editForm.satuanDapur,
        stokMinimum: parseInt(editForm.stokMinimum) || 0,
        isiSatuan: parseFloat(editForm.isiSatuan) || 1,
        leadTimeDays: parseInt(editForm.leadTimeDays) || 1,
      });
      setItems((prev) => prev.map((b) => b.id === editTarget.id ? { ...b, ...editForm, stokMinimum: parseInt(editForm.stokMinimum) || 0 } : b));
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteBahan(id);
      setItems((prev) => prev.filter((b) => b.id !== id));
      setConfirmDelete(null);
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0F0F18", border: "1px solid #2D2D44",
    borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0",
    outline: "none", boxSizing: "border-box",
  };

  const satuanChips = (val: string, setter: (v: string) => void) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
      {SATUAN_OPTS.map((u) => (
        <button key={u} type="button" onClick={() => setter(u)}
          style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${val === u ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
            background: val === u ? "rgba(200,241,53,0.12)" : "transparent",
            color: val === u ? "#C8F135" : "#6B7280", fontSize: 10, cursor: "pointer", transition: "all 0.1s" }}>
          {u}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Assets & Inventory</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen barang habis pakai, aset, dan mutasi</p>
        </div>
        {activeTab === 1 && (
          <button onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
            className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
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
                {["ID", "Nama Barang", "Kategori", "Outlet", "Satuan", "Min. Stok", "Harga Beli", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consumables.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada data. Klik "+ Tambah Barang" untuk memulai.</td></tr>
              ) : (
                consumables.map((b, idx) => (
                  <tr key={b.id + idx} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{b.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{b.kategoriBahan ?? "Umum"}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{b.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{b.satuanDapur ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#4B5563" }}>{b.stokMinimum}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{formatRupiah(parseFloat(b.hargaBeli) || 0)}</td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(b)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(b.id)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer" }}>
                        Hapus
                      </button>
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

      {/* Modal Tambah Barang */}
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
                  {satuanChips(form.satuanBeli, (v) => setForm((f) => ({ ...f, satuanBeli: v, satuanDapur: v })))}
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

      {/* Modal Edit Barang */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 460, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #60A5FA, #818CF8, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 4px" }}>Edit Barang — <span style={{ color: "#60A5FA" }}>{editTarget.id}</span></h2>
              <p style={{ fontSize: 11, color: "#4B5563", margin: "0 0 20px" }}>{editTarget.namaBahan}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Barang *</label>
                  <input value={editForm.namaBahan} onChange={(e) => setEditForm((f) => ({ ...f, namaBahan: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori</label>
                  <input value={editForm.kategoriBahan} onChange={(e) => setEditForm((f) => ({ ...f, kategoriBahan: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Satuan</label>
                  <input value={editForm.satuanBeli} onChange={(e) => setEditForm((f) => ({ ...f, satuanBeli: e.target.value, satuanDapur: e.target.value }))} style={inputStyle} />
                  {satuanChips(editForm.satuanBeli, (v) => setEditForm((f) => ({ ...f, satuanBeli: v, satuanDapur: v })))}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Min. Stok *</label>
                  <input type="number" value={editForm.stokMinimum} onChange={(e) => setEditForm((f) => ({ ...f, stokMinimum: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Harga Beli (Rp)</label>
                  <input type="number" value={editForm.hargaBeli} onChange={(e) => setEditForm((f) => ({ ...f, hargaBeli: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Lead Time (hari)</label>
                  <input type="number" value={editForm.leadTimeDays} onChange={(e) => setEditForm((f) => ({ ...f, leadTimeDays: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
                <button onClick={() => setConfirmDelete(editTarget.id)}
                  style={{ padding: "8px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#EF4444", fontSize: 12, cursor: "pointer" }}>
                  Hapus
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditTarget(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                  <button onClick={handleUpdate} disabled={saving}
                    style={{ padding: "8px 16px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.4)", borderRadius: 8, color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="modal-fadein" style={{ width: 340, background: "#13131F", borderRadius: 14, border: "1px solid rgba(239,68,68,0.3)", padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", margin: "0 0 8px" }}>Hapus Barang?</h3>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 20px" }}>Data tidak bisa dikembalikan setelah dihapus.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={saving}
                style={{ padding: "7px 14px", background: "#EF4444", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
