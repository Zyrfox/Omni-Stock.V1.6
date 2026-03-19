"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createBahan, updateBahan, deleteBahan } from "@/actions/bahan";
import { saveBOM, createMenu, updateMenu } from "@/actions/menu";
import { estimateRawBulkYield, type RawBulkEstimationResult } from "@/actions/gemini";

interface BahanItem {
  id: string; namaBahan: string; tipeBahan: "packaged" | "raw_bulk";
  satuanBeli: string; satuanDapur: string; stokMinimum: number;
  hargaBeli: string; isiSatuan: string; hargaPerSatuanPorsi: string | null;
  outletId: string | null; kategoriBahan?: string | null;
}
interface MenuItem {
  id: string; namaMenu: string; kategori: "food" | "beverage" | null;
  outletId: string | null; totalCogs: string | null; hargaJual: string | null;
  channelType?: string | null;
  platformFeePercent?: string | null;
  mappingResep?: Array<{ id: string; itemId: string; qty: string; itemType?: "bahan_dasar" | "semi_finished"; bahan?: { namaBahan: string; satuanDapur: string; kategoriBahan?: string | null } }>;
}

interface ProductsClientProps {
  bahanList: BahanItem[];
  menuList: MenuItem[];
  sfgList: Array<{ id: string; namaSemiFinished: string; satuan: string }>;
  outletList: Array<{ id: string; namaOutlet: string }>;
  vendorList: Array<{ id: string; namaVendor: string }>;
}

// Strip Indonesian thousands-separator dots before parsing (e.g. "50.000" → 50000)
function parseNum(v: string | number | undefined): number {
  if (!v && v !== 0) return 0;
  return parseFloat(String(v).replace(/\.(?=\d{3})/g, "").replace(",", ".")) || 0;
}

const CHANNELS: Array<{ key: string; label: string; icon: string; defaultFee: number }> = [
  { key: "dine_in",  label: "Dine In",     icon: "🏠", defaultFee: 0  },
  { key: "takeaway", label: "Take Away",    icon: "🛍", defaultFee: 0  },
  { key: "grabfood", label: "GrabFood",     icon: "🟢", defaultFee: 20 },
  { key: "shopee",   label: "ShopeeFood",   icon: "🟠", defaultFee: 20 },
  { key: "gofood",   label: "GoFood",       icon: "🔵", defaultFee: 20 },
  { key: "other",    label: "Lainnya",      icon: "📦", defaultFee: 0  },
];

function getChannelLabel(key: string | null | undefined) {
  return CHANNELS.find(c => c.key === key)?.label ?? key ?? "Dine In";
}
function getChannelIcon(key: string | null | undefined) {
  return CHANNELS.find(c => c.key === key)?.icon ?? "🏠";
}
// Extract base menu name by stripping known channel suffixes
function extractBaseName(namaMenu: string): string {
  for (const ch of CHANNELS) {
    if (namaMenu.endsWith(` - ${ch.label}`)) return namaMenu.slice(0, -(ch.label.length + 3));
  }
  return namaMenu;
}
// Infer channelType from menu name suffix if channelType is null
function inferChannelType(m: MenuItem): string {
  if (m.channelType) return m.channelType;
  for (const ch of CHANNELS) {
    if (m.namaMenu.endsWith(` - ${ch.label}`)) return ch.key;
  }
  return "dine_in";
}

