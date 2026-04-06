"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/formatters";
import { createBahan, updateBahan, deleteBahan } from "@/actions/bahan";
import { exportToXlsx } from "@/lib/export-xlsx";

interface BahanItem {
  id: string; namaBahan: string; kategoriBahan: string | null;
  outletId: string | null; stokMinimum: number; hargaBeli: string;
  satuanBeli: string; satuanDapur: string; isiSatuan: string;
}

const KATEGORI_TABS = [
  { key: "Barang Habis Pakai",    label: "Barang Habis Pakai",    desc: "Tisu, plastik, sabun, dll" },
  { key: "Peralatan Operasional", label: "Peralatan Operasional", desc: "Peralatan masak, perlengkapan operasional" },
  { key: "Aset Tetap",            label: "Aset Tetap",            desc: "Mesin, perabot, kendaraan" },
  { key: "Bahan Operasional",     label: "Bahan Operasional",     desc: "Gas, minyak goreng curah, dll" },
];

const SATUAN_OPTS = ["pcs", "pack", "box", "gram", "ml", "liter", "kg", "porsi", "gelas", "lembar", "buah", "botol", "karung", "tabung"];

const EMPTY_FORM = (kategori: string) => ({
  namaBahan: "", kategoriBahan: kategori,
  hargaBeli: "", satuanBeli: "pcs", satuanDapur: "pcs",
  stokMinimum: "", isiSatuan: "1", leadTimeDays: "1", outletId: "OUT-001",
});

