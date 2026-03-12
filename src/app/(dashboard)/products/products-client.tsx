"use client";

import { useState } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createBahan } from "@/actions/bahan";
import { saveBOM, createMenu } from "@/actions/menu";
import { estimateRawBulkYield, type RawBulkEstimationResult } from "@/actions/gemini";

interface BahanItem {
  id: string; namaBahan: string; tipeBahan: "packaged" | "raw_bulk";
  satuanBeli: string; satuanDapur: string; stokMinimum: number;
  hargaBeli: string; isiSatuan: string; hargaPerSatuanPorsi: string | null;
  outletId: string | null;
}
interface MenuItem {
  id: string; namaMenu: string; kategori: "food" | "beverage" | null;
  outletId: string | null; totalCogs: string | null;
  mappingResep?: Array<{ id: string; itemId: string; qty: string; bahan?: { namaBahan: string; satuanDapur: string } }>;
}

interface ProductsClientProps {
  bahanList: BahanItem[];
  menuList: MenuItem[];
  sfgList: Array<{ id: string; namaSemiFinished: string; satuan: string }>;
}

export function ProductsClient({ bahanList, menuList, sfgList }: ProductsClientProps) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [showAddBahan, setShowAddBahan] = useState(false);
  const [showBOMEditor, setShowBOMEditor] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [bomLines, setBomLines] = useState<Array<{ itemType: "bahan_dasar" | "semi_finished"; itemId: string; qty: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [menuForm, setMenuForm] = useState({ namaMenu: "", kategori: "food" as "food" | "beverage", hargaJual: "", outletId: "OUT-001" });
  const [menus, setMenus] = useState<MenuItem[]>(menuList);

  // Add Bahan form state
  const [form, setForm] = useState({
    namaBahan: "", tipeBahan: "packaged" as "packaged" | "raw_bulk",
    kategoriBahan: "", hargaBeli: "", satuanBeli: "1_karung",
    satuanDapur: "gram", stokMinimum: "", isiSatuan: "",
    leadTimeDays: "1", outletId: "OUT-001",
  });
  const [aiEstimation, setAiEstimation] = useState<RawBulkEstimationResult | null>(null);
  const [estimating, setEstimating] = useState(false);

  const tabs = ["1. Master Bahan", "2. Master Resep", "3. Master Menu"];

  async function handleSaveMenu() {
    if (!menuForm.namaMenu.trim()) return;
    setSaving(true);
    try {
      const result = await createMenu({
        namaMenu: menuForm.namaMenu.trim(),
        outletId: menuForm.outletId,
        kategori: menuForm.kategori,
        hargaJual: menuForm.hargaJual ? parseFloat(menuForm.hargaJual) : undefined,
      });
      setMenus((prev) => [...prev, {
        id: result.id, namaMenu: menuForm.namaMenu.trim(),
        kategori: menuForm.kategori, outletId: menuForm.outletId, totalCogs: "0", mappingResep: [],
      }]);
      setMenuForm({ namaMenu: "", kategori: "food", hargaJual: "", outletId: "OUT-001" });
      setShowAddMenu(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEstimateYield() {
    if (!form.namaBahan || !form.isiSatuan) return;
    setEstimating(true);
    setAiEstimation(null);
    try {
      const result = await estimateRawBulkYield(
        form.namaBahan,
        parseFloat(form.isiSatuan) || 0,
        form.satuanDapur || "gram"
      );
      setAiEstimation(result);
    } finally {
      setEstimating(false);
    }
  }

  async function handleSaveBahan() {
    setSaving(true);
    try {
      await createBahan({
        outletId: form.outletId,
        namaBahan: form.namaBahan,
        tipeBahan: form.tipeBahan,
        kategoriBahan: form.kategoriBahan || undefined,
        hargaBeli: parseFloat(form.hargaBeli),
        satuanBeli: form.satuanBeli,
        isiSatuan: parseFloat(form.isiSatuan),
        satuanDapur: form.satuanDapur,
        stokMinimum: parseInt(form.stokMinimum),
        leadTimeDays: parseInt(form.leadTimeDays),
      });
      setShowAddBahan(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBOM() {
    if (!selectedMenu) return;
    setSaving(true);
    try {
      await saveBOM(selectedMenu.id, "menu", bomLines);
      setShowBOMEditor(false);
    } finally {
      setSaving(false);
    }
  }

  const totalCOGS = bomLines.reduce((sum, line) => {
    const bahan = bahanList.find((b) => b.id === line.itemId);
    return sum + line.qty * parseFloat(bahan?.hargaPerSatuanPorsi ?? "0");
  }, 0);

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Products & Recipes</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Master bahan baku, resep, dan menu final</p>
        </div>
        {activeTab === 3 ? (
          <button
            onClick={() => { setShowAddMenu(true); setMenuForm({ namaMenu: "", kategori: "food", hargaJual: "", outletId: "OUT-001" }); }}
            className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
          >
            + Tambah Menu
          </button>
        ) : (
          <button
            onClick={() => { setShowAddBahan(true); setAiEstimation(null); }}
            className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
          >
            + Tambah Bahan
          </button>
        )}
      </div>

      {/* Stat Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Master Bahan Baku" value={bahanList.length} icon="📦" color="#60A5FA" />
        <StatCard label="Bill of Materials" value={menuList.filter((m) => m.mappingResep && m.mappingResep.length > 0).length} icon="📋" color="#F59E0B" />
        <StatCard label="Master Menu Final" value={menuList.length} icon="🍽" color="#C8F135" />
      </div>

      {/* Tab Selector */}
      <div
        style={{
          background: "#14142A",
          padding: 4,
          borderRadius: 8,
          display: "inline-flex",
          gap: 2,
          marginBottom: 16,
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab((i + 1) as 1 | 2 | 3)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: activeTab === i + 1 ? 700 : 400,
              background: activeTab === i + 1 ? "#1E1E2E" : "transparent",
              color: activeTab === i + 1 ? "#E2E8F0" : "#4B5563",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 1 — Master Bahan */}
      {activeTab === 1 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID", "Nama Bahan", "Tipe", "Kemasan Beli", "Satuan Dapur", "Min. Stok", "Harga Beli", "Isi/Yield", "Harga/Porsi", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bahanList.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada bahan. Klik "Tambah Bahan" untuk memulai.</td></tr>
              ) : (
                bahanList.map((b) => (
                  <tr key={b.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{b.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color={b.tipeBahan === "packaged" ? "blue" : "green"} size="sm">{b.tipeBahan}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.satuanBeli}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.satuanDapur}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.stokMinimum}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{formatRupiah(parseFloat(b.hargaBeli))}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.isiSatuan}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>
                      {b.hargaPerSatuanPorsi ? formatRupiah(parseFloat(b.hargaPerSatuanPorsi)) : "—"}
                    </td>
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

      {/* Tab 2 — Master Resep */}
      {activeTab === 2 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID Menu", "Nama Menu", "Outlet", "Komposisi", "Total COGS"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menuList.filter((m) => m.mappingResep && m.mappingResep.length > 0).map((m) => (
                <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{m.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{m.namaMenu}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{m.outletId ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {m.mappingResep?.map((r) => (
                        <span key={r.id} style={{ fontSize: 10, padding: "2px 6px", background: "#14142A", borderRadius: 4, color: "#E2E8F0" }}>
                          {r.bahan?.namaBahan} {r.qty}{r.bahan?.satuanDapur}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>
                    {formatRupiah(parseFloat(m.totalCogs ?? "0"))}
                  </td>
                </tr>
              ))}
              {menuList.filter((m) => m.mappingResep && m.mappingResep.length > 0).length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada resep. Tambahkan dari tab Master Menu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3 — Master Menu */}
      {activeTab === 3 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID Menu", "Nama Menu", "Kategori", "Outlet", "Recipe", "Total COGS", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menus.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada menu. Klik "+ Tambah Menu" untuk memulai.</td></tr>
              ) : (
                menus.map((m) => {
                  const hasRecipe = m.mappingResep && m.mappingResep.length > 0;
                  return (
                    <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{m.id}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{m.namaMenu}</td>
                      <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{m.kategori ?? "—"}</Badge></td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{m.outletId ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {hasRecipe
                          ? <Badge color="green" size="sm">✓ Recipe Built</Badge>
                          : <Badge color="gray" size="sm">No Recipe</Badge>
                        }
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: parseFloat(m.totalCogs ?? "0") > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                        {formatRupiah(parseFloat(m.totalCogs ?? "0"))}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => {
                            setSelectedMenu(m);
                            setBomLines(m.mappingResep?.map((r) => ({ itemType: r.id ? "bahan_dasar" as const : "bahan_dasar" as const, itemId: r.itemId ?? "", qty: parseFloat(r.qty) })) ?? []);
                            setShowBOMEditor(true);
                          }}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}
                        >
                          + Edit Resep
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Bahan */}
      {showAddBahan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 520, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Bahan Baku</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Nama Bahan *", key: "namaBahan", placeholder: "Cth: Stok Makanan - Beras" },
                  { label: "Satuan Dapur", key: "satuanDapur", placeholder: "gram" },
                  { label: "Kemasan Beli", key: "satuanBeli", placeholder: "1_karung" },
                  { label: "Min. Stok *", key: "stokMinimum", placeholder: "5000", type: "number" },
                  { label: "Harga Beli (Rp) *", key: "hargaBeli", placeholder: "610000", type: "number" },
                  { label: "Isi Kemasan (Yield) *", key: "isiSatuan", placeholder: "50000", type: "number" },
                  { label: "Lead Time (hari)", key: "leadTimeDays", placeholder: "1", type: "number" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} style={{ gridColumn: key === "namaBahan" ? "1 / -1" : undefined }}>
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
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Tipe Bahan *</label>
                  <select
                    value={form.tipeBahan}
                    onChange={(e) => setForm((f) => ({ ...f, tipeBahan: e.target.value as any }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="packaged">packaged</option>
                    <option value="raw_bulk">raw_bulk</option>
                  </select>
                </div>
              </div>
              {/* AI Research Panel — raw_bulk only */}
              {form.tipeBahan === "raw_bulk" && (
                <div style={{ marginTop: 16, padding: 16, background: "rgba(200,241,53,0.05)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#C8F135", fontWeight: 700, letterSpacing: 1 }}>✦ AI RESEARCH</span>
                      <span style={{ fontSize: 10, color: "#4B5563" }}>Estimasi Yield Bahan</span>
                    </div>
                    <button
                      onClick={handleEstimateYield}
                      disabled={estimating || !form.namaBahan || !form.isiSatuan}
                      style={{
                        fontSize: 11, padding: "5px 12px",
                        border: "1px solid rgba(200,241,53,0.4)", borderRadius: 6,
                        background: estimating ? "rgba(200,241,53,0.05)" : "rgba(200,241,53,0.1)",
                        color: "#C8F135", cursor: estimating || !form.namaBahan || !form.isiSatuan ? "not-allowed" : "pointer",
                        opacity: !form.namaBahan || !form.isiSatuan ? 0.5 : 1,
                      }}
                    >
                      {estimating ? "⏳ Menghitung..." : "🔍 Hitung Estimasi Yield"}
                    </button>
                  </div>
                  {!aiEstimation && !estimating && (
                    <div style={{ fontSize: 11, color: "#4B5563", textAlign: "center", padding: "8px 0" }}>
                      Isi nama bahan & isi kemasan, lalu klik "Hitung Estimasi Yield"
                    </div>
                  )}
                  {aiEstimation && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "10px 12px", background: "#0F0F18", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Harga Pasar</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#C8F135" }}>{aiEstimation.hargaPasarFormatted}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#0F0F18", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Estimasi Porsi / Kemasan</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>
                          ±{aiEstimation.estimasiPorsiPerKemasan ?? "?"} porsi
                        </div>
                        {aiEstimation.namaMenuContoh && (
                          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{aiEstimation.namaMenuContoh}</div>
                        )}
                      </div>
                      <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, fontStyle: "italic" }}>
                        {aiEstimation.narasi}
                      </div>
                      {aiEstimation.error && (
                        <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#F59E0B" }}>⚠ {aiEstimation.error}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddBahan(false); setAiEstimation(null); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveBahan} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan Bahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Menu */}
      {showAddMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 440, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Menu Final</h2>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Menu *</label>
                  <input
                    value={menuForm.namaMenu}
                    onChange={(e) => setMenuForm((f) => ({ ...f, namaMenu: e.target.value }))}
                    placeholder="cth: Mie Goreng Special"
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori *</label>
                    <select
                      value={menuForm.kategori}
                      onChange={(e) => setMenuForm((f) => ({ ...f, kategori: e.target.value as "food" | "beverage" }))}
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                    >
                      <option value="food">🍽 Food</option>
                      <option value="beverage">🥤 Beverage</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Harga Jual (Rp)</label>
                    <input
                      type="number"
                      value={menuForm.hargaJual}
                      onChange={(e) => setMenuForm((f) => ({ ...f, hargaJual: e.target.value }))}
                      placeholder="25000"
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddMenu(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveMenu} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan Menu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOM Editor Modal */}
      {showBOMEditor && selectedMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 620, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 4px" }}>Edit Resep — {selectedMenu.namaMenu}</h2>
              <p style={{ fontSize: 11, color: "#4B5563", margin: "0 0 20px" }}>Bill of Materials (BOM) multi-level</p>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {bomLines.map((line, idx) => {
                  const bahan = bahanList.find((b) => b.id === line.itemId);
                  const subCogs = bahan ? line.qty * parseFloat(bahan.hargaPerSatuanPorsi ?? "0") : 0;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <select value={line.itemType} onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, itemType: e.target.value as any } : x))}
                        style={{ width: 120, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}>
                        <option value="bahan_dasar">Bahan</option>
                        <option value="semi_finished">Sub-Resep</option>
                      </select>
                      <select value={line.itemId} onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, itemId: e.target.value } : x))}
                        style={{ flex: 1, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}>
                        <option value="">— Pilih Item —</option>
                        {bahanList.map((b) => <option key={b.id} value={b.id}>{b.namaBahan}</option>)}
                      </select>
                      <input type="number" value={line.qty} min={0.001} step={0.001}
                        onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 70, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }} />
                      <span style={{ width: 80, fontSize: 10, color: "#4B5563" }}>{bahan?.satuanDapur ?? ""}</span>
                      <span style={{ width: 90, fontSize: 10, color: "#C8F135" }}>{subCogs > 0 ? `Rp ${subCogs.toFixed(0)}` : "—"}</span>
                      <button onClick={() => setBomLines((l) => l.filter((_, i) => i !== idx))}
                        style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>🗑</button>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setBomLines((l) => [...l, { itemType: "bahan_dasar", itemId: "", qty: 1 }])}
                style={{ marginTop: 8, fontSize: 11, padding: "6px 12px", border: "1px dashed #2D2D44", borderRadius: 6, background: "transparent", color: "#6B7280", cursor: "pointer" }}>
                + Tambah Baris
              </button>
              <div style={{ marginTop: 16, padding: "12px", background: "#0F0F18", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#4B5563" }}>Total COGS Saat Ini</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#C8F135" }}>Rp {totalCOGS.toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <button onClick={() => setShowBOMEditor(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveBOM} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan Multi-Level Resep"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