export function ProductsClient({ bahanList, menuList, outletList, vendorList }: ProductsClientProps) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [showAddBahan, setShowAddBahan] = useState(false);
  const [showBOMEditor, setShowBOMEditor] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [bomLines, setBomLines] = useState<Array<{ itemType: "bahan_dasar" | "semi_finished" | "kemasan"; itemId: string; qty: number }>>([]);
  const [bomSearches, setBomSearches] = useState<string[]>([]);
  const [bomOpenIdx, setBomOpenIdx] = useState<number | null>(null);
  const [bomDropdownRect, setBomDropdownRect] = useState<DOMRect | null>(null);
  const bomInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [bomHargaJual, setBomHargaJual] = useState("");
  const [saving, setSaving] = useState(false);
  const [menuForm, setMenuForm] = useState({ namaMenu: "", kategori: "food" as "food" | "beverage", hargaJual: "", outletId: "OUT-001", channelType: "dine_in", platformFeePercent: "0" });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addVariantBase, setAddVariantBase] = useState<string>("");
  const [menus, setMenus] = useState<MenuItem[]>(menuList);

  // Add Bahan form state
  const [form, setForm] = useState({
    namaBahan: "", tipeBahan: "packaged" as "packaged" | "raw_bulk",
    kategoriBahan: "", hargaBeli: "", satuanBeli: "1_karung",
    satuanDapur: "gram", stokMinimum: "", isiSatuan: "",
    leadTimeDays: "1", outletId: outletList[0]?.id ?? "OUT-001",
    vendorId: "",
  });
  const [aiEstimation, setAiEstimation] = useState<RawBulkEstimationResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [yieldMode, setYieldMode] = useState<"direct" | "batch" | "porsi">("direct");
  const [batchFields, setBatchFields] = useState({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  const [porsiEstimasi, setPorsiEstimasi] = useState("");

  // Edit Bahan state
  const [editTarget, setEditTarget] = useState<BahanItem | null>(null);
  const [editForm, setEditForm] = useState({ namaBahan: "", tipeBahan: "packaged" as "packaged" | "raw_bulk", hargaBeli: "", satuanBeli: "", satuanDapur: "", stokMinimum: "", isiSatuan: "", leadTimeDays: "1" });
  const [editAiEstimation, setEditAiEstimation] = useState<RawBulkEstimationResult | null>(null);
  const [editEstimating, setEditEstimating] = useState(false);
  const [editYieldMode, setEditYieldMode] = useState<"direct" | "batch" | "porsi">("direct");
  const [editBatchFields, setEditBatchFields] = useState({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  const [editPorsiEstimasi, setEditPorsiEstimasi] = useState("");
  const [bahans, setBahans] = useState<BahanItem[]>(bahanList);
  const [searchBahan, setSearchBahan] = useState("");
  const [searchResep, setSearchResep] = useState("");
  const [searchMenu, setSearchMenu] = useState("");
  const [dragMenuId, setDragMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);

  const tabs = ["1. Master Bahan", "2. Master Resep", "3. Master Menu"];

  const q1 = searchBahan.toLowerCase();
  const q2 = searchResep.toLowerCase();
  const q3 = searchMenu.toLowerCase();
  const filteredBahans = q1 ? bahans.filter((b) => b.namaBahan.toLowerCase().includes(q1) || b.id.toLowerCase().includes(q1)) : bahans;
  const filteredResep = q2 ? menus.filter((m) => m.namaMenu.toLowerCase().includes(q2) || m.id.toLowerCase().includes(q2)) : menus;
  const filteredMenus = q3 ? menus.filter((m) => m.namaMenu.toLowerCase().includes(q3) || m.id.toLowerCase().includes(q3)) : menus;

  // Group filteredMenus by base name
  const menuGroups = (() => {
    const map = new Map<string, MenuItem[]>();
    for (const m of filteredMenus) {
      const base = extractBaseName(m.namaMenu);
      if (!map.has(base)) map.set(base, []);
      map.get(base)!.push(m);
    }
    return Array.from(map.entries()); // [baseName, variants[]]
  })();

  function handleMenuDrop(toId: string) {
    if (!dragMenuId || dragMenuId === toId) { setDragMenuId(null); setDragOverMenuId(null); return; }
    setMenus((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((m) => m.id === dragMenuId);
      const toIdx = arr.findIndex((m) => m.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragMenuId(null);
    setDragOverMenuId(null);
  }

  async function handleSaveMenu() {
    if (!menuForm.namaMenu.trim()) return;
    setSaving(true);
    try {
      const result = await createMenu({
        namaMenu: menuForm.namaMenu.trim(),
        outletId: menuForm.outletId,
        kategori: menuForm.kategori,
        hargaJual: menuForm.hargaJual ? parseFloat(menuForm.hargaJual) : undefined,
        channelType: menuForm.channelType,
        platformFeePercent: parseFloat(menuForm.platformFeePercent) || 0,
      });
      setMenus((prev) => [...prev, {
        id: result.id, namaMenu: menuForm.namaMenu.trim(),
        kategori: menuForm.kategori, outletId: menuForm.outletId, totalCogs: "0",
        hargaJual: menuForm.hargaJual || null, mappingResep: [],
        channelType: menuForm.channelType,
        platformFeePercent: menuForm.platformFeePercent,
      }]);
      setMenuForm({ namaMenu: "", kategori: "food", hargaJual: "", outletId: "OUT-001", channelType: "dine_in", platformFeePercent: "0" });
      setAddVariantBase("");
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
      const result = await createBahan({
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
        vendorId: form.vendorId || undefined,
      });
      const hargaPerSatuanPorsi = parseFloat(form.isiSatuan) > 0
        ? (parseFloat(form.hargaBeli) / parseFloat(form.isiSatuan)).toFixed(6)
        : "0";
      setBahans((prev) => [...prev, {
        id: result.id, namaBahan: form.namaBahan, tipeBahan: form.tipeBahan,
        satuanBeli: form.satuanBeli, satuanDapur: form.satuanDapur,
        stokMinimum: parseInt(form.stokMinimum), hargaBeli: form.hargaBeli,
        isiSatuan: form.isiSatuan, hargaPerSatuanPorsi, outletId: form.outletId,
      }]);
      setShowAddBahan(false);
      setForm({ namaBahan: "", tipeBahan: "packaged", kategoriBahan: "", hargaBeli: "", satuanBeli: "1_karung", satuanDapur: "gram", stokMinimum: "", isiSatuan: "", leadTimeDays: "1", outletId: outletList[0]?.id ?? "OUT-001", vendorId: "" });
      setYieldMode("direct");
      setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
      setPorsiEstimasi("");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b: BahanItem) {
    setEditTarget(b);
    setEditForm({ namaBahan: b.namaBahan, tipeBahan: b.tipeBahan, hargaBeli: b.hargaBeli, satuanBeli: b.satuanBeli, satuanDapur: b.satuanDapur, stokMinimum: String(b.stokMinimum), isiSatuan: b.isiSatuan, leadTimeDays: "1" });
    setEditAiEstimation(null);
    setEditYieldMode("direct");
    setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  }

  async function handleEstimateEditYield() {
    if (!editForm.namaBahan || !editForm.isiSatuan) return;
    setEditEstimating(true);
    setEditAiEstimation(null);
    try {
      const result = await estimateRawBulkYield(
        editForm.namaBahan,
        parseFloat(editForm.isiSatuan) || 0,
        editForm.satuanDapur || "gram"
      );
      setEditAiEstimation(result);
    } finally {
      setEditEstimating(false);
    }
  }

  async function handleUpdateBahan() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateBahan(editTarget.id, {
        namaBahan: editForm.namaBahan,
        tipeBahan: editForm.tipeBahan,
        hargaBeli: parseFloat(editForm.hargaBeli),
        satuanBeli: editForm.satuanBeli,
        satuanDapur: editForm.satuanDapur,
        stokMinimum: parseInt(editForm.stokMinimum),
        isiSatuan: parseFloat(editForm.isiSatuan),
        leadTimeDays: parseInt(editForm.leadTimeDays),
      });
      const isiSatuan = parseNum(editForm.isiSatuan);
      const hargaBeli = parseNum(editForm.hargaBeli);
      const hargaPerSatuanPorsi = isiSatuan > 0 ? (hargaBeli / isiSatuan).toFixed(6) : "0";
      setBahans((prev) => prev.map((b) => b.id === editTarget.id
        ? { ...b, ...editForm, stokMinimum: parseInt(editForm.stokMinimum), hargaPerSatuanPorsi }
        : b));
      setEditTarget(null);
      setEditAiEstimation(null);
      setEditYieldMode("direct");
      setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
      setEditPorsiEstimasi("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBahan(id: string) {
    if (!confirm("Hapus bahan ini?")) return;
    await deleteBahan(id);
    setBahans((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleSaveBOM() {
    if (!selectedMenu) return;
    setSaving(true);
    try {
      await Promise.all([
        saveBOM(selectedMenu.id, "menu", bomLines.map(l => ({ ...l, itemType: l.itemType === "kemasan" ? "bahan_dasar" : l.itemType } as { itemType: "bahan_dasar" | "semi_finished"; itemId: string; qty: number }))),
        updateMenu(selectedMenu.id, {
          hargaJual: bomHargaJual ? parseFloat(bomHargaJual) : null,
        }),
      ]);
      // Update local menus state
      setMenus((prev) => prev.map((m) => m.id === selectedMenu.id
        ? { ...m, hargaJual: bomHargaJual || null, totalCogs: String(totalCOGS.toFixed(2)) }
        : m));
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
        {activeTab === 1 ? (
          <button
            onClick={() => { setShowAddBahan(true); setAiEstimation(null); setYieldMode("direct"); setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); }}
            className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
          >
            + Tambah Bahan
          </button>
        ) : (
          <button
            onClick={() => { setAddVariantBase(""); setShowAddMenu(true); setMenuForm({ namaMenu: "", kategori: "food", hargaJual: "", outletId: "OUT-001", channelType: "dine_in", platformFeePercent: "0" }); }}
            className="btn-accent"
            style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
          >
            + Tambah Menu
          </button>
        )}
      </div>

      {/* Stat Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Master Bahan Baku" value={bahans.length} icon="📦" color="#60A5FA" />
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
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E1E2E" }}>
            <input
              value={searchBahan}
              onChange={(e) => setSearchBahan(e.target.value)}
              placeholder="Cari nama bahan atau ID..."
              style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID", "Nama Bahan", "Tipe", "Kemasan Beli", "Satuan Dapur", "Min. Stok", "Harga Beli", "Isi/Yield", "Harga/Porsi", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama Bahan" ? "col-sticky-nama" : h === "ID" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBahans.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{searchBahan ? `Tidak ada bahan "${searchBahan}"` : `Belum ada bahan. Klik "Tambah Bahan" untuk memulai.`}</td></tr>
              ) : (
                filteredBahans.map((b) => (
                  <tr key={b.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{b.id}</td>
                    <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
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
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEdit(b)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDeleteBahan(b.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Tab 2 — Master Resep */}
      {activeTab === 2 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E1E2E" }}>
            <input
              value={searchResep}
              onChange={(e) => setSearchResep(e.target.value)}
              placeholder="Cari nama menu atau ID..."
              style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                {["ID Menu", "Nama Menu", "Outlet", "Komposisi", "Total COGS", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama Menu" ? "col-sticky-nama" : h === "ID Menu" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResep.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{searchResep ? `Tidak ada menu "${searchResep}"` : `Belum ada menu. Tambahkan dari tab Master Menu.`}</td></tr>
              ) : (
                filteredResep.map((m) => (
                  <tr key={m.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{m.id}</td>
                    <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{m.namaMenu}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{m.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {m.mappingResep && m.mappingResep.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {m.mappingResep.map((r) => (
                            <span key={r.id} style={{ fontSize: 10, padding: "2px 6px", background: "#14142A", borderRadius: 4, color: "#E2E8F0" }}>
                              {r.bahan?.namaBahan} {r.qty}{r.bahan?.satuanDapur}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: "#374151" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: parseFloat(m.totalCogs ?? "0") > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                      {formatRupiah(parseFloat(m.totalCogs ?? "0"))}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => {
                          setSelectedMenu(m);
                          setBomLines(m.mappingResep?.map((r) => ({ itemType: (r.bahan?.kategoriBahan === "Kemasan & Alat Makan" ? "kemasan" : (r.itemType ?? "bahan_dasar")) as "bahan_dasar" | "semi_finished" | "kemasan", itemId: r.itemId ?? "", qty: parseFloat(r.qty) })) ?? []);
                          setBomHargaJual(m.hargaJual ?? "");
                          setBomSearches([]);
                          setBomOpenIdx(null);
                          setShowBOMEditor(true);
                        }}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}
                      >
                        {m.mappingResep && m.mappingResep.length > 0 ? "Edit Resep" : "+ Buat Resep"}
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

      {/* Tab 3 — Master Menu */}
      {activeTab === 3 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E1E2E" }}>
            <input
              value={searchMenu}
              onChange={(e) => setSearchMenu(e.target.value)}
              placeholder="Cari nama menu atau ID..."
              style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#14142A" }}>
                <th className="col-hide-mobile" style={{ padding: "10px 8px", borderBottom: "1px solid #1E1E2E", width: 24 }} />
                {["ID Menu", "Nama / Channel", "Kategori", "Outlet", "Recipe", "Total COGS", "Harga Jual", "Margin", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama / Channel" ? "col-sticky-nama" : h === "ID Menu" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menuGroups.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  {searchMenu ? `Tidak ada menu "${searchMenu}"` : `Belum ada menu. Klik "+ Tambah Menu" untuk memulai.`}
                </td></tr>
              ) : (
                menuGroups.flatMap(([baseName, variants]) => {
                  const isExpanded = expandedGroups.has(baseName);
                  const toggle = () => setExpandedGroups(prev => {
                    const next = new Set(prev);
                    next.has(baseName) ? next.delete(baseName) : next.add(baseName);
                    return next;
                  });
                  const hasAnyRecipe = variants.some(v => v.mappingResep && v.mappingResep.length > 0);

                  return [
                    // Group header row
                    <tr
                      key={`group-${baseName}`}
                      className="table-row-hover"
                      onClick={toggle}
                      style={{ borderBottom: "1px solid #1E1E2E", cursor: "pointer", background: "#0F0F1A" }}
                    >
                      <td style={{ padding: "10px 8px", color: "#C8F135", fontSize: 14, textAlign: "center" }}>
                        {isExpanded ? "▾" : "▸"}
                      </td>
                      <td className="col-hide-mobile" />
                      <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>
                        {baseName}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "rgba(200,241,53,0.1)", color: "#C8F135", border: "1px solid rgba(200,241,53,0.2)" }}>
                          {variants.length} channel
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#4B5563" }} colSpan={2}>
                        {variants.map(v => (
                          <span key={v.id} style={{ marginRight: 6, fontSize: 11 }}>
                            {getChannelIcon(inferChannelType(v))} {getChannelLabel(inferChannelType(v))}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {hasAnyRecipe
                          ? <Badge color="green" size="sm">✓ Ada Resep</Badge>
                          : <Badge color="gray" size="sm">No Recipe</Badge>
                        }
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddVariantBase(baseName);
                            setMenuForm(f => ({
                              ...f,
                              namaMenu: baseName,
                              channelType: "dine_in",
                              platformFeePercent: "0",
                            }));
                            setShowAddMenu(true);
                          }}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.08)", color: "#C8F135", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          + Variant
                        </button>
                      </td>
                      <td />
                    </tr>,

                    // Sub-rows (channel variants) when expanded
                    ...(isExpanded ? variants.map((m) => {
                      const hasRecipe = m.mappingResep && m.mappingResep.length > 0;
                      const cogs = parseFloat(m.totalCogs ?? "0");
                      const hj = parseFloat(m.hargaJual ?? "0");
                      const fee = parseFloat(m.platformFeePercent ?? "0");
                      const feeAmount = hj * fee / 100;
                      const netRevenue = hj - feeAmount;
                      const margin = netRevenue > 0 && cogs > 0 ? ((netRevenue - cogs) / netRevenue * 100) : null;
                      const marginColor = margin === null ? "#4B5563" : margin >= 65 ? "#22C55E" : margin >= 40 ? "#F59E0B" : "#EF4444";
                      const chType = inferChannelType(m);
                      return (
                        <tr
                          key={m.id}
                          draggable
                          onDragStart={() => setDragMenuId(m.id)}
                          onDragOver={(e) => { e.preventDefault(); setDragOverMenuId(m.id); }}
                          onDrop={() => handleMenuDrop(m.id)}
                          onDragEnd={() => { setDragMenuId(null); setDragOverMenuId(null); }}
                          className="table-row-hover"
                          style={{
                            borderBottom: "1px solid #131320",
                            background: dragOverMenuId === m.id && dragMenuId !== m.id ? "rgba(200,241,53,0.04)" : "#13131F",
                            opacity: dragMenuId === m.id ? 0.4 : 1,
                          }}
                        >
                          <td className="col-hide-mobile" style={{ padding: "10px 8px", color: "#374151", cursor: "grab", textAlign: "center", fontSize: 14 }}>⠿</td>
                          <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{m.id}</td>
                          <td className="col-sticky-nama" style={{ padding: "10px 14px 10px 28px", fontSize: 12, fontWeight: 600, color: "#CBD5E1" }}>
                            <span style={{ fontSize: 11 }}>{getChannelIcon(chType)}</span>{" "}
                            {getChannelLabel(chType)}
                            {fee > 0 && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>
                                fee {fee}%
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <Badge color="blue" size="sm">{m.kategori ?? "—"}</Badge>
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{m.outletId ?? "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            {hasRecipe
                              ? <Badge color="green" size="sm">✓ Recipe Built</Badge>
                              : <Badge color="gray" size="sm">No Recipe</Badge>
                            }
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontSize: 12, color: cogs > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                              {formatRupiah(cogs)}
                            </div>
                            {fee > 0 && hj > 0 && (
                              <div style={{ fontSize: 9, color: "#F59E0B", marginTop: 1 }}>
                                +{formatRupiah(feeAmount)} fee
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: hj > 0 ? "#E2E8F0" : "#4B5563", fontWeight: 600 }}>
                            {hj > 0 ? formatRupiah(hj) : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: marginColor, fontWeight: 700 }}>
                            {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                            {fee > 0 && margin !== null && (
                              <div style={{ fontSize: 9, color: "#6B7280" }}>net margin</div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedMenu(m);
                                setBomLines(m.mappingResep?.map((r) => ({ itemType: (r.bahan?.kategoriBahan === "Kemasan & Alat Makan" ? "kemasan" : (r.itemType ?? "bahan_dasar")) as "bahan_dasar" | "semi_finished" | "kemasan", itemId: r.itemId ?? "", qty: parseFloat(r.qty) })) ?? []);
                                setBomHargaJual(m.hargaJual ?? "");
                                setBomSearches([]);
                                setBomOpenIdx(null);
                                setShowBOMEditor(true);
                              }}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}
                            >
                              {hasRecipe ? "Edit Resep" : "+ Buat Resep"}
                            </button>
                          </td>
                        </tr>
                      );
                    }) : []),
                  ];
                })
              )}
            </tbody>
          </table>
          </div>
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
                ].map(({ label, key, placeholder, type }: { label: string; key: string; placeholder: string; type?: string }) => (
                  <div key={key} style={{ gridColumn: key === "namaBahan" ? "1 / -1" : undefined }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                    <input
                      type={type ?? "text"}
                      value={(form as any)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                    {key === "satuanDapur" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                        {["gram","ml","liter","kg","porsi","gelas","pcs","pack","lembar","buah"].map((u) => (
                          <button key={u} type="button" onClick={() => setForm((f) => ({ ...f, satuanDapur: u }))}
                            style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${form.satuanDapur === u ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
                              background: form.satuanDapur === u ? "rgba(200,241,53,0.12)" : "transparent",
                              color: form.satuanDapur === u ? "#C8F135" : "#6B7280", fontSize: 10, cursor: "pointer" }}>
                            {u}
                          </button>
                        ))}
                      </div>
                    )}
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

                {/* Kategori Produk */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori Produk</label>
                  <select
                    value={form.kategoriBahan}
                    onChange={(e) => setForm((f) => ({ ...f, kategoriBahan: e.target.value }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: form.kategoriBahan ? "#E2E8F0" : "#4B5563", outline: "none" }}
                  >
                    <option value="">— Pilih Kategori —</option>
                    {["Main Course","Snack","Dessert","Ice Cream","Noodles","Beverage","Kemasan & Alat Makan"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  {form.kategoriBahan && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>
                      ID prefix: <span style={{ color: "#C8F135", fontWeight: 700 }}>
                        {{"Main Course":"MCR","Snack":"SNK","Dessert":"DST","Ice Cream":"ICE","Noodles":"NDL","Beverage":"BEV","Kemasan & Alat Makan":"KMS"}[form.kategoriBahan] ?? "BHN"}-XXX
                      </span>
                    </div>
                  )}
                </div>

                {/* Outlet */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Outlet</label>
                  <select
                    value={form.outletId}
                    onChange={(e) => setForm((f) => ({ ...f, outletId: e.target.value }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="">— Semua Outlet —</option>
                    {outletList.map(o => <option key={o.id} value={o.id}>{o.namaOutlet}</option>)}
                  </select>
                </div>

                {/* Vendor */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Vendor / Supplier</label>
                  <select
                    value={form.vendorId}
                    onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: form.vendorId ? "#E2E8F0" : "#4B5563", outline: "none" }}
                  >
                    <option value="">— Tidak ada vendor —</option>
                    {vendorList.map(v => <option key={v.id} value={v.id}>{v.namaVendor}</option>)}
                  </select>
                  {form.vendorId && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>
                      Bahan akan otomatis ter-sync ke halaman Suppliers
                    </div>
                  )}
                </div>
              </div>
              {/* AI Research Panel — raw_bulk only */}
              {form.tipeBahan === "raw_bulk" && (
                <div style={{ marginTop: 16, padding: 16, background: "rgba(200,241,53,0.05)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 8 }}>
                  {yieldMode !== "porsi" && (<>
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
                  </>)}

                  {/* Yield Mode Calculator */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", gap: 3, marginBottom: 10, background: "#0F0F18", borderRadius: 6, padding: 3 }}>
                      <button type="button" onClick={() => setYieldMode("direct")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "direct" ? 700 : 400, background: yieldMode === "direct" ? "#1E1E2E" : "transparent", color: yieldMode === "direct" ? "#E2E8F0" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Input Langsung
                      </button>
                      <button type="button" onClick={() => setYieldMode("batch")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "batch" ? 700 : 400, background: yieldMode === "batch" ? "#1E1E2E" : "transparent", color: yieldMode === "batch" ? "#C8F135" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Batch Produksi
                      </button>
                      <button type="button" onClick={() => setYieldMode("porsi")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "porsi" ? 700 : 400, background: yieldMode === "porsi" ? "#1E1E2E" : "transparent", color: yieldMode === "porsi" ? "#F59E0B" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Estimasi Porsi
                      </button>
                    </div>
                    {yieldMode === "direct" && (() => {
                      const is = parseNum(form.isiSatuan);
                      const hb = parseNum(form.hargaBeli);
                      return is > 0 && hb > 0 ? (
                        <div style={{ padding: "8px 12px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(200,241,53,0.1)" }}>
                          <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per {form.satuanDapur || "unit"}: </span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#C8F135" }}>Rp {(hb / is).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#374151", textAlign: "center", padding: "4px 0" }}>Isi Harga Beli & Isi Kemasan di atas untuk preview harga per {form.satuanDapur || "unit"}</div>
                      );
                    })()}
                    {yieldMode === "batch" && (() => {
                      const sub = parseNum(batchFields.jumlahSubUnit);
                      const ppb = parseNum(batchFields.porsiPerBatch);
                      const bpsu = parseNum(batchFields.jumlahBatchPerSubUnit || "1");
                      const total = sub > 0 && ppb > 0 && bpsu > 0 ? sub * ppb * bpsu : 0;
                      const hb = parseNum(form.hargaBeli);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 5 }}>
                            <span style={{ fontSize: 9, color: "#F59E0B", flexShrink: 0 }}>Satuan Output:</span>
                            <input value={form.satuanDapur} onChange={(e) => setForm(f => ({ ...f, satuanDapur: e.target.value }))}
                              placeholder="gelas" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 10, color: "#E2E8F0", fontWeight: 700 }} />
                            <span style={{ fontSize: 9, color: "#6B7280", flexShrink: 0 }}>= satuan hasil produksi (mis: gelas)</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Sub-unit / kemasan</label>
                              <input type="number" min={1} value={batchFields.jumlahSubUnit}
                                onChange={(e) => { const v = e.target.value; setBatchFields(f => ({ ...f, jumlahSubUnit: v })); const t = parseNum(v) * parseNum(batchFields.porsiPerBatch) * parseNum(batchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="10" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Porsi / produksi</label>
                              <input type="number" min={1} value={batchFields.porsiPerBatch}
                                onChange={(e) => { const v = e.target.value; setBatchFields(f => ({ ...f, porsiPerBatch: v })); const t = parseNum(batchFields.jumlahSubUnit) * parseNum(v) * parseNum(batchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="65" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Produksi / sub-unit</label>
                              <input type="number" min={1} value={batchFields.jumlahBatchPerSubUnit}
                                onChange={(e) => { const v = e.target.value; setBatchFields(f => ({ ...f, jumlahBatchPerSubUnit: v })); const t = parseNum(batchFields.jumlahSubUnit) * parseNum(batchFields.porsiPerBatch) * parseNum(v || "1"); if (t > 0) setForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="2" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                          </div>
                          {total > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ padding: "8px 10px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(96,165,250,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total Yield</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#60A5FA" }}>{total.toLocaleString("id-ID")} {form.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>{sub} × {ppb} × {bpsu}</div>
                              </div>
                              <div style={{ padding: "8px 10px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(200,241,53,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Harga / {form.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: hb > 0 ? "#C8F135" : "#4B5563" }}>{hb > 0 ? `Rp ${Math.round(hb / total).toLocaleString("id-ID")}` : "—"}</div>
                                {!hb && <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>isi Harga Beli dahulu</div>}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: "#374151", textAlign: "center", padding: "4px 0" }}>Isi ketiga nilai di atas untuk menghitung total yield</div>
                          )}
                        </div>
                      );
                    })()}
                    {yieldMode === "porsi" && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>1 {form.satuanBeli || "kemasan"} sekitar</span>
                          <input
                            type="number" min={1} value={porsiEstimasi}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPorsiEstimasi(v);
                              if (parseNum(v) > 0) setForm(f => ({ ...f, isiSatuan: v, satuanDapur: "porsi" }));
                            }}
                            placeholder="40"
                            style={{ width: 80, background: "#0F0F18", border: "1px solid #F59E0B", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                          />
                          <span style={{ fontSize: 11, color: "#6B7280" }}>porsi</span>
                        </div>
                        {parseNum(porsiEstimasi) > 0 && parseNum(form.hargaBeli) > 0 && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#0F0F18", borderRadius: 6 }}>
                            <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per porsi: </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                              Rp {Math.round(parseNum(form.hargaBeli) / parseNum(porsiEstimasi)).toLocaleString("id-ID")}
                            </span>
                            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>Satuan dapur di-set ke "porsi"</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddBahan(false); setAiEstimation(null); setYieldMode("direct"); setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); setPorsiEstimasi(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
          <div className="modal-fadein" style={{ width: 480, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>
                {addVariantBase ? `Tambah Variant — ${addVariantBase}` : "Tambah Menu Final"}
              </h2>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Menu *</label>
                  <input
                    value={addVariantBase
                      ? `${addVariantBase} - ${CHANNELS.find(c => c.key === menuForm.channelType)?.label ?? ""}`
                      : menuForm.namaMenu}
                    onChange={(e) => { if (!addVariantBase) setMenuForm((f) => ({ ...f, namaMenu: e.target.value })); }}
                    readOnly={!!addVariantBase}
                    placeholder="cth: Mie Goreng Special"
                    style={{ width: "100%", background: addVariantBase ? "#0A0A14" : "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: addVariantBase ? "#6B7280" : "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
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
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
                    />
                  </div>
                </div>
                {/* Channel Type */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
                    Channel / Platform
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CHANNELS.map(ch => (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => setMenuForm(f => ({ ...f, channelType: ch.key, platformFeePercent: String(ch.defaultFee) }))}
                        style={{
                          padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                          border: `1px solid ${menuForm.channelType === ch.key ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
                          background: menuForm.channelType === ch.key ? "rgba(200,241,53,0.1)" : "transparent",
                          color: menuForm.channelType === ch.key ? "#C8F135" : "#6B7280",
                        }}
                      >
                        {ch.icon} {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Platform Fee (only show if channel has fee > 0 or is a platform channel) */}
                {(parseFloat(menuForm.platformFeePercent) > 0 || ["grabfood","shopee","gofood"].includes(menuForm.channelType)) ? (
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>
                      Platform Fee (%)
                    </label>
                    <input
                      type="number"
                      value={menuForm.platformFeePercent}
                      onChange={(e) => setMenuForm(f => ({ ...f, platformFeePercent: e.target.value }))}
                      placeholder="20"
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
                    />
                    <span style={{ fontSize: 10, color: "#4B5563" }}>Komisi platform dari harga jual</span>
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddMenu(false); setAddVariantBase(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveMenu} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Menyimpan..." : "Simpan Menu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Bahan */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 520, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #60A5FA, #818CF8, transparent)" }} />
            <div style={{ padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 4px" }}>Edit Bahan — <span style={{ color: "#60A5FA" }}>{editTarget.id}</span></h2>
              <p style={{ fontSize: 11, color: "#4B5563", margin: "0 0 20px" }}>{editTarget.namaBahan}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Nama Bahan *", key: "namaBahan", placeholder: "" },
                  { label: "Satuan Dapur", key: "satuanDapur", placeholder: "" },
                  { label: "Kemasan Beli", key: "satuanBeli", placeholder: "" },
                  { label: "Min. Stok *", key: "stokMinimum", placeholder: "", type: "number" },
                  { label: "Harga Beli (Rp) *", key: "hargaBeli", placeholder: "", type: "number" },
                  { label: "Isi Kemasan (Yield) *", key: "isiSatuan", placeholder: "", type: "number" },
                  { label: "Lead Time (hari)", key: "leadTimeDays", placeholder: "1", type: "number" },
                ].map(({ label, key, placeholder, type }: { label: string; key: string; placeholder: string; type?: string }) => (
                  <div key={key} style={{ gridColumn: key === "namaBahan" ? "1 / -1" : undefined }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                    <input
                      type={type ?? "text"}
                      value={(editForm as any)[key]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                    {key === "satuanDapur" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                        {["gram","ml","liter","kg","porsi","gelas","pcs","pack","lembar","buah"].map((u) => (
                          <button key={u} type="button" onClick={() => setEditForm((f) => ({ ...f, satuanDapur: u }))}
                            style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${editForm.satuanDapur === u ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
                              background: editForm.satuanDapur === u ? "rgba(200,241,53,0.12)" : "transparent",
                              color: editForm.satuanDapur === u ? "#C8F135" : "#6B7280", fontSize: 10, cursor: "pointer" }}>
                            {u}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Tipe Bahan *</label>
                  <select
                    value={editForm.tipeBahan}
                    onChange={(e) => setEditForm((f) => ({ ...f, tipeBahan: e.target.value as "packaged" | "raw_bulk" }))}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="packaged">packaged</option>
                    <option value="raw_bulk">raw_bulk</option>
                  </select>
                </div>
              </div>

              {/* AI Research Panel — raw_bulk only */}
              {editForm.tipeBahan === "raw_bulk" && (
                <div style={{ marginTop: 16, padding: 16, background: "rgba(200,241,53,0.05)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 8 }}>
                  {editYieldMode !== "porsi" && (<>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#C8F135", fontWeight: 700, letterSpacing: 1 }}>✦ AI RESEARCH</span>
                      <span style={{ fontSize: 10, color: "#4B5563" }}>Estimasi Yield Bahan</span>
                    </div>
                    <button
                      onClick={handleEstimateEditYield}
                      disabled={editEstimating || !editForm.namaBahan || !editForm.isiSatuan}
                      style={{
                        fontSize: 11, padding: "5px 12px",
                        border: "1px solid rgba(200,241,53,0.4)", borderRadius: 6,
                        background: editEstimating ? "rgba(200,241,53,0.05)" : "rgba(200,241,53,0.1)",
                        color: "#C8F135", cursor: editEstimating || !editForm.namaBahan || !editForm.isiSatuan ? "not-allowed" : "pointer",
                        opacity: !editForm.namaBahan || !editForm.isiSatuan ? 0.5 : 1,
                      }}
                    >
                      {editEstimating ? "⏳ Menghitung..." : "🔍 Hitung Estimasi Yield"}
                    </button>
                  </div>
                  {!editAiEstimation && !editEstimating && (
                    <div style={{ fontSize: 11, color: "#4B5563", textAlign: "center", padding: "8px 0" }}>
                      Klik "Hitung Estimasi Yield" untuk estimasi AI
                    </div>
                  )}
                  {editAiEstimation && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "10px 12px", background: "#0F0F18", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Harga Pasar</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#C8F135" }}>{editAiEstimation.hargaPasarFormatted}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#0F0F18", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Estimasi Porsi / Kemasan</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>±{editAiEstimation.estimasiPorsiPerKemasan ?? "?"} porsi</div>
                        {editAiEstimation.namaMenuContoh && (
                          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{editAiEstimation.namaMenuContoh}</div>
                        )}
                      </div>
                      <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, fontStyle: "italic" }}>
                        {editAiEstimation.narasi}
                      </div>
                    </div>
                  )}
                  </>)}
                  {/* Yield Mode Calculator */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", gap: 3, marginBottom: 10, background: "#0F0F18", borderRadius: 6, padding: 3 }}>
                      <button type="button" onClick={() => setEditYieldMode("direct")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "direct" ? 700 : 400, background: editYieldMode === "direct" ? "#1E1E2E" : "transparent", color: editYieldMode === "direct" ? "#E2E8F0" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Input Langsung
                      </button>
                      <button type="button" onClick={() => setEditYieldMode("batch")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "batch" ? 700 : 400, background: editYieldMode === "batch" ? "#1E1E2E" : "transparent", color: editYieldMode === "batch" ? "#C8F135" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Batch Produksi
                      </button>
                      <button type="button" onClick={() => setEditYieldMode("porsi")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "porsi" ? 700 : 400, background: editYieldMode === "porsi" ? "#1E1E2E" : "transparent", color: editYieldMode === "porsi" ? "#F59E0B" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Estimasi Porsi
                      </button>
                    </div>
                    {editYieldMode === "direct" && (() => {
                      const is = parseNum(editForm.isiSatuan);
                      const hb = parseNum(editForm.hargaBeli);
                      return is > 0 && hb > 0 ? (
                        <div style={{ padding: "8px 12px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(200,241,53,0.1)" }}>
                          <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per {editForm.satuanDapur || "unit"}: </span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#C8F135" }}>Rp {(hb / is).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#374151", textAlign: "center", padding: "4px 0" }}>Isi Harga Beli & Isi Kemasan di atas untuk preview harga per {editForm.satuanDapur || "unit"}</div>
                      );
                    })()}
                    {editYieldMode === "batch" && (() => {
                      const sub = parseNum(editBatchFields.jumlahSubUnit);
                      const ppb = parseNum(editBatchFields.porsiPerBatch);
                      const bpsu = parseNum(editBatchFields.jumlahBatchPerSubUnit || "1");
                      const total = sub > 0 && ppb > 0 && bpsu > 0 ? sub * ppb * bpsu : 0;
                      const hb = parseNum(editForm.hargaBeli);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 5 }}>
                            <span style={{ fontSize: 9, color: "#F59E0B", flexShrink: 0 }}>Satuan Output:</span>
                            <input value={editForm.satuanDapur} onChange={(e) => setEditForm(f => ({ ...f, satuanDapur: e.target.value }))}
                              placeholder="gelas" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 10, color: "#E2E8F0", fontWeight: 700 }} />
                            <span style={{ fontSize: 9, color: "#6B7280", flexShrink: 0 }}>= satuan hasil produksi (mis: gelas)</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Sub-unit / kemasan</label>
                              <input type="number" min={1} value={editBatchFields.jumlahSubUnit}
                                onChange={(e) => { const v = e.target.value; setEditBatchFields(f => ({ ...f, jumlahSubUnit: v })); const t = parseNum(v) * parseNum(editBatchFields.porsiPerBatch) * parseNum(editBatchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setEditForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="10" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Porsi / produksi</label>
                              <input type="number" min={1} value={editBatchFields.porsiPerBatch}
                                onChange={(e) => { const v = e.target.value; setEditBatchFields(f => ({ ...f, porsiPerBatch: v })); const t = parseNum(editBatchFields.jumlahSubUnit) * parseNum(v) * parseNum(editBatchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setEditForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="65" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Produksi / sub-unit</label>
                              <input type="number" min={1} value={editBatchFields.jumlahBatchPerSubUnit}
                                onChange={(e) => { const v = e.target.value; setEditBatchFields(f => ({ ...f, jumlahBatchPerSubUnit: v })); const t = parseNum(editBatchFields.jumlahSubUnit) * parseNum(editBatchFields.porsiPerBatch) * parseNum(v || "1"); if (t > 0) setEditForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="2" style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                          </div>
                          {total > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ padding: "8px 10px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(96,165,250,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total Yield</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#60A5FA" }}>{total.toLocaleString("id-ID")} {editForm.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>{sub} × {ppb} × {bpsu}</div>
                              </div>
                              <div style={{ padding: "8px 10px", background: "#0F0F18", borderRadius: 6, border: "1px solid rgba(200,241,53,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Harga / {editForm.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: hb > 0 ? "#C8F135" : "#4B5563" }}>{hb > 0 ? `Rp ${Math.round(hb / total).toLocaleString("id-ID")}` : "—"}</div>
                                {!hb && <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>isi Harga Beli dahulu</div>}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: "#374151", textAlign: "center", padding: "4px 0" }}>Isi ketiga nilai di atas untuk menghitung total yield</div>
                          )}
                        </div>
                      );
                    })()}
                    {editYieldMode === "porsi" && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>1 {editForm.satuanBeli || "kemasan"} sekitar</span>
                          <input
                            type="number" min={1} value={editPorsiEstimasi}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditPorsiEstimasi(v);
                              if (parseNum(v) > 0) setEditForm(f => ({ ...f, isiSatuan: v, satuanDapur: "porsi" }));
                            }}
                            placeholder="40"
                            style={{ width: 80, background: "#0F0F18", border: "1px solid #F59E0B", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                          />
                          <span style={{ fontSize: 11, color: "#6B7280" }}>porsi</span>
                        </div>
                        {parseNum(editPorsiEstimasi) > 0 && parseNum(editForm.hargaBeli) > 0 && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#0F0F18", borderRadius: 6 }}>
                            <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per porsi: </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                              Rp {Math.round(parseNum(editForm.hargaBeli) / parseNum(editPorsiEstimasi)).toLocaleString("id-ID")}
                            </span>
                            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>Satuan dapur di-set ke "porsi"</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditTarget(null); setEditAiEstimation(null); setEditYieldMode("direct"); setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); setEditPorsiEstimasi(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleUpdateBahan} disabled={saving} style={{ padding: "8px 16px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.4)", borderRadius: 8, color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
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
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 2px" }}>Edit Resep — {selectedMenu.namaMenu}</h2>
                  <p style={{ fontSize: 11, color: "#4B5563", margin: 0 }}>Bill of Materials (BOM) multi-level</p>
                </div>
                <div style={{ minWidth: 160 }}>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", marginBottom: 4 }}>Harga Jual (Rp)</label>
                  <input
                    type="number"
                    value={bomHargaJual}
                    onChange={(e) => setBomHargaJual(e.target.value)}
                    placeholder="cth: 25000"
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              {/* BOM header row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #1E1E2E" }}>
                <div style={{ width: 110, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Tipe</div>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Item</div>
                <div style={{ width: 70, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Qty</div>
                <div style={{ width: 60, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Satuan</div>
                <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Sub-COGS</div>
                <div style={{ width: 28 }} />
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {bomLines.map((line, idx) => {
                  const bahan = bahanList.find((b) => b.id === line.itemId);
                  const satuan = bahan?.satuanDapur;
                  const subCogs = bahan ? line.qty * parseFloat(bahan.hargaPerSatuanPorsi ?? "0") : 0;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
                      <select
                        value={line.itemType}
                        onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, itemType: e.target.value as "bahan_dasar" | "semi_finished" | "kemasan", itemId: "" } : x))}
                        style={{ width: 110, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}
                      >
                        <option value="bahan_dasar">Bahan</option>
                        <option value="semi_finished">Sub-Resep</option>
                        <option value="kemasan">📦 Kemasan</option>
                      </select>
                      <div style={{ flex: 1 }}>
                        <input
                          ref={(el) => { bomInputRefs.current[idx] = el; }}
                          value={bomOpenIdx === idx ? (bomSearches[idx] ?? "") : (bahanList.find((b) => b.id === line.itemId)?.namaBahan ?? "")}
                          onChange={(e) => {
                            setBomSearches((s) => { const a = [...s]; a[idx] = e.target.value; return a; });
                            setBomOpenIdx(idx);
                            const rect = bomInputRefs.current[idx]?.getBoundingClientRect();
                            if (rect) setBomDropdownRect(rect);
                          }}
                          onFocus={() => {
                            setBomSearches((s) => { const a = [...s]; a[idx] = ""; return a; });
                            setBomOpenIdx(idx);
                            const rect = bomInputRefs.current[idx]?.getBoundingClientRect();
                            if (rect) setBomDropdownRect(rect);
                          }}
                          onBlur={() => setTimeout(() => setBomOpenIdx((o) => o === idx ? null : o), 150)}
                          placeholder="— Cari item —"
                          style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0", boxSizing: "border-box", outline: "none" }}
                        />
                      </div>
                      <input
                        type="number" value={line.qty} min={0.001} step={0.001}
                        onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 70, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}
                      />
                      <span style={{ width: 60, fontSize: 10, color: "#6B7280" }}>{satuan ?? "—"}</span>
                      <span style={{ width: 90, fontSize: 10, color: subCogs > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                        {subCogs > 0 ? `Rp ${Math.round(subCogs).toLocaleString("id-ID")}` : "—"}
                      </span>
                      <button onClick={() => setBomLines((l) => l.filter((_, i) => i !== idx))}
                        style={{ width: 28, background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, padding: 0 }}>🗑</button>
                    </div>
                  );
                })}
                {bomLines.length === 0 && (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#374151", fontSize: 11 }}>Belum ada baris. Klik "+ Tambah Baris".</div>
                )}
              </div>
              <button onClick={() => setBomLines((l) => [...l, { itemType: "bahan_dasar", itemId: "", qty: 1 }])}
                style={{ marginTop: 8, fontSize: 11, padding: "6px 12px", border: "1px dashed #2D2D44", borderRadius: 6, background: "transparent", color: "#6B7280", cursor: "pointer" }}>
                + Tambah Baris
              </button>
              {/* COGS vs Harga Jual panel */}
              {(() => {
                const hj = parseFloat(bomHargaJual) || 0;
                const margin = hj > 0 ? ((hj - totalCOGS) / hj * 100) : null;
                const marginColor = margin === null ? "#4B5563" : margin >= 65 ? "#22C55E" : margin >= 40 ? "#F59E0B" : "#EF4444";
                return (
                  <div style={{ marginTop: 14, padding: "12px 14px", background: "#0F0F18", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total COGS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#C8F135" }}>Rp {Math.round(totalCOGS).toLocaleString("id-ID")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Harga Jual</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: hj > 0 ? "#E2E8F0" : "#4B5563" }}>
                        {hj > 0 ? `Rp ${hj.toLocaleString("id-ID")}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Margin</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: marginColor }}>
                        {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  </div>
                );
              })()}
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

      {/* BOM combobox dropdown — rendered via portal to escape overflow:hidden */}
      {bomOpenIdx !== null && bomDropdownRect && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: bomDropdownRect.bottom + 2,
            left: bomDropdownRect.left,
            width: bomDropdownRect.width,
            background: "#13131F",
            border: "1px solid #2D2D44",
            borderRadius: 7,
            zIndex: 9999,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
          }}
        >
          {(() => {
            const line = bomLines[bomOpenIdx];
            if (!line) return null;
            const q = (bomSearches[bomOpenIdx] ?? "").toLowerCase();
            const options = (
              line.itemType === "kemasan"
                ? bahanList.filter((b) => b.kategoriBahan === "Kemasan & Alat Makan")
                : line.itemType === "bahan_dasar"
                  ? bahanList.filter((b) => b.kategoriBahan !== "Kemasan & Alat Makan")
                  : bahanList.filter((b) => b.tipeBahan === "raw_bulk")
            ).filter((b) => !q || b.namaBahan.toLowerCase().includes(q));
            if (options.length === 0) return (
              <div style={{ padding: "10px 12px", fontSize: 11, color: "#4B5563" }}>Tidak ada hasil</div>
            );
            return options.map((b) => (
              <div
                key={b.id}
                onMouseDown={() => {
                  setBomLines((l) => l.map((x, i) => i === bomOpenIdx ? { ...x, itemId: b.id } : x));
                  setBomSearches((s) => { const a = [...s]; a[bomOpenIdx!] = b.namaBahan; return a; });
                  setBomOpenIdx(null);
                }}
                style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: b.id === line.itemId ? "#C8F135" : "#E2E8F0", background: b.id === line.itemId ? "rgba(200,241,53,0.07)" : "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = b.id === line.itemId ? "rgba(200,241,53,0.07)" : "transparent")}
              >
                {b.namaBahan}
              </div>
            ));
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