export function CategoryClient({ bahanList }: { bahanList: BahanItem[] }) {
  const [activeTab, setActiveTab] = useState(KATEGORI_TABS[0].key);
  const [showMutasi, setShowMutasi] = useState(false);
  const [items, setItems] = useState<BahanItem[]>(bahanList);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM(KATEGORI_TABS[0].key));
  const [editTarget, setEditTarget] = useState<BahanItem | null>(null);
  const [editForm, setEditForm] = useState({ namaBahan: "", kategoriBahan: "", hargaBeli: "", satuanBeli: "", satuanDapur: "", stokMinimum: "", isiSatuan: "", leadTimeDays: "1" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = items.filter((b) => b.kategoriBahan === activeTab);

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
        id: result.id, namaBahan: form.namaBahan.trim(), kategoriBahan: form.kategoriBahan,
        outletId: form.outletId, stokMinimum: parseInt(form.stokMinimum) || 0,
        hargaBeli: form.hargaBeli, satuanBeli: form.satuanBeli, satuanDapur: form.satuanDapur, isiSatuan: form.isiSatuan,
      }]);
      setForm(EMPTY_FORM(activeTab));
      setShowAdd(false);
    } finally { setSaving(false); }
  }

  function openEdit(b: BahanItem) {
    setEditTarget(b);
    setEditForm({ namaBahan: b.namaBahan, kategoriBahan: b.kategoriBahan ?? "", hargaBeli: b.hargaBeli,
      satuanBeli: b.satuanBeli, satuanDapur: b.satuanDapur, stokMinimum: String(b.stokMinimum), isiSatuan: b.isiSatuan, leadTimeDays: "1" });
  }

  async function handleUpdate() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateBahan(editTarget.id, {
        namaBahan: editForm.namaBahan, kategoriBahan: editForm.kategoriBahan,
        hargaBeli: parseFloat(editForm.hargaBeli) || 0, satuanBeli: editForm.satuanBeli,
        satuanDapur: editForm.satuanDapur, stokMinimum: parseInt(editForm.stokMinimum) || 0,
        isiSatuan: parseFloat(editForm.isiSatuan) || 1, leadTimeDays: parseInt(editForm.leadTimeDays) || 1,
      });
      setItems((prev) => prev.map((b) => b.id === editTarget.id ? { ...b, ...editForm, stokMinimum: parseInt(editForm.stokMinimum) || 0 } : b));
      setEditTarget(null);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteBahan(id);
      setItems((prev) => prev.filter((b) => b.id !== id));
      setConfirmDelete(null); setEditTarget(null);
    } finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)",
    borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)",
    outline: "none", boxSizing: "border-box",
  };

  const SatuanChips = ({ val, setter }: { val: string; setter: (v: string) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
      {SATUAN_OPTS.map((u) => (
        <button key={u} type="button" onClick={() => setter(u)}
          style={{ padding: "2px 8px", borderRadius: 10,
            border: `1px solid ${val === u ? "color-mix(in srgb, var(--color-os-accent) 50%, transparent)" : "var(--color-os-border2)"}`,
            background: val === u ? "color-mix(in srgb, var(--color-os-accent) 12%, transparent)" : "transparent",
            color: val === u ? "var(--color-os-accent)" : "var(--color-os-sub)", fontSize: 10, cursor: "pointer" }}>
          {u}
        </button>
      ))}
    </div>
  );

  const KategoriSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, cursor: "pointer" }}>
      {KATEGORI_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
    </select>
  );

  const activeTabMeta = KATEGORI_TABS.find((t) => t.key === activeTab);

  const ModalForm = ({ title, f, setF, onSave, onCancel, saveLabel, extraLeft }: {
    title: React.ReactNode; f: typeof form; setF: (fn: (prev: typeof form) => typeof form) => void;
    onSave: () => void; onCancel: () => void; saveLabel: string; extraLeft?: React.ReactNode;
  }) => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="modal-fadein" style={{ width: 480, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ height: 3, background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD), transparent)" }} />
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 20px" }}>{title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Nama *</label>
              <input value={f.namaBahan} onChange={(e) => setF((p) => ({ ...p, namaBahan: e.target.value }))} placeholder="cth: Tisu Meja" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Kategori *</label>
              <KategoriSelect value={f.kategoriBahan} onChange={(v) => setF((p) => ({ ...p, kategoriBahan: v }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Satuan</label>
              <input value={f.satuanBeli} onChange={(e) => setF((p) => ({ ...p, satuanBeli: e.target.value, satuanDapur: e.target.value }))} placeholder="pcs" style={inputStyle} />
              <SatuanChips val={f.satuanBeli} setter={(v) => setF((p) => ({ ...p, satuanBeli: v, satuanDapur: v }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Min. Stok</label>
              <input type="number" value={f.stokMinimum} onChange={(e) => setF((p) => ({ ...p, stokMinimum: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Harga Beli (Rp)</label>
              <input type="number" value={f.hargaBeli} onChange={(e) => setF((p) => ({ ...p, hargaBeli: e.target.value }))} placeholder="50000" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Lead Time (hari)</label>
              <input type="number" value={f.leadTimeDays} onChange={(e) => setF((p) => ({ ...p, leadTimeDays: e.target.value }))} placeholder="1" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
            <div>{extraLeft}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onCancel} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-sub)", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={onSave} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                {saving ? "Menyimpan..." : saveLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Assets & Inventory</h1>
          <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Manajemen barang non-bahan baku per kategori</p>
        </div>
        {!showMutasi && (
          <button onClick={() => { setShowAdd(true); setForm(EMPTY_FORM(activeTab)); }}
            className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
            + Tambah {activeTabMeta?.label ?? "Item"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background: `var(--color-os-row-hover)`, padding: 4, borderRadius: 8, display: "inline-flex", gap: 2, marginBottom: 16, flexWrap: "wrap" }}>
        {KATEGORI_TABS.map((t) => {
          const count = items.filter((b) => b.kategoriBahan === t.key).length;
          const isActive = !showMutasi && activeTab === t.key;
          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setShowMutasi(false); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                fontWeight: isActive ? 700 : 400, background: isActive ? "var(--color-os-surface)" : "transparent",
                color: isActive ? "var(--color-os-text)" : "var(--color-os-muted)", transition: "all 0.15s" }}>
              {t.label}
              {count > 0 && <span style={{ marginLeft: 5, fontSize: 10, color: isActive ? "var(--color-os-accent)" : "var(--color-os-muted)", fontWeight: 700 }}>{count}</span>}
            </button>
          );
        })}
        <button onClick={() => setShowMutasi(true)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
            fontWeight: showMutasi ? 700 : 400, background: showMutasi ? "var(--color-os-surface)" : "transparent",
            color: showMutasi ? "var(--color-os-text)" : "var(--color-os-muted)" }}>
          Mutasi Antar Cabang
        </button>
      </div>

      {/* Mutasi placeholder */}
      {showMutasi && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>↔</div>
          <div style={{ fontSize: 12, color: "var(--color-os-muted)" }}>Belum ada data mutasi antar cabang.</div>
        </div>
      )}

      {/* Table */}
      {!showMutasi && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "8px 16px", background: `var(--color-os-row-hover)`, borderBottom: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-os-accent)" }}>{activeTab}</span>
            <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>— {activeTabMeta?.desc}</span>
            <button
              onClick={() => exportToXlsx(filtered.map(b => ({
                ID: b.id, "Nama Barang": b.namaBahan, Kategori: b.kategoriBahan ?? "",
                Satuan: b.satuanDapur, "Min. Stok": b.stokMinimum, "Harga Beli": parseFloat(b.hargaBeli),
              })), `Kategori_${activeTab.replace(/\s+/g, "_")}`, activeTab)}
              style={{ marginLeft: "auto", fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "var(--color-os-surface)", color: "var(--color-os-sub)", cursor: "pointer", fontWeight: 600 }}
            >↓ Export</button>
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["ID", "Nama Barang", "Outlet", "Satuan", "Min. Stok", "Harga Beli", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama Barang" ? "col-sticky-nama" : h === "ID" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
                  Belum ada data {activeTab}. Klik "+ Tambah {activeTab}" untuk memulai.
                </td></tr>
              ) : (
                filtered.map((b, idx) => (
                  <tr key={b.id + idx} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                    <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-muted)" }}>{b.id}</td>
                    <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>{b.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>{b.satuanDapur ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-muted)" }}>{b.stokMinimum}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)" }}>{formatRupiah(parseFloat(b.hargaBeli) || 0)}</td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(b)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", color: "var(--color-os-blue)", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(b.id)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-red) 8%, transparent)", color: "var(--color-os-red)", cursor: "pointer" }}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal Tambah */}
      {showAdd && (
        <ModalForm
          title="Tambah Item"
          f={form} setF={setForm as any}
          onSave={handleSave} onCancel={() => setShowAdd(false)} saveLabel="Simpan"
        />
      )}

      {/* Modal Edit */}
      {editTarget && (
        <ModalForm
          title={<>Edit — <span style={{ color: "var(--color-os-blue)" }}>{editTarget.id}</span></>}
          f={editForm as any} setF={setEditForm as any}
          onSave={handleUpdate} onCancel={() => setEditTarget(null)} saveLabel="Simpan Perubahan"
          extraLeft={
            <button onClick={() => setConfirmDelete(editTarget.id)}
              style={{ padding: "8px 14px", background: "color-mix(in srgb, var(--color-os-red) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", borderRadius: 7, color: "var(--color-os-red)", fontSize: 12, cursor: "pointer" }}>
              Hapus
            </button>
          }
        />
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="modal-fadein" style={{ width: 340, background: `var(--color-os-card)`, borderRadius: 14, border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-os-red)", margin: "0 0 8px" }}>Hapus Item?</h3>
            <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "0 0 20px" }}>Data tidak bisa dikembalikan setelah dihapus.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-sub)", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={saving}
                style={{ padding: "7px 14px", background: "var(--color-os-red)", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
