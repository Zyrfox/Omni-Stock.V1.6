"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useAppContext } from "@/contexts/app-context";
import { getCalculatorData, saveMenuCostComponents } from "@/actions/calculator";
import { formatRupiah } from "@/lib/formatters";
import { exportToXlsx } from "@/lib/export-xlsx";
import { StatCard } from "@/components/shared/stat-card";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import {
  DollarSign,
  Percent,
  Tag,
  TrendingUp,
  Plus,
  Trash2,
  Save,
  Download,
  Search,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Types ──────────────────────────────────────────────── */
interface MenuItem {
  id: string;
  namaMenu: string;
  kategori: string | null;
  totalCogs: string | null;
  hargaJual: string | null;
  channelType: string | null;
  platformFeePercent: string | null;
}

interface MaterialRow {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

interface LaborRow {
  name: string;
  qty: number;
  unit: string;
  rate: number;
}

interface EquipmentRow {
  name: string;
  usageCount: number;
  price: number;
}

interface OtherRow {
  name: string;
  qty: number;
  unitCost: number;
}

/* ── Component ──────────────────────────────────────────── */
export function CalculatorClient({ menuList }: { menuList: MenuItem[] }) {
  const { userRole } = useAppContext();
  const [isPending, startTransition] = useTransition();

  // Mode: "menu" | "new"
  const [mode, setMode] = useState<"menu" | "new">("menu");
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [newProductName, setNewProductName] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Cost tables
  const [materialCosts, setMaterialCosts] = useState<MaterialRow[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborRow[]>([]);
  const [equipmentCosts, setEquipmentCosts] = useState<EquipmentRow[]>([]);
  const [otherCosts, setOtherCosts] = useState<OtherRow[]>([]);

  // Price inputs
  const [marginTarget, setMarginTarget] = useState(50);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);

  // What-if
  const [wf1, setWf1] = useState<number>(0);
  const [wf2, setWf2] = useState<number>(0);
  const [wf3, setWf3] = useState<number>(0);
  const [wf4, setWf4] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Access guard
  if (!["admin", "manager"].includes(userRole)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-os-sub)" }}>
        Akses ditolak — hanya Admin & Manager.
      </div>
    );
  }

  /* ── Load menu data ──────────────────────────────────── */
  async function handleSelectMenu(menuId: string) {
    setSelectedMenuId(menuId);
    const m = menuList.find((x) => x.id === menuId);
    if (m) setMenuSearch(m.namaMenu);
    setShowDropdown(false);
    setLoadingMenu(true);
    try {
      const data = await getCalculatorData(menuId);
      if (!data) return;
      setMaterialCosts(data.materialCosts);
      // Parse saved components
      const labor: LaborRow[] = [];
      const equip: EquipmentRow[] = [];
      const other: OtherRow[] = [];
      for (const c of data.components) {
        if (c.type === "labor") {
          labor.push({ name: c.name, qty: parseFloat(c.qty), unit: c.unit || "hari", rate: parseFloat(c.rate) });
        } else if (c.type === "equipment") {
          equip.push({ name: c.name, usageCount: parseFloat(c.divisor || "1"), price: parseFloat(c.rate) });
        } else {
          other.push({ name: c.name, qty: parseFloat(c.qty), unitCost: parseFloat(c.rate) });
        }
      }
      setLaborCosts(labor);
      setEquipmentCosts(equip);
      setOtherCosts(other);
    } finally {
      setLoadingMenu(false);
    }
  }

  /* ── Calculations ────────────────────────────────────── */
  const totalBahan = useMemo(() => materialCosts.reduce((s, r) => s + r.qty * r.unitCost, 0), [materialCosts]);
  const totalLabor = useMemo(() => laborCosts.reduce((s, r) => s + r.qty * r.rate, 0), [laborCosts]);
  const totalEquipment = useMemo(() => equipmentCosts.reduce((s, r) => s + (r.usageCount > 0 ? r.price / r.usageCount : 0), 0), [equipmentCosts]);
  const totalOther = useMemo(() => otherCosts.reduce((s, r) => s + r.qty * r.unitCost, 0), [otherCosts]);

  const biayaProduk = totalBahan + totalLabor + totalEquipment + totalOther;
  const laba = marginTarget < 100 ? biayaProduk * marginTarget / (100 - marginTarget) : 0;
  const hargaBersihAwal = biayaProduk + laba;
  const diskon = hargaBersihAwal * discountPercent / 100;
  const hargaBersih = hargaBersihAwal - diskon;
  const pajak = hargaBersih * taxPercent / 100;
  const hargaAkhir = hargaBersih + pajak;
  const profitPerUnit = hargaAkhir > 0 ? hargaAkhir - biayaProduk : 0;

  /* ── Filtered menu list ──────────────────────────────── */
  const filteredMenus = useMemo(() => {
    if (!menuSearch.trim()) return menuList;
    const q = menuSearch.toLowerCase();
    return menuList.filter((m) => m.namaMenu.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [menuList, menuSearch]);

  /* ── Chart data ──────────────────────────────────────── */
  const priceBreakdown = useMemo(() => [
    { name: "Bahan", value: totalBahan },
    { name: "Tenaga Kerja", value: totalLabor },
    { name: "Peralatan", value: totalEquipment },
    { name: "Lain-Lain", value: totalOther },
    { name: "Laba", value: Math.max(laba, 0) },
  ].filter((d) => d.value > 0), [totalBahan, totalLabor, totalEquipment, totalOther, laba]);

  const costBreakdown = useMemo(() => [
    { name: "Bahan", value: totalBahan },
    { name: "Tenaga Kerja", value: totalLabor },
    { name: "Peralatan", value: totalEquipment },
    { name: "Lain-Lain", value: totalOther },
  ].filter((d) => d.value > 0), [totalBahan, totalLabor, totalEquipment, totalOther]);

  const ingredientChart = useMemo(() =>
    materialCosts.map((m) => ({ name: m.name.length > 16 ? m.name.slice(0, 16) + "…" : m.name, biaya: m.qty * m.unitCost }))
  , [materialCosts]);

  /* ── What-if results ─────────────────────────────────── */
  const wf1Profit = wf1 > 0 ? wf1 - biayaProduk : 0;
  const wf1Margin = wf1 > 0 ? (wf1Profit / wf1) * 100 : 0;
  const wf2Units = profitPerUnit > 0 && wf2 > 0 ? Math.ceil(wf2 / profitPerUnit) : 0;
  const wf3NewBiaya = Math.max(biayaProduk - wf3, 0);
  const wf3NewProfit = hargaAkhir - wf3NewBiaya;
  const wf3NewMargin = hargaAkhir > 0 ? (wf3NewProfit / hargaAkhir) * 100 : 0;
  const wf4Price = wf4 > 0 && wf4 < 100 ? biayaProduk / (1 - wf4 / 100) : 0;

  /* ── Save handler ────────────────────────────────────── */
  async function handleSave() {
    if (!selectedMenuId || mode === "new") return;
    setSaving(true);
    try {
      const items = [
        ...laborCosts.map((r) => ({ type: "labor" as const, name: r.name, qty: r.qty, unit: r.unit, rate: r.rate, divisor: 1 })),
        ...equipmentCosts.map((r) => ({ type: "equipment" as const, name: r.name, qty: 1, unit: "pcs", rate: r.price, divisor: r.usageCount })),
        ...otherCosts.map((r) => ({ type: "other" as const, name: r.name, qty: r.qty, unit: "pcs", rate: r.unitCost, divisor: 1 })),
      ];
      await saveMenuCostComponents(selectedMenuId, items);
    } finally {
      setSaving(false);
    }
  }

  /* ── Export ───────────────────────────────────────────── */
  function handleExport() {
    const rows: Record<string, unknown>[] = [];
    rows.push({ Kategori: "RINGKASAN", Item: "Total Biaya Bahan", Nilai: totalBahan });
    rows.push({ Kategori: "RINGKASAN", Item: "Total Tenaga Kerja", Nilai: totalLabor });
    rows.push({ Kategori: "RINGKASAN", Item: "Total Peralatan", Nilai: totalEquipment });
    rows.push({ Kategori: "RINGKASAN", Item: "Total Lain-Lain", Nilai: totalOther });
    rows.push({ Kategori: "RINGKASAN", Item: "Biaya Produksi", Nilai: biayaProduk });
    rows.push({ Kategori: "RINGKASAN", Item: "Laba", Nilai: laba });
    rows.push({ Kategori: "RINGKASAN", Item: "Harga Akhir", Nilai: hargaAkhir });
    rows.push({ Kategori: "", Item: "", Nilai: "" });
    materialCosts.forEach((m) => rows.push({ Kategori: "BAHAN", Item: m.name, Jumlah: m.qty, Satuan: m.unit, "Harga/Unit": m.unitCost, Total: m.qty * m.unitCost }));
    laborCosts.forEach((m) => rows.push({ Kategori: "TENAGA KERJA", Item: m.name, Jumlah: m.qty, Satuan: m.unit, "Harga/Unit": m.rate, Total: m.qty * m.rate }));
    equipmentCosts.forEach((m) => rows.push({ Kategori: "PERALATAN", Item: m.name, Jumlah: m.usageCount, Satuan: "pemakaian", "Harga/Unit": m.price, Total: m.usageCount > 0 ? m.price / m.usageCount : 0 }));
    otherCosts.forEach((m) => rows.push({ Kategori: "LAIN-LAIN", Item: m.name, Jumlah: m.qty, Satuan: "pcs", "Harga/Unit": m.unitCost, Total: m.qty * m.unitCost }));
    const title = mode === "menu" ? (menuList.find((m) => m.id === selectedMenuId)?.namaMenu ?? "HPP") : (newProductName || "Produk_Baru");
    exportToXlsx(rows, `Kalkulator_HPP_${title}`);
  }

  /* ── Shared styles ───────────────────────────────────── */
  const cardStyle: React.CSSProperties = {
    background: "var(--color-os-card)",
    border: "1px solid var(--color-os-border)",
    borderRadius: 12,
    padding: 20,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--color-os-surface)",
    border: "1px solid var(--color-os-border2)",
    borderRadius: 7,
    padding: "7px 10px",
    fontSize: 12,
    color: "var(--color-os-text)",
    outline: "none",
    boxSizing: "border-box",
  };
  const thStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: "var(--color-os-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    padding: "8px 10px",
    textAlign: "left",
    borderBottom: "1px solid var(--color-os-border)",
  };
  const tdStyle: React.CSSProperties = {
    fontSize: 12,
    padding: "6px 10px",
    borderBottom: "1px solid var(--color-os-border)",
    color: "var(--color-os-text)",
  };
  const smallBtnStyle: React.CSSProperties = {
    fontSize: 10,
    padding: "4px 8px",
    borderRadius: 5,
    border: "1px solid var(--color-os-border2)",
    background: "var(--color-os-surface)",
    color: "var(--color-os-sub)",
    cursor: "pointer",
  };

  /* ── Helper: editable input in table ─────────────────── */
  function numInput(value: number, onChange: (v: number) => void, w = 80) {
    return (
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...inputStyle, width: w, textAlign: "right" }}
      />
    );
  }

  function textInput(value: string, onChange: (v: string) => void, w = 140) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: w }}
      />
    );
  }

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>
            Kalkulator HPP
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>
            Hitung biaya produksi, harga jual, & margin per produk
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExport} style={{ ...smallBtnStyle, display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={12} /> Export
          </button>
          {mode === "menu" && selectedMenuId && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontSize: 11,
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))",
                color: "var(--color-os-bg)",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Save size={13} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          )}
        </div>
      </div>

      {/* Mode Toggle + Selector */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
          {(["menu", "new"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setMaterialCosts(m === "new" ? [] : materialCosts);
                if (m === "new") {
                  setSelectedMenuId("");
                  setMenuSearch("");
                  setLaborCosts([]);
                  setEquipmentCosts([]);
                  setOtherCosts([]);
                }
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 12,
                fontWeight: mode === m ? 700 : 400,
                color: mode === m ? "var(--color-os-bg)" : "var(--color-os-sub)",
                background: mode === m ? "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))" : "var(--color-os-surface)",
                border: mode === m ? "none" : "1px solid var(--color-os-border2)",
                borderRadius: m === "menu" ? "7px 0 0 7px" : "0 7px 7px 0",
                cursor: "pointer",
              }}
            >
              {m === "menu" ? "Dari Menu" : "Produk Baru"}
            </button>
          ))}
        </div>

        {mode === "menu" ? (
          <div style={{ position: "relative" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "var(--color-os-muted)" }} />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => { setMenuSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Cari menu..."
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
            {showDropdown && filteredMenus.length > 0 && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--color-os-bg)",
                border: "1px solid var(--color-os-border2)",
                borderRadius: 8,
                maxHeight: 220,
                overflowY: "auto",
                zIndex: 20,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}>
                {filteredMenus.slice(0, 30).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMenu(m.id)}
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      color: m.id === selectedMenuId ? "var(--color-os-accent)" : "var(--color-os-text)",
                      background: m.id === selectedMenuId ? "color-mix(in srgb, var(--color-os-accent) 8%, transparent)" : "transparent",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--color-os-border)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{m.namaMenu}</span>
                    <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>{m.id}</span>
                  </div>
                ))}
              </div>
            )}
            {loadingMenu && (
              <div style={{ fontSize: 11, color: "var(--color-os-muted)", marginTop: 8 }}>Memuat data...</div>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            placeholder="Nama produk baru"
            style={inputStyle}
          />
        )}
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Biaya Produksi" value={formatRupiah(biayaProduk)} icon={DollarSign} color="var(--color-os-blue)" />
        <StatCard label="Target Margin" value={`${marginTarget}%`} icon={Percent} color="var(--color-os-accent)" sub="ubah di rincian harga" />
        <StatCard label="Harga Akhir" value={formatRupiah(hargaAkhir)} icon={Tag} color="var(--color-os-green)" />
        <StatCard label="Profit / Unit" value={formatRupiah(profitPerUnit)} icon={TrendingUp} color={profitPerUnit > 0 ? "var(--color-os-green)" : "var(--color-os-red)"} />
      </div>

      {/* Rincian Harga */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 14px" }}>Rincian Harga</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
          {/* Left — inputs */}
          <div style={{ display: "grid", gap: 10 }}>
            <Label label="Target Margin (%)" />
            <input type="number" value={marginTarget} onChange={(e) => setMarginTarget(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 120 }} />
            <Label label="Diskon (%)" />
            <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 120 }} />
            <Label label="Pajak Penjualan (%)" />
            <input type="number" value={taxPercent} onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 120 }} />
          </div>
          {/* Right — cascade */}
          <div style={{ background: "var(--color-os-surface)", borderRadius: 8, padding: 14 }}>
            <CascadeRow label="Bahan" value={totalBahan} />
            <CascadeRow label="Tenaga Kerja" value={totalLabor} />
            <CascadeRow label="Peralatan" value={totalEquipment} />
            <CascadeRow label="Lain-Lain" value={totalOther} />
            <div style={{ height: 1, background: "var(--color-os-border2)", margin: "8px 0" }} />
            <CascadeRow label="BIAYA PRODUK" value={biayaProduk} bold accent />
            <CascadeRow label="Laba" value={laba} color="var(--color-os-green)" />
            <CascadeRow label="Harga Bersih Awal" value={hargaBersihAwal} />
            {discountPercent > 0 && <CascadeRow label={`Diskon (${discountPercent}%)`} value={-diskon} color="var(--color-os-red)" />}
            <CascadeRow label="Harga Bersih" value={hargaBersih} />
            {taxPercent > 0 && <CascadeRow label={`Pajak (${taxPercent}%)`} value={pajak} color="var(--color-os-amber)" />}
            <div style={{ height: 1, background: "var(--color-os-border2)", margin: "8px 0" }} />
            <CascadeRow label="HARGA AKHIR" value={hargaAkhir} bold accent large />
          </div>
        </div>
      </div>

      {/* Cost Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
        {/* Bahan Baku */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: 0 }}>
              Biaya Bahan Baku
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-os-muted)", marginLeft: 8 }}>
                {formatRupiah(totalBahan)}
              </span>
            </h3>
            {mode === "new" && (
              <button onClick={() => setMaterialCosts([...materialCosts, { name: "", qty: 0, unit: "gram", unitCost: 0, totalCost: 0 }])} style={{ ...smallBtnStyle, display: "flex", alignItems: "center", gap: 3 }}>
                <Plus size={11} /> Tambah
              </button>
            )}
          </div>
          {materialCosts.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Bahan</th>
                    <th style={thStyle}>Jumlah</th>
                    <th style={thStyle}>Satuan</th>
                    <th style={thStyle}>Harga/Unit</th>
                    <th style={thStyle}>Total</th>
                    {mode === "new" && <th style={thStyle}></th>}
                  </tr>
                </thead>
                <tbody>
                  {materialCosts.map((row, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>
                        {mode === "new"
                          ? textInput(row.name, (v) => { const c = [...materialCosts]; c[i] = { ...c[i], name: v }; setMaterialCosts(c); })
                          : row.name}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {mode === "new"
                          ? numInput(row.qty, (v) => { const c = [...materialCosts]; c[i] = { ...c[i], qty: v }; setMaterialCosts(c); })
                          : row.qty.toLocaleString("id-ID")}
                      </td>
                      <td style={tdStyle}>
                        {mode === "new"
                          ? textInput(row.unit, (v) => { const c = [...materialCosts]; c[i] = { ...c[i], unit: v }; setMaterialCosts(c); }, 80)
                          : row.unit}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {mode === "new"
                          ? numInput(row.unitCost, (v) => { const c = [...materialCosts]; c[i] = { ...c[i], unitCost: v }; setMaterialCosts(c); })
                          : formatRupiah(row.unitCost)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        {formatRupiah(row.qty * row.unitCost)}
                      </td>
                      {mode === "new" && (
                        <td style={tdStyle}>
                          <button onClick={() => setMaterialCosts(materialCosts.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--color-os-red)", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text={mode === "menu" ? "Pilih menu untuk melihat bahan" : "Tambah bahan secara manual"} />
          )}
        </div>

        {/* Tenaga Kerja */}
        <CostTable
          title="Biaya Tenaga Kerja"
          total={totalLabor}
          headers={["Operasi", "Durasi/Qty", "Waktu", "Tarif", "Total"]}
          rows={laborCosts}
          onAdd={() => setLaborCosts([...laborCosts, { name: "", qty: 1, unit: "hari", rate: 0 }])}
          onRemove={(i) => setLaborCosts(laborCosts.filter((_, j) => j !== i))}
          renderRow={(row, i) => (
            <tr key={i}>
              <td style={tdStyle}>{textInput(row.name, (v) => { const c = [...laborCosts]; c[i] = { ...c[i], name: v }; setLaborCosts(c); })}</td>
              <td style={tdStyle}>{numInput(row.qty, (v) => { const c = [...laborCosts]; c[i] = { ...c[i], qty: v }; setLaborCosts(c); })}</td>
              <td style={tdStyle}>{textInput(row.unit, (v) => { const c = [...laborCosts]; c[i] = { ...c[i], unit: v }; setLaborCosts(c); }, 80)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{numInput(row.rate, (v) => { const c = [...laborCosts]; c[i] = { ...c[i], rate: v }; setLaborCosts(c); })}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatRupiah(row.qty * row.rate)}</td>
            </tr>
          )}
        />

        {/* Peralatan */}
        <CostTable
          title="Biaya Peralatan"
          total={totalEquipment}
          headers={["Peralatan", "Pemakaian", "Harga Barang", "Total"]}
          rows={equipmentCosts}
          onAdd={() => setEquipmentCosts([...equipmentCosts, { name: "", usageCount: 1, price: 0 }])}
          onRemove={(i) => setEquipmentCosts(equipmentCosts.filter((_, j) => j !== i))}
          renderRow={(row, i) => (
            <tr key={i}>
              <td style={tdStyle}>{textInput(row.name, (v) => { const c = [...equipmentCosts]; c[i] = { ...c[i], name: v }; setEquipmentCosts(c); })}</td>
              <td style={tdStyle}>{numInput(row.usageCount, (v) => { const c = [...equipmentCosts]; c[i] = { ...c[i], usageCount: v }; setEquipmentCosts(c); })}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{numInput(row.price, (v) => { const c = [...equipmentCosts]; c[i] = { ...c[i], price: v }; setEquipmentCosts(c); })}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatRupiah(row.usageCount > 0 ? row.price / row.usageCount : 0)}</td>
            </tr>
          )}
        />

        {/* Lain-Lain */}
        <CostTable
          title="Biaya Lain-Lain"
          total={totalOther}
          headers={["Item", "Jumlah", "Biaya/Unit", "Total"]}
          rows={otherCosts}
          onAdd={() => setOtherCosts([...otherCosts, { name: "", qty: 1, unitCost: 0 }])}
          onRemove={(i) => setOtherCosts(otherCosts.filter((_, j) => j !== i))}
          renderRow={(row, i) => (
            <tr key={i}>
              <td style={tdStyle}>{textInput(row.name, (v) => { const c = [...otherCosts]; c[i] = { ...c[i], name: v }; setOtherCosts(c); })}</td>
              <td style={tdStyle}>{numInput(row.qty, (v) => { const c = [...otherCosts]; c[i] = { ...c[i], qty: v }; setOtherCosts(c); })}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{numInput(row.unitCost, (v) => { const c = [...otherCosts]; c[i] = { ...c[i], unitCost: v }; setOtherCosts(c); })}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatRupiah(row.qty * row.unitCost)}</td>
            </tr>
          )}
        />
      </div>

      {/* Charts */}
      {biayaProduk > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
          {/* Price Breakdown */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 10px" }}>Price Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={priceBreakdown} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                  {priceBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Cost Breakdown */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 10px" }}>Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                  {costBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Items Distribution */}
          {ingredientChart.length > 0 && (
            <div style={{ ...cardStyle, gridColumn: ingredientChart.length > 3 ? "1 / -1" : undefined }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 10px" }}>Items Cost Distribution</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, ingredientChart.length * 32)}>
                <BarChart data={ingredientChart} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
                  <Bar dataKey="biaya" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* What-If Scenarios */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 14px" }}>Skenario What-If</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <WhatIfCard
            question="Jika saya menjual dengan harga"
            inputValue={wf1}
            onChange={setWf1}
            results={wf1 > 0 ? [
              { label: "Laba", value: formatRupiah(wf1Profit), color: wf1Profit > 0 ? "var(--color-os-green)" : "var(--color-os-red)" },
              { label: "Margin", value: `${wf1Margin.toFixed(1)}%`, color: wf1Margin >= 40 ? "var(--color-os-green)" : "var(--color-os-red)" },
            ] : []}
          />
          <WhatIfCard
            question="Jika target pendapatan total"
            inputValue={wf2}
            onChange={setWf2}
            results={wf2 > 0 ? [
              { label: "Perlu jual", value: `${wf2Units.toLocaleString("id-ID")} unit`, color: "var(--color-os-accent)" },
            ] : []}
          />
          <WhatIfCard
            question="Jika kurangi biaya produksi"
            inputValue={wf3}
            onChange={setWf3}
            results={wf3 > 0 ? [
              { label: "Biaya baru", value: formatRupiah(wf3NewBiaya), color: "var(--color-os-blue)" },
              { label: "Laba baru", value: formatRupiah(wf3NewProfit), color: wf3NewProfit > 0 ? "var(--color-os-green)" : "var(--color-os-red)" },
              { label: "Margin baru", value: `${wf3NewMargin.toFixed(1)}%`, color: wf3NewMargin >= 40 ? "var(--color-os-green)" : "var(--color-os-red)" },
            ] : []}
          />
          <WhatIfCard
            question="Jika margin diubah ke (%)"
            inputValue={wf4}
            onChange={setWf4}
            isPercent
            results={wf4 > 0 && wf4 < 100 ? [
              { label: "Harga jual baru", value: formatRupiah(wf4Price), color: "var(--color-os-accent)" },
            ] : []}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────── */

function Label({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}
    </span>
  );
}

function CascadeRow({ label, value, bold, accent, large, color }: {
  label: string;
  value: number;
  bold?: boolean;
  accent?: boolean;
  large?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: large ? 15 : 12 }}>
      <span style={{ color: bold ? "var(--color-os-text)" : "var(--color-os-sub)", fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        fontWeight: bold ? 800 : 600,
        color: color || (accent ? "var(--color-os-accent)" : "var(--color-os-text)"),
      }}>
        {formatRupiah(value)}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
      {text}
    </div>
  );
}

function CostTable<T>({ title, total, headers, rows, onAdd, onRemove, renderRow }: {
  title: string;
  total: number;
  headers: string[];
  rows: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  renderRow: (row: T, i: number) => React.ReactNode;
}) {
  const thStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase",
    letterSpacing: 0.5, padding: "8px 10px", textAlign: "left", borderBottom: "1px solid var(--color-os-border)",
  };
  const cardStyle: React.CSSProperties = {
    background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20,
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: 0 }}>
          {title}
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--color-os-muted)", marginLeft: 8 }}>
            {formatRupiah(total)}
          </span>
        </h3>
        <button onClick={onAdd} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--color-os-border2)", background: "var(--color-os-surface)", color: "var(--color-os-sub)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
          <Plus size={11} /> Tambah
        </button>
      </div>
      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {headers.map((h) => <th key={h} style={thStyle}>{h}</th>)}
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const cells = renderRow(row, i) as React.ReactElement<{ children: React.ReactNode }>;
                return (
                  <tr key={i}>
                    {cells.props.children}
                    <td style={{ fontSize: 12, padding: "6px 10px", borderBottom: "1px solid var(--color-os-border)" }}>
                      <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", color: "var(--color-os-red)", cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Belum ada item. Klik Tambah untuk menambahkan." />
      )}
    </div>
  );
}

function WhatIfCard({ question, inputValue, onChange, isPercent, results }: {
  question: string;
  inputValue: number;
  onChange: (v: number) => void;
  isPercent?: boolean;
  results: Array<{ label: string; value: string; color: string }>;
}) {
  return (
    <div style={{ background: "var(--color-os-surface)", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--color-os-sub)", marginBottom: 8 }}>{question}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {!isPercent && <span style={{ fontSize: 12, color: "var(--color-os-muted)" }}>Rp</span>}
        <input
          type="number"
          value={inputValue || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            flex: 1,
            background: "var(--color-os-card)",
            border: "1px solid var(--color-os-border2)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-os-accent)",
            outline: "none",
            textAlign: "right",
          }}
        />
        {isPercent && <span style={{ fontSize: 12, color: "var(--color-os-muted)" }}>%</span>}
      </div>
      {results.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
          <span style={{ color: "var(--color-os-sub)" }}>{r.label}</span>
          <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
