"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createOutlet } from "@/actions/outlet";

interface OutletRow {
  id: string;
  namaOutlet: string;
  createdAt?: Date | null;
}

interface MenuProfitRow {
  id: string;
  namaMenu: string;
  totalCogs: string | null;
  hargaJual: string | null;
  terjualBulan: string;
}

interface StoresClientProps {
  outletList: OutletRow[];
  menuProfitList: MenuProfitRow[];
  totalOutlet: number;
}

const MODAL_OVERLAY: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const MODAL_BOX: React.CSSProperties = {
  background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 14,
  padding: 28, width: 420, maxWidth: "90vw",
};

export function StoresClient({ outletList, menuProfitList, totalOutlet }: StoresClientProps) {
  const [activeTab, setActiveTab] = useState<1 | 2>(1);
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [namaOutlet, setNamaOutlet] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [detailOutlet, setDetailOutlet] = useState<OutletRow | null>(null);
  const [outlets, setOutlets] = useState<OutletRow[]>(outletList);

  const tabs = ["Upload Compliance per Outlet", "Menu Profitability Matrix"];

  const maxKontribusi = Math.max(
    ...menuProfitList.map((m) => {
      const cogs = parseFloat(m.totalCogs ?? "0");
      const jual = parseFloat(m.hargaJual ?? "0");
      const qty = parseInt(m.terjualBulan ?? "0");
      return qty * Math.max(jual - cogs, 0);
    }),
    1
  );

  async function handleAddOutlet() {
    if (!namaOutlet.trim()) { setAddError("Nama outlet wajib diisi."); return; }
    setSaving(true);
    setAddError("");
    try {
      const result = await createOutlet({ namaOutlet: namaOutlet.trim() });
      setOutlets((prev) => [...prev, { id: result.id, namaOutlet: namaOutlet.trim() }]);
      setNamaOutlet("");
      setShowAddOutlet(false);
    } catch {
      setAddError("Gagal menyimpan outlet.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "var(--color-os-bg)",
    border: "1px solid var(--color-os-border)", borderRadius: 8, color: "var(--color-os-text)",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      {/* Header row with tabs + Tambah Outlet */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ background: `var(--color-os-row-hover)`, padding: 4, borderRadius: 8, display: "inline-flex", gap: 2 }}>
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab((i + 1) as 1 | 2)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                fontWeight: activeTab === i + 1 ? 700 : 400,
                background: activeTab === i + 1 ? "var(--color-os-surface)" : "transparent",
                color: activeTab === i + 1 ? "var(--color-os-text)" : "var(--color-os-muted)",
                transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === 1 && (
          <button
            onClick={() => { setShowAddOutlet(true); setNamaOutlet(""); setAddError(""); }}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))",
              color: "var(--color-os-bg)", fontSize: 12, fontWeight: 700,
            }}
          >
            + Tambah Outlet
          </button>
        )}
      </div>

      {/* Tab 1 — Upload Compliance per Outlet */}
      {activeTab === 1 && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="table-scroll-wrapper">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["Outlet ID", "Nama Outlet", "Upload Compliance", "Inventory Net Worth", "Critical", "Warning", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outlets.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada outlet terdaftar.</td></tr>
              ) : (
                outlets.map((o) => (
                  <tr key={o.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--color-os-muted)" }}>{o.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{o.namaOutlet}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 4, background: `var(--color-os-border)`, borderRadius: 2 }}>
                          <div style={{ width: "0%", height: "100%", background: "var(--color-os-red)", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-os-red)" }}>0%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-text)", fontWeight: 600 }}>Rp 0</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="red" size="sm">0</Badge></td>
                    <td style={{ padding: "10px 14px" }}><Badge color="amber" size="sm">0</Badge></td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => setDetailOutlet(o)}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", color: "var(--color-os-blue)", cursor: "pointer" }}
                      >
                        Detail
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

      {/* Tab 2 — Menu Profitability Matrix */}
      {activeTab === 2 && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="table-scroll-wrapper">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["Nama Menu", "COGS", "Harga Jual", "Margin", "Terjual/Bulan", "Kontribusi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menuProfitList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
                    Belum ada data menu. Tambah menu di halaman Products & Recipes.
                  </td>
                </tr>
              ) : (
                menuProfitList.map((m) => {
                  const cogs = parseFloat(m.totalCogs ?? "0");
                  const jual = parseFloat(m.hargaJual ?? "0");
                  const qty = parseInt(m.terjualBulan ?? "0");
                  const margin = jual > 0 ? Math.round(((jual - cogs) / jual) * 100) : 0;
                  const kontribusi = qty * Math.max(jual - cogs, 0);
                  const kontribusiPct = (kontribusi / maxKontribusi) * 100;
                  const marginColor = margin >= 65 ? "var(--color-os-green)" : "var(--color-os-amber)";

                  return (
                    <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{m.namaMenu}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>
                        {cogs > 0 ? formatRupiah(cogs) : <span style={{ color: "var(--color-os-muted)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "var(--color-os-text)" }}>
                        {jual > 0 ? formatRupiah(jual) : <span style={{ color: "var(--color-os-muted)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {jual > 0 ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${marginColor}1A`, border: `1px solid ${marginColor}4D`, color: marginColor }}>
                            {margin}%
                          </span>
                        ) : <span style={{ color: "var(--color-os-muted)", fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>
                        {qty > 0 ? `${qty} porsi` : <span style={{ color: "var(--color-os-muted)" }}>0 porsi</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 4, background: `var(--color-os-border)`, borderRadius: 2, flexShrink: 0 }}>
                            <div style={{ width: `${kontribusiPct}%`, height: "100%", background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD))", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: "var(--color-os-accent)", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {kontribusi >= 1_000_000
                              ? `${(kontribusi / 1_000_000).toFixed(1)}jt`
                              : kontribusi >= 1000
                              ? `${Math.round(kontribusi / 1000)}k`
                              : kontribusi > 0 ? formatRupiah(kontribusi) : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal — Tambah Outlet */}
      {showAddOutlet && (
        <div style={MODAL_OVERLAY} onClick={() => setShowAddOutlet(false)}>
          <div style={MODAL_BOX} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "var(--color-os-text)" }}>Tambah Outlet</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "var(--color-os-sub)", fontWeight: 600, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Nama Outlet *
              </label>
              <input
                value={namaOutlet}
                onChange={(e) => setNamaOutlet(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddOutlet(); }}
                placeholder="cth: Back To Mie Kitchen"
                style={inputStyle}
                autoFocus
              />
            </div>

            {addError && (
              <p style={{ fontSize: 12, color: "var(--color-os-red)", margin: "0 0 12px" }}>{addError}</p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAddOutlet(false)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--color-os-border)", background: "transparent", color: "var(--color-os-sub)", fontSize: 13, cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                onClick={handleAddOutlet}
                disabled={saving}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))", color: "var(--color-os-bg)", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Detail Outlet */}
      {detailOutlet && (
        <div style={MODAL_OVERLAY} onClick={() => setDetailOutlet(null)}>
          <div style={MODAL_BOX} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-os-text)" }}>Detail Outlet</h3>
              <button
                onClick={() => setDetailOutlet(null)}
                style={{ background: "none", border: "none", color: "var(--color-os-sub)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Outlet ID</div>
                <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--color-os-blue)", fontWeight: 700 }}>{detailOutlet.id}</div>
              </div>
              <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Nama Outlet</div>
                <div style={{ fontSize: 14, color: "var(--color-os-text)", fontWeight: 600 }}>{detailOutlet.namaOutlet}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>Upload</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-os-blue)" }}>—</div>
                </div>
                <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>Critical</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-os-red)" }}>—</div>
                </div>
                <div style={{ background: "var(--color-os-bg)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>Warning</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-os-amber)" }}>—</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-os-muted)", textAlign: "center" }}>
                Data stok tersedia setelah upload Kartu Stok untuk outlet ini.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setDetailOutlet(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--color-os-border)", background: "transparent", color: "var(--color-os-sub)", fontSize: 13, cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
