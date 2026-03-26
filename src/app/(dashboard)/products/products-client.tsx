"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { StatCard } from "@/components/shared/stat-card";
import { Package, FlaskConical, ClipboardList, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";
import { createBahan, updateBahan, deleteBahan, renameBahanId } from "@/actions/bahan";
import { saveBOM, createMenu, updateMenu } from "@/actions/menu";
import { createSemiFinished, updateSemiFinished, deleteSemiFinished, saveSFGBOM } from "@/actions/semi-finished";
import { useAppContext } from "@/contexts/app-context";
import { estimateRawBulkYield, estimatePorsiSaja, estimateFromWizardAnswers, generateProductionQuestions, type RawBulkEstimationResult, type WizardEstimationResult, type ProductionQuestion, type GenerateQuestionsResult } from "@/actions/gemini";
import { formatMinStok } from "@/lib/stock-status";

function formatYield(v: string | number | null | undefined): string {
  if (!v) return "—";
  const n = parseFloat(String(v));
  if (isNaN(n)) return "—";
  return parseFloat(n.toFixed(4)).toString();
}

interface BahanItem {
  id: string; namaBahan: string; tipeBahan: "packaged" | "raw_bulk";
  satuanBeli: string; satuanDapur: string; stokMinimum: number;
  hargaBeli: string; isiSatuan: string; hargaPerSatuanPorsi: string | null;
  outletId: string | null; kategoriBahan?: string | null;
  vendorBahan?: Array<{ vendorId: string; vendor: { id: string; namaVendor: string } }>;
}
interface MenuItem {
  id: string; namaMenu: string; kategori: "food" | "beverage" | null;
  outletId: string | null; totalCogs: string | null; hargaJual: string | null;
  channelType?: string | null;
  platformFeePercent?: string | null;
  mappingResep?: Array<{ id: string; itemId: string; qty: string; itemType?: "bahan_dasar" | "semi_finished"; bahan?: { namaBahan: string; satuanDapur: string; kategoriBahan?: string | null } }>;
}

interface SFGItem {
  id: string;
  namaSemiFinished: string;
  satuan: string;
  satuanHasil: string;
  jumlahHasil: string;
  totalCogs: string;
  cogsPerUnit: string;
  outletId: string | null;
  mappingResep?: Array<{
    id: string;
    itemId: string;
    qty: string;
    itemType: "bahan_dasar" | "semi_finished";
    bahan?: { namaBahan: string; satuanDapur: string } | null;
  }>;
}

interface ProductsClientProps {
  bahanList: BahanItem[];
  menuList: MenuItem[];
  sfgList: SFGItem[];
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

export function ProductsClient({ bahanList, menuList, sfgList: sfgListProp, outletList, vendorList }: ProductsClientProps) {
  const { isGuest, userRole } = useAppContext();
  const isAdmin = userRole === "admin";

  // Rename bahan ID state (admin only)
  const [renameTarget, setRenameTarget] = useState<{ id: string } | null>(null);
  const [renameNewId, setRenameNewId] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState("");

  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(1);
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
  const [aiStep, setAiStep] = useState<"idle" | "questions" | "result">("idle");
  const [aiContext, setAiContext] = useState({ penggunaan: "", skalaPorsi: "" });
  // Wizard state for raw_bulk guided entry
  const [wiz, setWiz] = useState<{
    step: 1 | 2;
    metode: string;
    loadingQ: boolean;
    questions: ProductionQuestion[];
    answers: Record<string, string>;
    running: boolean;
    result: WizardEstimationResult | null;
  }>({ step: 1, metode: "", loadingQ: false, questions: [], answers: {}, running: false, result: null });
  const [yieldMode, setYieldMode] = useState<"direct" | "batch" | "porsi">("direct");
  const [batchFields, setBatchFields] = useState({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  const [porsiEstimasi, setPorsiEstimasi] = useState("");
  const [porsiLoading, setPorsiLoading] = useState(false);
  const [porsiNarasi, setPorsiNarasi] = useState("");

  // Edit Bahan state
  const [editTarget, setEditTarget] = useState<BahanItem | null>(null);
  const [editForm, setEditForm] = useState({ namaBahan: "", tipeBahan: "packaged" as "packaged" | "raw_bulk", kategoriBahan: "", hargaBeli: "", satuanBeli: "", satuanDapur: "", stokMinimum: "", isiSatuan: "", leadTimeDays: "1", outletId: "" });
  const [editAiEstimation, setEditAiEstimation] = useState<RawBulkEstimationResult | null>(null);
  const [editEstimating, setEditEstimating] = useState(false);
  const [editAiStep, setEditAiStep] = useState<"idle" | "questions" | "result">("idle");
  const [editAiContext, setEditAiContext] = useState({ penggunaan: "", skalaPorsi: "" });
  const [editYieldMode, setEditYieldMode] = useState<"direct" | "batch" | "porsi">("direct");
  const [editBatchFields, setEditBatchFields] = useState({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  const [editPorsiEstimasi, setEditPorsiEstimasi] = useState("");
  const [editPorsiLoading, setEditPorsiLoading] = useState(false);
  const [editPorsiNarasi, setEditPorsiNarasi] = useState("");
  const [editVendorId, setEditVendorId] = useState("");
  const [bahans, setBahans] = useState<BahanItem[]>(bahanList);
  const [bahanPage, setBahanPage] = useState(0);
  const [bahanRowsPerPage, setBahanRowsPerPage] = useState(20);
  const [resepPage, setResepPage] = useState(0);
  const [resepRowsPerPage, setResepRowsPerPage] = useState(20);
  const [menuPage, setMenuPage] = useState(0);
  const [menuRowsPerPage, setMenuRowsPerPage] = useState(20);
  const [searchBahan, setSearchBahan] = useState("");
  const [searchResep, setSearchResep] = useState("");
  const [searchMenu, setSearchMenu] = useState("");
  const [dragMenuId, setDragMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);
  const [dragBahanId, setDragBahanId] = useState<string | null>(null);
  const [dragOverBahanId, setDragOverBahanId] = useState<string | null>(null);
  const [dragResepId, setDragResepId] = useState<string | null>(null);
  const [dragOverResepId, setDragOverResepId] = useState<string | null>(null);
  const [dragGroupBase, setDragGroupBase] = useState<string | null>(null);
  const [dragOverGroupBase, setDragOverGroupBase] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [bahanViewMode, setBahanViewMode] = useState<"card" | "table">("card");
  const [sfgViewMode, setSfgViewMode] = useState<"card" | "table">("card");
  const [resepViewMode, setResepViewMode] = useState<"card" | "table">("card");
  const [menuViewMode, setMenuViewMode] = useState<"card" | "table">("card");

  // Min stok mode toggle (for add/edit bahan forms)
  const [stokMinimumMode, setStokMinimumMode] = useState<"satuanDapur" | "kemasan">("satuanDapur");
  const [editStokMinimumMode, setEditStokMinimumMode] = useState<"satuanDapur" | "kemasan">("satuanDapur");

  // Raw Menu (SFG) state
  const [sfgList, setSfgList] = useState<SFGItem[]>(sfgListProp);
  const [showAddSFG, setShowAddSFG] = useState(false);
  const [sfgForm, setSfgForm] = useState({ namaSemiFinished: "", satuanHasil: "gram", jumlahHasil: "1", outletId: outletList[0]?.id ?? "OUT-001" });
  const [editSFG, setEditSFG] = useState<SFGItem | null>(null);
  const [editSFGForm, setEditSFGForm] = useState({ namaSemiFinished: "", satuanHasil: "gram", jumlahHasil: "1" });
  const [showSFGEditor, setShowSFGEditor] = useState(false);
  const [selectedSFG, setSelectedSFG] = useState<SFGItem | null>(null);
  const [sfgBomLines, setSfgBomLines] = useState<Array<{ itemType: "bahan_dasar" | "semi_finished"; itemId: string; qty: number }>>([]);
  const [sfgBomSearches, setSfgBomSearches] = useState<string[]>([]);
  const [sfgBomOpenIdx, setSfgBomOpenIdx] = useState<number | null>(null);
  const [sfgBomDropdownRect, setSfgBomDropdownRect] = useState<DOMRect | null>(null);
  const sfgBomInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [sfgPage, setSfgPage] = useState(0);
  const [sfgRowsPerPage, setSfgRowsPerPage] = useState(20);
  const [searchSFG, setSearchSFG] = useState("");
  const [sfgSaving, setSfgSaving] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tabs = ["1. Master Bahan", "2. Raw Menu", "3. Master Resep", "4. Master Menu"];

  const q1 = searchBahan.toLowerCase();
  const q2 = searchResep.toLowerCase();
  const q3 = searchMenu.toLowerCase();
  const filteredBahans = q1 ? bahans.filter((b) => b.namaBahan.toLowerCase().includes(q1) || b.id.toLowerCase().includes(q1)) : bahans;
  const safeBahanPage = Math.min(bahanPage, Math.max(0, Math.ceil(filteredBahans.length / bahanRowsPerPage) - 1));
  const pagedBahans = filteredBahans.slice(safeBahanPage * bahanRowsPerPage, (safeBahanPage + 1) * bahanRowsPerPage);
  const filteredResep = q2 ? menus.filter((m) => m.namaMenu.toLowerCase().includes(q2) || m.id.toLowerCase().includes(q2)) : menus;
  const safeResepPage = Math.min(resepPage, Math.max(0, Math.ceil(filteredResep.length / resepRowsPerPage) - 1));
  const pagedResep = filteredResep.slice(safeResepPage * resepRowsPerPage, (safeResepPage + 1) * resepRowsPerPage);
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
  const safeMenuPage = Math.min(menuPage, Math.max(0, Math.ceil(menuGroups.length / menuRowsPerPage) - 1));
  const pagedMenuGroups = menuGroups.slice(safeMenuPage * menuRowsPerPage, (safeMenuPage + 1) * menuRowsPerPage);

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

  function handleBahanDrop(toId: string) {
    if (!dragBahanId || dragBahanId === toId) { setDragBahanId(null); setDragOverBahanId(null); return; }
    setBahans((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((b) => b.id === dragBahanId);
      const toIdx = arr.findIndex((b) => b.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragBahanId(null);
    setDragOverBahanId(null);
  }

  function handleResepDrop(toId: string) {
    if (!dragResepId || dragResepId === toId) { setDragResepId(null); setDragOverResepId(null); return; }
    setMenus((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((m) => m.id === dragResepId);
      const toIdx = arr.findIndex((m) => m.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragResepId(null);
    setDragOverResepId(null);
  }

  function handleGroupDrop(toBase: string) {
    if (!dragGroupBase || dragGroupBase === toBase) { setDragGroupBase(null); setDragOverGroupBase(null); return; }
    setMenus((prev) => {
      const fromItems = prev.filter((m) => extractBaseName(m.namaMenu) === dragGroupBase);
      const rest = prev.filter((m) => extractBaseName(m.namaMenu) !== dragGroupBase);
      const insertIdx = rest.findIndex((m) => extractBaseName(m.namaMenu) === toBase);
      if (insertIdx < 0) return prev;
      rest.splice(insertIdx, 0, ...fromItems);
      return rest;
    });
    setDragGroupBase(null);
    setDragOverGroupBase(null);
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

  function handleEstimateYield() {
    if (!form.namaBahan || !form.isiSatuan) return;
    setAiStep("questions");
    setAiContext({ penggunaan: "", skalaPorsi: "" });
    setAiEstimation(null);
  }

  async function runEstimation(ctx: { penggunaan: string; skalaPorsi: string }) {
    setEstimating(true);
    setAiEstimation(null);
    try {
      const result = await estimateRawBulkYield(
        form.namaBahan, parseFloat(form.isiSatuan) || 0, form.satuanDapur || "gram", ctx
      );
      setAiEstimation(result);
      setAiStep("result");
    } finally {
      setEstimating(false);
    }
  }

  async function runEditEstimation(ctx: { penggunaan: string; skalaPorsi: string }) {
    setEditEstimating(true);
    setEditAiEstimation(null);
    try {
      const result = await estimateRawBulkYield(
        editForm.namaBahan, parseFloat(editForm.isiSatuan) || 0, editForm.satuanDapur || "gram", ctx
      );
      setEditAiEstimation(result);
      setEditAiStep("result");
    } finally {
      setEditEstimating(false);
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
        stokMinimum: stokMinimumMode === "kemasan"
          ? Math.round(parseInt(form.stokMinimum) * parseFloat(form.isiSatuan || "1"))
          : parseInt(form.stokMinimum),
        leadTimeDays: parseInt(form.leadTimeDays),
        vendorId: form.vendorId || undefined,
      });
      const resolvedStokMin = stokMinimumMode === "kemasan"
        ? Math.round(parseInt(form.stokMinimum) * parseFloat(form.isiSatuan || "1"))
        : parseInt(form.stokMinimum);
      const hargaPerSatuanPorsi = parseFloat(form.isiSatuan) > 0
        ? (parseFloat(form.hargaBeli) / parseFloat(form.isiSatuan)).toFixed(6)
        : "0";
      setBahans((prev) => [...prev, {
        id: result.id, namaBahan: form.namaBahan, tipeBahan: form.tipeBahan,
        satuanBeli: form.satuanBeli, satuanDapur: form.satuanDapur,
        stokMinimum: resolvedStokMin, hargaBeli: form.hargaBeli,
        isiSatuan: form.isiSatuan, hargaPerSatuanPorsi, outletId: form.outletId,
      }]);
      setShowAddBahan(false);
      setStokMinimumMode("satuanDapur");
      setForm({ namaBahan: "", tipeBahan: "packaged", kategoriBahan: "", hargaBeli: "", satuanBeli: "1_karung", satuanDapur: "gram", stokMinimum: "", isiSatuan: "", leadTimeDays: "1", outletId: outletList[0]?.id ?? "OUT-001", vendorId: "" });
      setYieldMode("direct");
      setAiStep("idle"); setAiContext({ penggunaan: "", skalaPorsi: "" });
      setWiz({ step: 1, metode: "", loadingQ: false, questions: [], answers: {}, running: false, result: null });
      setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
      setPorsiEstimasi(""); setPorsiNarasi("");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b: BahanItem) {
    setEditTarget(b);
    setEditStokMinimumMode("satuanDapur");
    setEditForm({ namaBahan: b.namaBahan, tipeBahan: b.tipeBahan, kategoriBahan: b.kategoriBahan ?? "", hargaBeli: b.hargaBeli, satuanBeli: b.satuanBeli, satuanDapur: b.satuanDapur, stokMinimum: String(b.stokMinimum), isiSatuan: b.isiSatuan, leadTimeDays: "1", outletId: b.outletId ?? "" });
    setEditVendorId(b.vendorBahan?.[0]?.vendorId ?? "");
    setEditAiEstimation(null);
    setEditAiStep("idle");
    setEditAiContext({ penggunaan: "", skalaPorsi: "" });
    setEditYieldMode("direct");
    setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
  }

  function handleEstimateEditYield() {
    if (!editForm.namaBahan || !editForm.isiSatuan) return;
    setEditAiStep("questions");
    setEditAiContext({ penggunaan: "", skalaPorsi: "" });
    setEditAiEstimation(null);
  }

  async function handleUpdateBahan() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateBahan(editTarget.id, {
        namaBahan: editForm.namaBahan,
        tipeBahan: editForm.tipeBahan,
        kategoriBahan: editForm.kategoriBahan || undefined,
        hargaBeli: parseFloat(editForm.hargaBeli),
        satuanBeli: editForm.satuanBeli,
        satuanDapur: editForm.satuanDapur,
        stokMinimum: editStokMinimumMode === "kemasan"
          ? Math.round(parseInt(editForm.stokMinimum) * parseFloat(editForm.isiSatuan || "1"))
          : parseInt(editForm.stokMinimum),
        isiSatuan: parseFloat(editForm.isiSatuan),
        leadTimeDays: parseInt(editForm.leadTimeDays),
        outletId: editForm.outletId || undefined,
        vendorId: editVendorId,
      });
      const resolvedEditStokMin = editStokMinimumMode === "kemasan"
        ? Math.round(parseInt(editForm.stokMinimum) * parseFloat(editForm.isiSatuan || "1"))
        : parseInt(editForm.stokMinimum);
      const isiSatuan = parseNum(editForm.isiSatuan);
      const hargaBeli = parseNum(editForm.hargaBeli);
      const hargaPerSatuanPorsi = isiSatuan > 0 ? (hargaBeli / isiSatuan).toFixed(6) : "0";
      setBahans((prev) => prev.map((b) => b.id === editTarget.id
        ? { ...b, ...editForm, stokMinimum: resolvedEditStokMin, hargaPerSatuanPorsi }
        : b));
      setEditTarget(null);
      setEditAiEstimation(null);
      setEditYieldMode("direct");
      setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" });
      setEditPorsiEstimasi(""); setEditPorsiNarasi("");
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

  async function handleCreateSFG() {
    if (!sfgForm.namaSemiFinished.trim()) return;
    setSfgSaving(true);
    try {
      const result = await createSemiFinished({
        outletId: sfgForm.outletId,
        namaSemiFinished: sfgForm.namaSemiFinished,
        satuanHasil: sfgForm.satuanHasil,
        jumlahHasil: parseFloat(sfgForm.jumlahHasil) || 1,
      });
      setSfgList(prev => [...prev, {
        id: result.id, namaSemiFinished: sfgForm.namaSemiFinished,
        satuan: sfgForm.satuanHasil, satuanHasil: sfgForm.satuanHasil,
        jumlahHasil: sfgForm.jumlahHasil, totalCogs: "0", cogsPerUnit: "0",
        outletId: sfgForm.outletId, mappingResep: [],
      }]);
      setShowAddSFG(false);
      setSfgForm({ namaSemiFinished: "", satuanHasil: "gram", jumlahHasil: "1", outletId: outletList[0]?.id ?? "OUT-001" });
    } finally {
      setSfgSaving(false);
    }
  }

  async function handleUpdateSFG() {
    if (!editSFG) return;
    setSfgSaving(true);
    try {
      await updateSemiFinished(editSFG.id, {
        namaSemiFinished: editSFGForm.namaSemiFinished,
        satuanHasil: editSFGForm.satuanHasil,
        jumlahHasil: parseFloat(editSFGForm.jumlahHasil) || 1,
      });
      setSfgList(prev => prev.map(s => s.id === editSFG.id
        ? { ...s, namaSemiFinished: editSFGForm.namaSemiFinished, satuanHasil: editSFGForm.satuanHasil, satuan: editSFGForm.satuanHasil, jumlahHasil: editSFGForm.jumlahHasil }
        : s));
      setEditSFG(null);
    } finally {
      setSfgSaving(false);
    }
  }

  async function handleDeleteSFG(id: string) {
    if (!confirm("Hapus Raw Menu ini?")) return;
    await deleteSemiFinished(id);
    setSfgList(prev => prev.filter(s => s.id !== id));
  }

  const sfgTotalCOGS = sfgBomLines.reduce((sum, line) => {
    if (line.itemType === "semi_finished") {
      const nestedSfg = sfgList.find(s => s.id === line.itemId);
      return sum + line.qty * parseFloat(nestedSfg?.cogsPerUnit ?? "0");
    }
    const bahan = bahanList.find(b => b.id === line.itemId);
    return sum + line.qty * parseFloat(bahan?.hargaPerSatuanPorsi ?? "0");
  }, 0);

  async function handleSaveSFGBOM() {
    if (!selectedSFG) return;
    setSfgSaving(true);
    try {
      await saveSFGBOM(selectedSFG.id, sfgBomLines);
      const jumlahHasil = parseFloat(selectedSFG.jumlahHasil) || 1;
      const cogsPerUnit = jumlahHasil > 0 ? sfgTotalCOGS / jumlahHasil : 0;
      setSfgList(prev => prev.map(s => s.id === selectedSFG.id
        ? {
            ...s,
            totalCogs: sfgTotalCOGS.toFixed(2),
            cogsPerUnit: cogsPerUnit.toFixed(6),
            mappingResep: sfgBomLines.map((l, i) => ({
              id: `tmp-${i}`, itemId: l.itemId, qty: String(l.qty), itemType: l.itemType,
              bahan: bahanList.find(b => b.id === l.itemId)
                ? { namaBahan: bahanList.find(b => b.id === l.itemId)!.namaBahan, satuanDapur: bahanList.find(b => b.id === l.itemId)!.satuanDapur }
                : null,
            })),
          }
        : s));
      setShowSFGEditor(false);
    } finally {
      setSfgSaving(false);
    }
  }

  const totalCOGS = bomLines.reduce((sum, line) => {
    if (line.itemType === "semi_finished") {
      const sfg = sfgList.find(s => s.id === line.itemId);
      return sum + line.qty * parseFloat(sfg?.cogsPerUnit ?? "0");
    }
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
        {!isGuest && (
          activeTab === 1 ? (
            <button
              onClick={() => { setShowAddBahan(true); setAiEstimation(null); setAiStep("idle"); setAiContext({ penggunaan: "", skalaPorsi: "" }); setYieldMode("direct"); setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); }}
              className="btn-accent"
              style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
            >
              + Tambah Bahan
            </button>
          ) : activeTab === 2 ? (
            <button
              onClick={() => { setSfgForm({ namaSemiFinished: "", satuanHasil: "gram", jumlahHasil: "1", outletId: outletList[0]?.id ?? "OUT-001" }); setShowAddSFG(true); }}
              className="btn-accent"
              style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
            >
              + Tambah Raw Menu
            </button>
          ) : activeTab === 4 ? (
            <button
              onClick={() => { setAddVariantBase(""); setShowAddMenu(true); setMenuForm({ namaMenu: "", kategori: "food", hargaJual: "", outletId: "OUT-001", channelType: "dine_in", platformFeePercent: "0" }); }}
              className="btn-accent"
              style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
            >
              + Tambah Menu
            </button>
          ) : null
        )}
      </div>

      {/* Stat Bar */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Master Bahan Baku" value={bahans.length} icon={Package} color="#60A5FA" />
        <StatCard label="Raw Menu" value={sfgList.length} icon={FlaskConical} color="#F59E0B" />
        <StatCard label="Bill of Materials" value={menuList.filter((m) => m.mappingResep && m.mappingResep.length > 0).length} icon={ClipboardList} color="#A78BFA" />
        <StatCard label="Master Menu Final" value={menuList.length} icon={UtensilsCrossed} color="#C8F135" />
      </div>

      {/* Tab Selector */}
      <div
        style={{
          background: `var(--color-os-row-hover)`,
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
            onClick={() => setActiveTab((i + 1) as 1 | 2 | 3 | 4)}
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
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={searchBahan}
              onChange={(e) => { setSearchBahan(e.target.value); setBahanPage(0); }}
              placeholder="Cari nama bahan atau ID..."
              style={{ flex: 1, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
            {isMobile && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className={`view-toggle-btn${bahanViewMode === "card" ? " active" : ""}`} onClick={() => setBahanViewMode("card")}>Cards</button>
                <button className={`view-toggle-btn${bahanViewMode === "table" ? " active" : ""}`} onClick={() => setBahanViewMode("table")}>Tabel</button>
              </div>
            )}
          </div>
          {isMobile && bahanViewMode === "card" ? (
            <div className="bahan-card-list">
              {pagedBahans.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  {searchBahan ? `Tidak ada bahan "${searchBahan}"` : `Belum ada bahan. Klik "Tambah Bahan" untuk memulai.`}
                </div>
              ) : pagedBahans.map((b) => (
                <div key={b.id} className="bahan-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{b.namaBahan}</span>
                    <Badge color={b.tipeBahan === "packaged" ? "blue" : "green"} size="sm">{b.tipeBahan}</Badge>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4B5563", marginBottom: 6 }}>{b.id}</div>
                  <div className="bahan-card-data-row">
                    {[
                      { label: "Kemasan", value: b.satuanBeli },
                      { label: "Dapur", value: b.satuanDapur },
                      { label: "Min.Stok", value: (() => { const f = formatMinStok(b.stokMinimum, parseFloat(b.isiSatuan), b.satuanDapur, b.satuanBeli); return f.secondary ? `${f.primary} (${f.secondary})` : f.primary; })() },
                      { label: "Harga", value: formatRupiah(parseFloat(b.hargaBeli)) },
                      { label: "Isi/Yield", value: formatYield(b.isiSatuan) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: `var(--color-os-card)`, borderRadius: 5, padding: "3px 7px", fontSize: 10 }}>
                        <span style={{ color: "#4B5563" }}>{label}: </span>
                        <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                    {b.hargaPerSatuanPorsi && parseFloat(b.hargaPerSatuanPorsi) > 0 && (
                      <div style={{ background: "rgba(200,241,53,0.08)", borderRadius: 5, padding: "3px 7px", fontSize: 10, border: "1px solid rgba(200,241,53,0.2)" }}>
                        <span style={{ color: "#4B5563" }}>Harga/Porsi: </span>
                        <span style={{ color: "#C8F135", fontWeight: 700 }}>{formatRupiah(parseFloat(b.hargaPerSatuanPorsi))}</span>
                      </div>
                    )}
                  </div>
                  {!isGuest && (
                    <div className="bahan-card-actions">
                      {isAdmin && (
                        <button onClick={() => { setRenameTarget({ id: b.id }); setRenameNewId(b.id); setRenameError(""); }} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.08)", color: "#C8F135", cursor: "pointer" }}>ID</button>
                      )}
                      <button onClick={() => openEdit(b)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDeleteBahan(b.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
          <div className="table-scroll-wrapper" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["ID", "Nama Bahan", "Tipe", "Kemasan Beli", "Satuan Dapur", "Min. Stok", "Harga Beli", "Isi/Yield", "Harga/Porsi", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama Bahan" ? "col-sticky-nama" : h === "ID" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBahans.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{searchBahan ? `Tidak ada bahan "${searchBahan}"` : `Belum ada bahan. Klik "Tambah Bahan" untuk memulai.`}</td></tr>
              ) : (
                pagedBahans.map((b) => (
                  <tr
                    key={b.id}
                    draggable
                    onDragStart={() => setDragBahanId(b.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverBahanId(b.id); }}
                    onDrop={() => handleBahanDrop(b.id)}
                    onDragEnd={() => { setDragBahanId(null); setDragOverBahanId(null); }}
                    className="table-row-hover"
                    style={{
                      borderBottom: "1px solid var(--color-os-border)",
                      background: dragOverBahanId === b.id && dragBahanId !== b.id ? "rgba(200,241,53,0.04)" : undefined,
                      opacity: dragBahanId === b.id ? 0.4 : 1,
                    }}
                  >
                    <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563", cursor: "grab" }}>⠿ {b.id}</td>
                    <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color={b.tipeBahan === "packaged" ? "blue" : "green"} size="sm">{b.tipeBahan}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.satuanBeli}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{b.satuanDapur}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>
                      {(() => {
                        const fmt = formatMinStok(b.stokMinimum, parseFloat(b.isiSatuan), b.satuanDapur, b.satuanBeli);
                        return <><span>{fmt.primary}</span>{fmt.secondary && <span style={{ display: "block", fontSize: 9, color: "#4B5563" }}>{fmt.secondary}</span>}</>;
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{formatRupiah(parseFloat(b.hargaBeli))}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{formatYield(b.isiSatuan)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#C8F135", fontWeight: 700 }}>
                      {b.hargaPerSatuanPorsi ? formatRupiah(parseFloat(b.hargaPerSatuanPorsi)) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {isGuest ? (
                        <span style={{ fontSize: 10, color: "#4B5563" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", gap: 4 }}>
                          {isAdmin && (
                            <button onClick={() => { setRenameTarget({ id: b.id }); setRenameNewId(b.id); setRenameError(""); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.08)", color: "#C8F135", cursor: "pointer" }}>ID</button>
                          )}
                          <button onClick={() => openEdit(b)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => handleDeleteBahan(b.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          )}
          {/* Pagination */}
          {filteredBahans.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>Baris per halaman:</span>
                {[20, 30, 40, 50].map(n => (
                  <button key={n} onClick={() => { setBahanRowsPerPage(n); setBahanPage(0); }}
                    style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${bahanRowsPerPage === n ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: bahanRowsPerPage === n ? "rgba(200,241,53,0.12)" : "transparent", color: bahanRowsPerPage === n ? "#C8F135" : "#4B5563", fontSize: 11, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>
                  {safeBahanPage * bahanRowsPerPage + 1}–{Math.min((safeBahanPage + 1) * bahanRowsPerPage, filteredBahans.length)} dari {filteredBahans.length}
                </span>
                <button onClick={() => setBahanPage(p => Math.max(0, p - 1))} disabled={safeBahanPage === 0}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeBahanPage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeBahanPage === 0 ? "default" : "pointer" }}>
                  ‹
                </button>
                <button onClick={() => setBahanPage(p => Math.min(Math.ceil(filteredBahans.length / bahanRowsPerPage) - 1, p + 1))} disabled={safeBahanPage >= Math.ceil(filteredBahans.length / bahanRowsPerPage) - 1}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeBahanPage >= Math.ceil(filteredBahans.length / bahanRowsPerPage) - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeBahanPage >= Math.ceil(filteredBahans.length / bahanRowsPerPage) - 1 ? "default" : "pointer" }}>
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2 — Raw Menu */}
      {activeTab === 2 && (() => {
        const filteredSFG = searchSFG ? sfgList.filter(s => s.namaSemiFinished.toLowerCase().includes(searchSFG.toLowerCase()) || s.id.toLowerCase().includes(searchSFG.toLowerCase())) : sfgList;
        const safeSfgPage = Math.min(sfgPage, Math.max(0, Math.ceil(filteredSFG.length / sfgRowsPerPage) - 1));
        const pagedSFG = filteredSFG.slice(safeSfgPage * sfgRowsPerPage, (safeSfgPage + 1) * sfgRowsPerPage);
        return (
          <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={searchSFG}
                onChange={(e) => { setSearchSFG(e.target.value); setSfgPage(0); }}
                placeholder="Cari nama raw menu atau ID..."
                style={{ flex: 1, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
              />
              {isMobile && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button className={`view-toggle-btn${sfgViewMode === "card" ? " active" : ""}`} onClick={() => setSfgViewMode("card")}>Cards</button>
                  <button className={`view-toggle-btn${sfgViewMode === "table" ? " active" : ""}`} onClick={() => setSfgViewMode("table")}>Tabel</button>
                </div>
              )}
            </div>
            {isMobile && sfgViewMode === "card" ? (
              <div className="sfg-card-list">
                {pagedSFG.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                    {searchSFG ? `Tidak ada raw menu "${searchSFG}"` : `Belum ada raw menu. Klik "+ Tambah Raw Menu".`}
                  </div>
                ) : pagedSFG.map(s => (
                  <div key={s.id} className="sfg-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", flex: 1, marginRight: 8 }}>{s.namaSemiFinished}</span>
                      {parseFloat(s.totalCogs) > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#C8F135", flexShrink: 0 }}>{formatRupiah(parseFloat(s.totalCogs))}</span>
                      )}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4B5563", marginBottom: 6 }}>{s.id}</div>
                    <div className="sfg-card-data-row">
                      {[
                        { label: "Satuan Hasil", value: s.satuanHasil || s.satuan },
                        { label: "Jumlah Hasil", value: parseFloat(s.jumlahHasil).toLocaleString("id-ID") },
                        { label: "COGS/Unit", value: parseFloat(s.cogsPerUnit) > 0 ? `${formatRupiah(parseFloat(s.cogsPerUnit))}/${s.satuanHasil || s.satuan}` : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: `var(--color-os-card)`, borderRadius: 5, padding: "3px 7px", fontSize: 10 }}>
                          <span style={{ color: "#4B5563" }}>{label}: </span>
                          <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {s.mappingResep && s.mappingResep.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0" }}>
                        {s.mappingResep.slice(0, 3).map((r, i) => (
                          <span key={i} style={{ fontSize: 9, padding: "2px 5px", background: `var(--color-os-row-hover)`, borderRadius: 4, color: "#9CA3AF" }}>
                            {r.bahan?.namaBahan || r.itemId} {r.qty}{r.bahan?.satuanDapur || ""}
                          </span>
                        ))}
                        {s.mappingResep.length > 3 && <span style={{ fontSize: 9, color: "#4B5563" }}>+{s.mappingResep.length - 3}</span>}
                      </div>
                    )}
                    {!isGuest && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => { setSelectedSFG(s); setSfgBomLines(s.mappingResep?.map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: parseFloat(r.qty) })) ?? []); setSfgBomSearches([]); setSfgBomOpenIdx(null); setShowSFGEditor(true); }}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}>
                          {s.mappingResep && s.mappingResep.length > 0 ? "Edit Resep" : "+ Buat Resep"}
                        </button>
                        <button onClick={() => { setEditSFG(s); setEditSFGForm({ namaSemiFinished: s.namaSemiFinished, satuanHasil: s.satuanHasil || s.satuan, jumlahHasil: s.jumlahHasil }); }}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDeleteSFG(s.id)}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: `var(--color-os-row-hover)` }}>
                    {["ID", "Nama Raw Menu", "Satuan Hasil", "Jumlah Hasil", "Komposisi", "Total COGS", "COGS/Unit", "Aksi"].map(h => (
                      <th key={h} className={h === "Nama Raw Menu" ? "col-sticky-nama" : h === "ID" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSFG.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{searchSFG ? `Tidak ada raw menu "${searchSFG}"` : `Belum ada raw menu. Klik "+ Tambah Raw Menu".`}</td></tr>
                  ) : pagedSFG.map(s => (
                    <tr key={s.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                      <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{s.id}</td>
                      <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{s.namaSemiFinished}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{s.satuanHasil || s.satuan}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{parseFloat(s.jumlahHasil).toLocaleString("id-ID")}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {s.mappingResep && s.mappingResep.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {s.mappingResep.slice(0, 3).map((r, i) => (
                              <span key={i} style={{ fontSize: 9, padding: "2px 5px", background: `var(--color-os-row-hover)`, borderRadius: 4, color: "#9CA3AF" }}>
                                {r.bahan?.namaBahan || r.itemId} {r.qty}{r.bahan?.satuanDapur || ""}
                              </span>
                            ))}
                            {s.mappingResep.length > 3 && <span style={{ fontSize: 9, color: "#4B5563" }}>+{s.mappingResep.length - 3}</span>}
                          </div>
                        ) : <span style={{ fontSize: 10, color: "#374151" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: parseFloat(s.totalCogs) > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                        {parseFloat(s.totalCogs) > 0 ? formatRupiah(parseFloat(s.totalCogs)) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: parseFloat(s.cogsPerUnit) > 0 ? "#F59E0B" : "#4B5563", fontWeight: 700 }}>
                        {parseFloat(s.cogsPerUnit) > 0 ? `${formatRupiah(parseFloat(s.cogsPerUnit))} /${s.satuanHasil || s.satuan}` : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {!isGuest && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => {
                                setSelectedSFG(s);
                                setSfgBomLines(s.mappingResep?.map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: parseFloat(r.qty) })) ?? []);
                                setSfgBomSearches([]);
                                setSfgBomOpenIdx(null);
                                setShowSFGEditor(true);
                              }}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}
                            >
                              {s.mappingResep && s.mappingResep.length > 0 ? "Edit Resep" : "+ Buat Resep"}
                            </button>
                            <button onClick={() => { setEditSFG(s); setEditSFGForm({ namaSemiFinished: s.namaSemiFinished, satuanHasil: s.satuanHasil || s.satuan, jumlahHasil: s.jumlahHasil }); }}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                            <button onClick={() => handleDeleteSFG(s.id)}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>Hapus</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {filteredSFG.length > 0 && (
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#4B5563" }}>Baris per halaman:</span>
                  {[20, 30, 40, 50].map(n => (
                    <button key={n} onClick={() => { setSfgRowsPerPage(n); setSfgPage(0); }}
                      style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${sfgRowsPerPage === n ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: sfgRowsPerPage === n ? "rgba(200,241,53,0.12)" : "transparent", color: sfgRowsPerPage === n ? "#C8F135" : "#4B5563", fontSize: 11, cursor: "pointer" }}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#4B5563" }}>
                    {safeSfgPage * sfgRowsPerPage + 1}–{Math.min((safeSfgPage + 1) * sfgRowsPerPage, filteredSFG.length)} dari {filteredSFG.length}
                  </span>
                  <button onClick={() => setSfgPage(p => Math.max(0, p - 1))} disabled={safeSfgPage === 0}
                    style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeSfgPage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeSfgPage === 0 ? "default" : "pointer" }}>‹</button>
                  <button onClick={() => setSfgPage(p => Math.min(Math.ceil(filteredSFG.length / sfgRowsPerPage) - 1, p + 1))} disabled={safeSfgPage >= Math.ceil(filteredSFG.length / sfgRowsPerPage) - 1}
                    style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeSfgPage >= Math.ceil(filteredSFG.length / sfgRowsPerPage) - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeSfgPage >= Math.ceil(filteredSFG.length / sfgRowsPerPage) - 1 ? "default" : "pointer" }}>›</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 3 — Master Resep */}
      {activeTab === 3 && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={searchResep}
              onChange={(e) => { setSearchResep(e.target.value); setResepPage(0); }}
              placeholder="Cari nama menu atau ID..."
              style={{ flex: 1, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
            {isMobile && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className={`view-toggle-btn${resepViewMode === "card" ? " active" : ""}`} onClick={() => setResepViewMode("card")}>Cards</button>
                <button className={`view-toggle-btn${resepViewMode === "table" ? " active" : ""}`} onClick={() => setResepViewMode("table")}>Tabel</button>
              </div>
            )}
          </div>
          {isMobile && resepViewMode === "card" ? (
            <div className="resep-card-list">
              {pagedResep.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  {searchResep ? `Tidak ada menu "${searchResep}"` : `Belum ada menu. Tambahkan dari tab Master Menu.`}
                </div>
              ) : pagedResep.map((m) => (
                <div key={m.id} className="resep-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", flex: 1, marginRight: 8 }}>{m.namaMenu}</span>
                    {parseFloat(m.totalCogs ?? "0") > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#C8F135", flexShrink: 0 }}>{formatRupiah(parseFloat(m.totalCogs ?? "0"))}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4B5563" }}>{m.id}</span>
                    {m.outletId && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `var(--color-os-row-hover)`, color: "#6B7280" }}>{m.outletId}</span>}
                  </div>
                  {m.mappingResep && m.mappingResep.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {m.mappingResep.map((r) => (
                        <span key={r.id} style={{ fontSize: 9, padding: "2px 6px", background: `var(--color-os-row-hover)`, borderRadius: 4, color: "#E2E8F0" }}>
                          {r.bahan?.namaBahan} {r.qty}{r.bahan?.satuanDapur}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button
                      onClick={() => { setSelectedMenu(m); setBomLines(m.mappingResep?.map((r) => ({ itemType: (r.bahan?.kategoriBahan === "Kemasan & Alat Makan" ? "kemasan" : (r.itemType ?? "bahan_dasar")) as "bahan_dasar" | "semi_finished" | "kemasan", itemId: r.itemId ?? "", qty: parseFloat(r.qty) })) ?? []); setBomHargaJual(m.hargaJual ?? ""); setBomSearches([]); setBomOpenIdx(null); setShowBOMEditor(true); }}
                      style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}>
                      {m.mappingResep && m.mappingResep.length > 0 ? "Edit Resep" : "+ Buat Resep"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                {["ID Menu", "Nama Menu", "Outlet", "Komposisi", "Total COGS", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama Menu" ? "col-sticky-nama" : h === "ID Menu" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResep.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{searchResep ? `Tidak ada menu "${searchResep}"` : `Belum ada menu. Tambahkan dari tab Master Menu.`}</td></tr>
              ) : (
                pagedResep.map((m) => (
                  <tr
                    key={m.id}
                    draggable
                    onDragStart={() => setDragResepId(m.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverResepId(m.id); }}
                    onDrop={() => handleResepDrop(m.id)}
                    onDragEnd={() => { setDragResepId(null); setDragOverResepId(null); }}
                    className="table-row-hover"
                    style={{
                      borderBottom: "1px solid var(--color-os-border)",
                      background: dragOverResepId === m.id && dragResepId !== m.id ? "rgba(200,241,53,0.04)" : undefined,
                      opacity: dragResepId === m.id ? 0.4 : 1,
                    }}
                  >
                    <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563", cursor: "grab" }}>⠿ {m.id}</td>
                    <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{m.namaMenu}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{m.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {m.mappingResep && m.mappingResep.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {m.mappingResep.map((r) => (
                            <span key={r.id} style={{ fontSize: 10, padding: "2px 6px", background: `var(--color-os-row-hover)`, borderRadius: 4, color: "#E2E8F0" }}>
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
          )}
          {/* Pagination Resep */}
          {filteredResep.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>Baris per halaman:</span>
                {[20, 30, 40, 50].map(n => (
                  <button key={n} onClick={() => { setResepRowsPerPage(n); setResepPage(0); }}
                    style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${resepRowsPerPage === n ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: resepRowsPerPage === n ? "rgba(200,241,53,0.12)" : "transparent", color: resepRowsPerPage === n ? "#C8F135" : "#4B5563", fontSize: 11, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>
                  {safeResepPage * resepRowsPerPage + 1}–{Math.min((safeResepPage + 1) * resepRowsPerPage, filteredResep.length)} dari {filteredResep.length}
                </span>
                <button onClick={() => setResepPage(p => Math.max(0, p - 1))} disabled={safeResepPage === 0}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeResepPage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeResepPage === 0 ? "default" : "pointer" }}>‹</button>
                <button onClick={() => setResepPage(p => Math.min(Math.ceil(filteredResep.length / resepRowsPerPage) - 1, p + 1))} disabled={safeResepPage >= Math.ceil(filteredResep.length / resepRowsPerPage) - 1}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeResepPage >= Math.ceil(filteredResep.length / resepRowsPerPage) - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeResepPage >= Math.ceil(filteredResep.length / resepRowsPerPage) - 1 ? "default" : "pointer" }}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4 — Master Menu */}
      {activeTab === 4 && (
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={searchMenu}
              onChange={(e) => { setSearchMenu(e.target.value); setMenuPage(0); }}
              placeholder="Cari nama menu atau ID..."
              style={{ flex: 1, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
            />
            {isMobile && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className={`view-toggle-btn${menuViewMode === "card" ? " active" : ""}`} onClick={() => setMenuViewMode("card")}>Cards</button>
                <button className={`view-toggle-btn${menuViewMode === "table" ? " active" : ""}`} onClick={() => setMenuViewMode("table")}>Tabel</button>
              </div>
            )}
          </div>
          {isMobile && menuViewMode === "card" ? (
            <div className="menu-group-card-list">
              {pagedMenuGroups.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>
                  {searchMenu ? `Tidak ada menu "${searchMenu}"` : `Belum ada menu. Klik "+ Tambah Menu" untuk memulai.`}
                </div>
              ) : pagedMenuGroups.map(([baseName, variants]) => {
                const isExpanded = expandedGroups.has(baseName);
                const toggle = () => setExpandedGroups(prev => {
                  const next = new Set(prev);
                  next.has(baseName) ? next.delete(baseName) : next.add(baseName);
                  return next;
                });
                return (
                  <div key={baseName} className="menu-group-card">
                    <div className="menu-group-card-header" onClick={toggle}>
                      <span style={{ color: "#C8F135", fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", flex: 1 }}>{baseName}</span>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "rgba(200,241,53,0.1)", color: "#C8F135", border: "1px solid rgba(200,241,53,0.2)" }}>
                        {variants.length} channel
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="menu-group-card-channels">
                        {variants.map((m) => {
                          const cogs = parseFloat(m.totalCogs ?? "0");
                          const hj = parseFloat(m.hargaJual ?? "0");
                          const fee = parseFloat(m.platformFeePercent ?? "0");
                          const feeAmount = hj * fee / 100;
                          const netRevenue = hj - feeAmount;
                          const margin = netRevenue > 0 && cogs > 0 ? ((netRevenue - cogs) / netRevenue * 100) : null;
                          const marginColor = margin === null ? "#4B5563" : margin >= 65 ? "#22C55E" : margin >= 40 ? "#F59E0B" : "#EF4444";
                          const chType = inferChannelType(m);
                          return (
                            <div key={m.id} className="menu-channel-row">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>
                                  {getChannelIcon(chType)} {getChannelLabel(chType)}
                                  {fee > 0 && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>fee {fee}%</span>}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: marginColor }}>{margin !== null ? `${margin.toFixed(1)}%` : "—"}</span>
                              </div>
                              <div className="menu-channel-detail-row" style={{ fontSize: 10, color: "#4B5563", marginTop: 3 }}>
                                <span>COGS: <span style={{ color: "#C8F135" }}>{formatRupiah(cogs)}</span></span>
                                <span>Jual: <span style={{ color: "#E2E8F0" }}>{hj > 0 ? formatRupiah(hj) : "—"}</span></span>
                                {fee > 0 && <span>Fee: <span style={{ color: "#F59E0B" }}>{formatRupiah(feeAmount)}</span></span>}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <button
                                  onClick={() => {
                                    setSelectedMenu(m);
                                    setBomLines(m.mappingResep?.map((r) => ({ itemType: (r.bahan?.kategoriBahan === "Kemasan & Alat Makan" ? "kemasan" : (r.itemType ?? "bahan_dasar")) as "bahan_dasar" | "semi_finished" | "kemasan", itemId: r.itemId ?? "", qty: parseFloat(r.qty) })) ?? []);
                                    setBomHargaJual(m.hargaJual ?? "");
                                    setBomSearches([]);
                                    setBomOpenIdx(null);
                                    setShowBOMEditor(true);
                                  }}
                                  style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.1)", color: "#C8F135", cursor: "pointer" }}
                                >
                                  {m.mappingResep && m.mappingResep.length > 0 ? "Edit Resep" : "+ Buat Resep"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="menu-group-card-footer">
                      <button
                        onClick={() => {
                          setAddVariantBase(baseName);
                          setMenuForm(f => ({ ...f, namaMenu: baseName, channelType: "dine_in", platformFeePercent: "0" }));
                          setShowAddMenu(true);
                        }}
                        style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(200,241,53,0.3)", background: "rgba(200,241,53,0.08)", color: "#C8F135", cursor: "pointer" }}
                      >
                        + Variant
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="table-scroll-wrapper" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `var(--color-os-row-hover)` }}>
                <th className="col-hide-mobile" style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-os-border)", width: 24 }} />
                {["ID Menu", "Nama / Channel", "Kategori", "Outlet", "Recipe", "Total COGS", "Harga Jual", "Margin", "Aksi"].map((h) => (
                  <th key={h} className={h === "Nama / Channel" ? "col-sticky-nama" : h === "ID Menu" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>
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
                pagedMenuGroups.flatMap(([baseName, variants]) => {
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
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); setDragGroupBase(baseName); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverGroupBase(baseName); }}
                      onDrop={(e) => { e.stopPropagation(); handleGroupDrop(baseName); }}
                      onDragEnd={() => { setDragGroupBase(null); setDragOverGroupBase(null); }}
                      className="table-row-hover"
                      onClick={toggle}
                      style={{
                        borderBottom: "1px solid var(--color-os-border)",
                        cursor: "grab",
                        background: dragOverGroupBase === baseName && dragGroupBase !== baseName ? "rgba(200,241,53,0.06)" : "#0F0F1A",
                        opacity: dragGroupBase === baseName ? 0.4 : 1,
                      }}
                    >
                      <td style={{ padding: "10px 8px", color: "#C8F135", fontSize: 14, textAlign: "center" }}>
                        {isExpanded ? "▾" : "▸"}
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "10px 8px", color: "#374151", fontSize: 14, textAlign: "center" }}>⠿</td>
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
                            borderBottom: "1px solid var(--color-os-border)",
                            background: dragOverMenuId === m.id && dragMenuId !== m.id ? "rgba(200,241,53,0.04)" : `var(--color-os-card)`,
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
          )}
          {/* Pagination Menu */}
          {menuGroups.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>Baris per halaman:</span>
                {[20, 30, 40, 50].map(n => (
                  <button key={n} onClick={() => { setMenuRowsPerPage(n); setMenuPage(0); }}
                    style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${menuRowsPerPage === n ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: menuRowsPerPage === n ? "rgba(200,241,53,0.12)" : "transparent", color: menuRowsPerPage === n ? "#C8F135" : "#4B5563", fontSize: 11, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>
                  {safeMenuPage * menuRowsPerPage + 1}–{Math.min((safeMenuPage + 1) * menuRowsPerPage, menuGroups.length)} dari {menuGroups.length} grup
                </span>
                <button onClick={() => setMenuPage(p => Math.max(0, p - 1))} disabled={safeMenuPage === 0}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeMenuPage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeMenuPage === 0 ? "default" : "pointer" }}>‹</button>
                <button onClick={() => setMenuPage(p => Math.min(Math.ceil(menuGroups.length / menuRowsPerPage) - 1, p + 1))} disabled={safeMenuPage >= Math.ceil(menuGroups.length / menuRowsPerPage) - 1}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: safeMenuPage >= Math.ceil(menuGroups.length / menuRowsPerPage) - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safeMenuPage >= Math.ceil(menuGroups.length / menuRowsPerPage) - 1 ? "default" : "pointer" }}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah Bahan */}
      {showAddBahan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 520, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Bahan Baku</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* 1. Nama Bahan */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Bahan *</label>
                  <input type="text" value={form.namaBahan} onChange={(e) => setForm(f => ({ ...f, namaBahan: e.target.value }))}
                    placeholder="Cth: Stok Makanan - Beras"
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                </div>

                {/* 2. Tipe Bahan — card selector */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>Tipe Bahan *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {([
                      { value: "packaged", label: "📦 Packaged", desc: "Produk kemasan, minuman, item satuan" },
                      { value: "raw_bulk", label: "🌾 Raw Bulk", desc: "Bahan curah, yield dihitung pakai AI" },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, tipeBahan: opt.value }));
                          setWiz({ step: 1, metode: "", loadingQ: false, questions: [], answers: {}, running: false, result: null });
                        }}
                        style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                          border: `1px solid ${form.tipeBahan === opt.value ? (opt.value === "raw_bulk" ? "rgba(200,241,53,0.5)" : "rgba(96,165,250,0.5)") : "#2D2D44"}`,
                          background: form.tipeBahan === opt.value ? (opt.value === "raw_bulk" ? "rgba(200,241,53,0.07)" : "rgba(96,165,250,0.07)") : "transparent" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: form.tipeBahan === opt.value ? (opt.value === "raw_bulk" ? "#C8F135" : "#60A5FA") : "#6B7280" }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3a. PACKAGED — standard fields */}
                {form.tipeBahan === "packaged" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Satuan Dapur", key: "satuanDapur", placeholder: "gram" },
                      { label: "Kemasan Beli", key: "satuanBeli", placeholder: "1_karung" },
                      { label: "Min. Stok *", key: "stokMinimum", placeholder: "5000", type: "number" },
                      { label: "Harga Beli (Rp) *", key: "hargaBeli", placeholder: "610000", type: "number" },
                      { label: "Isi Kemasan (Yield) *", key: "isiSatuan", placeholder: "50000", type: "number" },
                      { label: "Lead Time (hari)", key: "leadTimeDays", placeholder: "1", type: "number" },
                    ].map(({ label, key, placeholder, type }: { label: string; key: string; placeholder: string; type?: string }) => (
                      <div key={key}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#4B5563", textTransform: "uppercase" }}>{label}</label>
                          {key === "stokMinimum" && (
                            <div style={{ display: "flex", gap: 2 }}>
                              {(["satuanDapur", "kemasan"] as const).map(m => (
                                <button key={m} type="button" onClick={() => setStokMinimumMode(m)}
                                  style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, cursor: "pointer", border: `1px solid ${stokMinimumMode === m ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: stokMinimumMode === m ? "rgba(200,241,53,0.12)" : "transparent", color: stokMinimumMode === m ? "#C8F135" : "#4B5563" }}>
                                  {m === "satuanDapur" ? form.satuanDapur || "unit" : form.satuanBeli || "kemasan"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input type={type ?? "text"} value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                        {key === "stokMinimum" && form.isiSatuan && parseFloat(form.isiSatuan) > 0 && form.stokMinimum && (
                          <div style={{ fontSize: 10, color: "#4B5563", marginTop: 3 }}>
                            {stokMinimumMode === "satuanDapur"
                              ? `≈ ${Math.ceil(parseFloat(form.stokMinimum) / parseFloat(form.isiSatuan))} ${form.satuanBeli || "kemasan"}`
                              : `= ${Math.round(parseFloat(form.stokMinimum) * parseFloat(form.isiSatuan))} ${form.satuanDapur || "unit"}`}
                          </div>
                        )}
                        {key === "satuanDapur" && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                            {["gram","ml","liter","kg","porsi","gelas","pcs","pack","lembar","buah"].map(u => (
                              <button key={u} type="button" onClick={() => setForm(f => ({ ...f, satuanDapur: u }))}
                                style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, cursor: "pointer",
                                  border: `1px solid ${form.satuanDapur === u ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
                                  background: form.satuanDapur === u ? "rgba(200,241,53,0.12)" : "transparent",
                                  color: form.satuanDapur === u ? "#C8F135" : "#6B7280" }}>{u}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3b. RAW BULK — AI Wizard */}
                {form.tipeBahan === "raw_bulk" && (
                  <div style={{ background: "rgba(200,241,53,0.04)", border: "1px solid rgba(200,241,53,0.2)", borderRadius: 10, overflow: "hidden" }}>
                    {/* Wizard header */}
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(200,241,53,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#C8F135", fontWeight: 700, letterSpacing: 1 }}>✦ AI WIZARD</span>
                        <span style={{ fontSize: 10, color: "#4B5563" }}>Bantu isi data bahan curah</span>
                      </div>
                      {/* Progress dots */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1,2].map(s => (
                          <div key={s} style={{ width: 6, height: 6, borderRadius: "50%",
                            background: wiz.result ? "#C8F135" : wiz.step >= s ? "#C8F135" : "#2D2D44" }} />
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: 16 }}>
                      {/* Step 1: Harga & Kemasan */}
                      {wiz.step === 1 && !wiz.result && (
                        <div>
                          <div style={{ fontSize: 12, color: "#E2E8F0", fontWeight: 600, marginBottom: 12 }}>
                            💬 {form.namaBahan ? `"${form.namaBahan}"` : "Bahan ini"} dibeli dengan harga berapa dan kemasan apa?
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Harga Beli (Rp) *</label>
                              <input type="number" value={form.hargaBeli} onChange={e => setForm(f => ({ ...f, hargaBeli: e.target.value }))}
                                placeholder="665000"
                                style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kemasan Beli *</label>
                              <input type="text" value={form.satuanBeli} onChange={e => setForm(f => ({ ...f, satuanBeli: e.target.value }))}
                                placeholder="1_karung_50kg"
                                style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                                {["1_karung","1_ember","1_botol","1_pack","1_kg","1_liter"].map(u => (
                                  <button key={u} type="button" onClick={() => setForm(f => ({ ...f, satuanBeli: u }))}
                                    style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, cursor: "pointer",
                                      border: `1px solid ${form.satuanBeli === u ? "rgba(200,241,53,0.5)" : "#2D2D44"}`,
                                      background: form.satuanBeli === u ? "rgba(200,241,53,0.12)" : "transparent",
                                      color: form.satuanBeli === u ? "#C8F135" : "#6B7280" }}>{u}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button type="button"
                            disabled={!form.hargaBeli || !form.satuanBeli || !form.namaBahan || wiz.loadingQ}
                            onClick={async () => {
                              if (!form.hargaBeli || !form.satuanBeli || !form.namaBahan) return;
                              setWiz(w => ({ ...w, loadingQ: true, questions: [], answers: {}, metode: "" }));
                              try {
                                const r = await generateProductionQuestions(
                                  form.namaBahan, form.satuanBeli, parseNum(form.hargaBeli) || undefined
                                );
                                setWiz(w => ({ ...w, loadingQ: false, questions: r.questions, metode: r.metode, step: 2 }));
                              } catch { setWiz(w => ({ ...w, loadingQ: false, step: 2 })); }
                            }}
                            style={{ width: "100%", padding: "9px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700,
                              background: form.hargaBeli && form.satuanBeli && form.namaBahan && !wiz.loadingQ ? "rgba(200,241,53,0.2)" : "rgba(255,255,255,0.03)",
                              color: form.hargaBeli && form.satuanBeli && form.namaBahan && !wiz.loadingQ ? "#C8F135" : "#374151",
                              cursor: form.hargaBeli && form.satuanBeli && form.namaBahan && !wiz.loadingQ ? "pointer" : "not-allowed" }}>
                            {wiz.loadingQ ? "✦ AI sedang menganalisa bahan..." : "✦ Analisa dengan AI → Buat Pertanyaan"}
                          </button>
                        </div>
                      )}

                      {/* Step 2: AI-generated production questions */}
                      {wiz.step === 2 && !wiz.result && (
                        <div>
                          <div style={{ fontSize: 12, color: "#E2E8F0", fontWeight: 600, marginBottom: 4 }}>
                            📋 Spesifikasi Produksi {form.namaBahan ? `"${form.namaBahan}"` : ""}
                          </div>
                          {wiz.metode && (
                            <div style={{ fontSize: 10, color: "#C8F135", marginBottom: 10, padding: "5px 10px", background: "rgba(200,241,53,0.07)", borderRadius: 5, display: "inline-block" }}>
                              ✦ AI: {wiz.metode}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 14 }}>
                            Jawab sesuai cara kerja dapur kamu untuk hasil estimasi yang akurat
                          </div>

                          {wiz.questions.length === 0 ? (
                            <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", padding: "12px 0" }}>Memuat pertanyaan...</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                              {wiz.questions.map((q, i) => (
                                <div key={q.id}>
                                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>
                                    {i + 1}. {q.question}
                                  </label>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                      type={q.type === "number" ? "number" : "text"}
                                      min={q.type === "number" ? 0 : undefined}
                                      value={wiz.answers[q.id] ?? ""}
                                      onChange={e => setWiz(w => ({ ...w, answers: { ...w.answers, [q.id]: e.target.value } }))}
                                      placeholder={q.placeholder ?? ""}
                                      style={{ flex: 1, background: `var(--color-os-surface)`,
                                        border: `1px solid ${wiz.answers[q.id] ? "#F59E0B" : "#2D2D44"}`,
                                        borderRadius: 7, padding: "8px 10px", fontSize: 13, color: "#E2E8F0", outline: "none",
                                        fontWeight: wiz.answers[q.id] ? 700 : 400 }}
                                    />
                                    {q.unit && <span style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", minWidth: 36 }}>{q.unit}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => setWiz(w => ({ ...w, step: 1 }))}
                              style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid var(--color-os-border2)", background: "transparent", color: "#6B7280", fontSize: 11, cursor: "pointer" }}>
                              ← Kembali
                            </button>
                            <button type="button"
                              disabled={wiz.running || wiz.questions.length === 0}
                              onClick={async () => {
                                setWiz(w => ({ ...w, running: true }));
                                try {
                                  const r = await estimateFromWizardAnswers(
                                    form.namaBahan, parseNum(form.hargaBeli),
                                    form.satuanBeli, wiz.metode, wiz.questions, wiz.answers
                                  );
                                  setWiz(w => ({ ...w, running: false, result: r }));
                                  if (r.isiSatuan) setForm(f => ({ ...f, isiSatuan: String(r.isiSatuan), satuanDapur: r.satuanDapur }));
                                } catch { setWiz(w => ({ ...w, running: false })); }
                              }}
                              style={{ flex: 2, padding: "9px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700,
                                background: wiz.running ? "rgba(200,241,53,0.05)" : "rgba(200,241,53,0.2)",
                                color: "#C8F135", cursor: wiz.running ? "not-allowed" : "pointer" }}>
                              {wiz.running ? "⏳ AI sedang menghitung..." : "✦ Hitung dengan AI"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Result */}
                      {wiz.result && (
                        <div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 7 }}>
                              <div style={{ fontSize: 9, color: "#4B5563", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Estimasi Porsi / Kemasan</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#C8F135" }}>{wiz.result.estimasiPorsiPerKemasan ?? "—"} <span style={{ fontSize: 12 }}>porsi</span></div>
                            </div>
                            <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 7 }}>
                              <div style={{ fontSize: 9, color: "#4B5563", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Harga per Porsi</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>Rp {wiz.result.hargaPerPorsi?.toLocaleString("id-ID") ?? "—"}</div>
                            </div>
                            {wiz.result.gramPerAlat && (
                              <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 7 }}>
                                <div style={{ fontSize: 10, color: "#6B7280" }}>
                                  Ukuran satuan ≈ <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{wiz.result.gramPerAlat} {wiz.result.satuanDapur}</span>
                                  {" · "}Total kemasan: <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{wiz.result.isiSatuan?.toLocaleString("id-ID")} {wiz.result.satuanDapur}</span>
                                </div>
                              </div>
                            )}
                            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9CA3AF", fontStyle: "italic", lineHeight: 1.7 }}>{wiz.result.narasi}</div>
                          </div>
                          <div style={{ display: "flex", gap: 7 }}>
                            <button type="button" onClick={() => setWiz(w => ({ ...w, step: 1, result: null, metode: "", questions: [], answers: {} }))}
                              style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid var(--color-os-border2)", background: "transparent", color: "#6B7280", fontSize: 11, cursor: "pointer" }}>
                              ↺ Hitung Ulang
                            </button>
                            <div style={{ flex: 2, padding: "7px 10px", background: "rgba(200,241,53,0.07)", border: "1px solid rgba(200,241,53,0.2)", borderRadius: 6, fontSize: 10, color: "#6B7280" }}>
                              ✓ <span style={{ color: "#C8F135" }}>Isi Kemasan & Satuan Dapur telah diisi otomatis</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Min Stok & Lead Time always visible for raw_bulk */}
                    <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(200,241,53,0.1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Min. Stok *", key: "stokMinimum", placeholder: "5000" },
                        { label: "Lead Time (hari)", key: "leadTimeDays", placeholder: "1" },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#4B5563", textTransform: "uppercase" }}>{label}</label>
                            {key === "stokMinimum" && (
                              <div style={{ display: "flex", gap: 2 }}>
                                {(["satuanDapur", "kemasan"] as const).map(m => (
                                  <button key={m} type="button" onClick={() => setStokMinimumMode(m)}
                                    style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, cursor: "pointer", border: `1px solid ${stokMinimumMode === m ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: stokMinimumMode === m ? "rgba(200,241,53,0.12)" : "transparent", color: stokMinimumMode === m ? "#C8F135" : "#4B5563" }}>
                                    {m === "satuanDapur" ? form.satuanDapur || "unit" : form.satuanBeli || "kemasan"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <input type="number" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                          {key === "stokMinimum" && form.isiSatuan && parseFloat(form.isiSatuan) > 0 && form.stokMinimum && (
                            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 3 }}>
                              {stokMinimumMode === "satuanDapur"
                                ? `≈ ${Math.ceil(parseFloat(form.stokMinimum) / parseFloat(form.isiSatuan))} ${form.satuanBeli || "kemasan"}`
                                : `= ${Math.round(parseFloat(form.stokMinimum) * parseFloat(form.isiSatuan))} ${form.satuanDapur || "unit"}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Kategori & Outlet */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori Produk</label>
                    <select value={form.kategoriBahan} onChange={e => setForm(f => ({ ...f, kategoriBahan: e.target.value }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: form.kategoriBahan ? "#E2E8F0" : "#4B5563", outline: "none" }}>
                      <option value="">— Pilih Kategori —</option>
                      {["Main Course","Snack","Dessert","Ice Cream","Noodles","Beverage","Kemasan & Alat Makan"].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    {form.kategoriBahan && (
                      <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>ID prefix: <span style={{ color: "#C8F135", fontWeight: 700 }}>{({"Main Course":"MCR","Snack":"SNK","Dessert":"DST","Ice Cream":"ICE","Noodles":"NDL","Beverage":"BEV","Kemasan & Alat Makan":"KMS"} as Record<string,string>)[form.kategoriBahan] ?? "BHN"}-XXX</span></div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Outlet</label>
                    <select value={form.outletId} onChange={e => setForm(f => ({ ...f, outletId: e.target.value }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}>
                      <option value="">— Semua Outlet —</option>
                      {outletList.map(o => <option key={o.id} value={o.id}>{o.namaOutlet}</option>)}
                    </select>
                  </div>
                </div>

                {/* 5. Vendor */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Vendor / Supplier</label>
                  <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: form.vendorId ? "#E2E8F0" : "#4B5563", outline: "none" }}>
                    <option value="">— Tidak ada vendor —</option>
                    {vendorList.map(v => <option key={v.id} value={v.id}>{v.namaVendor}</option>)}
                  </select>
                  {form.vendorId && <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>Bahan akan otomatis ter-sync ke halaman Suppliers</div>}
                </div>
              </div>
              {/* AI Research Panel — superseded by wizard above */}
              {false && form.tipeBahan === "raw_bulk" && (
                <div style={{ marginTop: 16, padding: 16, background: "rgba(200,241,53,0.05)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 8 }}>
                  {yieldMode !== "porsi" && (<>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#C8F135", fontWeight: 700, letterSpacing: 1 }}>✦ AI RESEARCH</span>
                      <span style={{ fontSize: 10, color: "#4B5563" }}>Estimasi Yield Bahan</span>
                    </div>
                    {aiStep === "idle" ? (
                      <button onClick={handleEstimateYield} disabled={!form.namaBahan || !form.isiSatuan}
                        style={{ fontSize: 11, padding: "5px 12px", border: "1px solid rgba(200,241,53,0.4)", borderRadius: 6,
                          background: "rgba(200,241,53,0.1)", color: "#C8F135",
                          cursor: !form.namaBahan || !form.isiSatuan ? "not-allowed" : "pointer",
                          opacity: !form.namaBahan || !form.isiSatuan ? 0.5 : 1 }}>
                        🔍 Hitung Estimasi Yield
                      </button>
                    ) : (
                      <button onClick={() => { setAiStep("idle"); setAiEstimation(null); setAiContext({ penggunaan: "", skalaPorsi: "" }); }}
                        style={{ fontSize: 11, padding: "5px 12px", border: "1px solid rgba(75,85,99,0.4)", borderRadius: 6,
                          background: "transparent", color: "#6B7280", cursor: "pointer" }}>
                        ✕ Ulangi
                      </button>
                    )}
                  </div>

                  {/* Step: idle — placeholder */}
                  {aiStep === "idle" && (
                    <div style={{ fontSize: 11, color: "#4B5563", textAlign: "center", padding: "8px 0" }}>
                      Isi nama bahan &amp; isi kemasan, lalu klik "Hitung Estimasi Yield"
                    </div>
                  )}

                  {/* Step: questions */}
                  {aiStep === "questions" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 6, fontWeight: 600 }}>
                          1. Bahan ini digunakan untuk?
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {["Menu utama (nasi/lauk)", "Minuman", "Dessert / kue", "Camilan / snack", "Bumbu / pelengkap"].map(opt => (
                            <button key={opt} type="button"
                              onClick={() => setAiContext(c => ({ ...c, penggunaan: opt }))}
                              style={{ padding: "4px 10px", fontSize: 10, borderRadius: 20, cursor: "pointer",
                                border: `1px solid ${aiContext.penggunaan === opt ? "#C8F135" : "#2D2D44"}`,
                                background: aiContext.penggunaan === opt ? "rgba(200,241,53,0.12)" : "transparent",
                                color: aiContext.penggunaan === opt ? "#C8F135" : "#6B7280" }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      {aiContext.penggunaan && (
                        <div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 6, fontWeight: 600 }}>
                            2. Porsi untuk skala apa?
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {["Restoran (standar)", "Kafe / coffee shop", "Warung / catering"].map(opt => (
                              <button key={opt} type="button"
                                onClick={() => {
                                  const ctx = { ...aiContext, skalaPorsi: opt };
                                  setAiContext(ctx);
                                  runEstimation(ctx);
                                }}
                                style={{ padding: "4px 10px", fontSize: 10, borderRadius: 20, cursor: "pointer",
                                  border: `1px solid ${aiContext.skalaPorsi === opt ? "#60A5FA" : "#2D2D44"}`,
                                  background: aiContext.skalaPorsi === opt ? "rgba(96,165,250,0.12)" : "transparent",
                                  color: aiContext.skalaPorsi === opt ? "#60A5FA" : "#6B7280" }}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step: loading */}
                  {estimating && (
                    <div style={{ fontSize: 11, color: "#C8F135", textAlign: "center", padding: "10px 0" }}>
                      ⏳ AI sedang menganalisis...
                    </div>
                  )}

                  {/* Step: result */}
                  {aiStep === "result" && aiEstimation && !estimating && (() => {
                    const est = aiEstimation!;
                    return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Harga Pasar</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#C8F135" }}>{est.hargaPasarFormatted}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Estimasi Porsi / Kemasan</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>±{est.estimasiPorsiPerKemasan ?? "?"} porsi</div>
                        {est.namaMenuContoh && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{est.namaMenuContoh}</div>}
                      </div>
                      <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, fontStyle: "italic" }}>{est.narasi}</div>
                      {est.error && <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#F59E0B" }}>⚠ {est.error}</div>}
                      <div style={{ gridColumn: "1 / -1", fontSize: 9, color: "#374151" }}>Konteks: {aiContext.penggunaan} · {aiContext.skalaPorsi}</div>
                    </div>
                    );
                  })()}
                  </>)}

                  {/* Yield Mode Calculator */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", gap: 3, marginBottom: 10, background: `var(--color-os-surface)`, borderRadius: 6, padding: 3 }}>
                      <button type="button" onClick={() => setYieldMode("direct")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "direct" ? 700 : 400, background: yieldMode === "direct" ? "#1E1E2E" : "transparent", color: yieldMode === "direct" ? "#E2E8F0" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Input Langsung
                      </button>
                      <button type="button" onClick={() => setYieldMode("batch")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "batch" ? 700 : 400, background: yieldMode === "batch" ? "#1E1E2E" : "transparent", color: yieldMode === "batch" ? "#C8F135" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Batch Produksi
                      </button>
                      <button type="button" onClick={async () => {
                        setYieldMode("porsi");
                        if (form.namaBahan && !porsiEstimasi) {
                          setPorsiLoading(true); setPorsiNarasi("");
                          try {
                            const r = await estimatePorsiSaja(form.namaBahan, form.satuanBeli, parseNum(form.hargaBeli) || undefined);
                            if (r.porsiPerKemasan) { setPorsiEstimasi(String(r.porsiPerKemasan)); setForm(f => ({ ...f, isiSatuan: String(r.porsiPerKemasan), satuanDapur: "porsi" })); }
                            setPorsiNarasi(r.narasi);
                          } finally { setPorsiLoading(false); }
                        }
                      }} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: yieldMode === "porsi" ? 700 : 400, background: yieldMode === "porsi" ? "#1E1E2E" : "transparent", color: yieldMode === "porsi" ? "#F59E0B" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Estimasi Porsi
                      </button>
                    </div>
                    {yieldMode === "direct" && (() => {
                      const is = parseNum(form.isiSatuan);
                      const hb = parseNum(form.hargaBeli);
                      return is > 0 && hb > 0 ? (
                        <div style={{ padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(200,241,53,0.1)" }}>
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
                                placeholder="10" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Porsi / produksi</label>
                              <input type="number" min={1} value={batchFields.porsiPerBatch}
                                onChange={(e) => { const v = e.target.value; setBatchFields(f => ({ ...f, porsiPerBatch: v })); const t = parseNum(batchFields.jumlahSubUnit) * parseNum(v) * parseNum(batchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="65" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Produksi / sub-unit</label>
                              <input type="number" min={1} value={batchFields.jumlahBatchPerSubUnit}
                                onChange={(e) => { const v = e.target.value; setBatchFields(f => ({ ...f, jumlahBatchPerSubUnit: v })); const t = parseNum(batchFields.jumlahSubUnit) * parseNum(batchFields.porsiPerBatch) * parseNum(v || "1"); if (t > 0) setForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="2" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                          </div>
                          {total > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ padding: "8px 10px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(96,165,250,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total Yield</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#60A5FA" }}>{total.toLocaleString("id-ID")} {form.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>{sub} × {ppb} × {bpsu}</div>
                              </div>
                              <div style={{ padding: "8px 10px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(200,241,53,0.15)" }}>
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
                        {porsiLoading ? (
                          <div style={{ padding: "14px 0", textAlign: "center" }}>
                            <span style={{ fontSize: 11, color: "#F59E0B" }}>✦ Claude sedang menghitung estimasi porsi...</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "#6B7280" }}>1 {form.satuanBeli || "kemasan"} sekitar</span>
                              <input
                                type="number" min={1} value={porsiEstimasi}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPorsiEstimasi(v);
                                  if (parseNum(v) > 0) setForm(f => ({ ...f, isiSatuan: v, satuanDapur: "porsi" }));
                                }}
                                placeholder="?"
                                style={{ width: 72, background: `var(--color-os-surface)`, border: "1px solid #F59E0B", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                              />
                              <span style={{ fontSize: 11, color: "#6B7280" }}>porsi</span>
                              {form.namaBahan && (
                                <button type="button" onClick={async () => {
                                  setPorsiLoading(true); setPorsiNarasi("");
                                  try {
                                    const r = await estimatePorsiSaja(form.namaBahan, form.satuanBeli, parseNum(form.hargaBeli) || undefined);
                                    if (r.porsiPerKemasan) { setPorsiEstimasi(String(r.porsiPerKemasan)); setForm(f => ({ ...f, isiSatuan: String(r.porsiPerKemasan), satuanDapur: "porsi" })); }
                                    setPorsiNarasi(r.narasi);
                                  } finally { setPorsiLoading(false); }
                                }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#F59E0B", cursor: "pointer", fontWeight: 600 }}>
                                  ✦ Estimasi AI
                                </button>
                              )}
                            </div>
                            {porsiNarasi && (
                              <div style={{ marginTop: 6, fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>{porsiNarasi}</div>
                            )}
                            {parseNum(porsiEstimasi) > 0 && parseNum(form.hargaBeli) > 0 && (
                              <div style={{ marginTop: 8, padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                                <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per porsi: </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                                  Rp {Math.round(parseNum(form.hargaBeli) / parseNum(porsiEstimasi)).toLocaleString("id-ID")}
                                </span>
                                <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>Satuan dapur di-set ke "porsi"</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddBahan(false); setAiEstimation(null); setYieldMode("direct"); setBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); setPorsiEstimasi(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
          <div className="modal-fadein" style={{ width: 480, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
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
                    style={{ width: "100%", background: addVariantBase ? "#0A0A14" : `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: addVariantBase ? "#6B7280" : "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori *</label>
                    <select
                      value={menuForm.kategori}
                      onChange={(e) => setMenuForm((f) => ({ ...f, kategori: e.target.value as "food" | "beverage" }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
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
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
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
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" as const }}
                    />
                    <span style={{ fontSize: 10, color: "#4B5563" }}>Komisi platform dari harga jual</span>
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddMenu(false); setAddVariantBase(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
          <div className="modal-fadein" style={{ width: 520, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#4B5563", textTransform: "uppercase" }}>{label}</label>
                      {key === "stokMinimum" && (
                        <div style={{ display: "flex", gap: 2 }}>
                          {(["satuanDapur", "kemasan"] as const).map(m => (
                            <button key={m} type="button" onClick={() => setEditStokMinimumMode(m)}
                              style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, cursor: "pointer", border: `1px solid ${editStokMinimumMode === m ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: editStokMinimumMode === m ? "rgba(200,241,53,0.12)" : "transparent", color: editStokMinimumMode === m ? "#C8F135" : "#4B5563" }}>
                              {m === "satuanDapur" ? editForm.satuanDapur || "unit" : editForm.satuanBeli || "kemasan"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type={type ?? "text"}
                      value={(editForm as any)[key]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                    {key === "stokMinimum" && editForm.isiSatuan && parseFloat(editForm.isiSatuan) > 0 && editForm.stokMinimum && (
                      <div style={{ fontSize: 10, color: "#4B5563", marginTop: 3 }}>
                        {editStokMinimumMode === "satuanDapur"
                          ? `≈ ${Math.ceil(parseFloat(editForm.stokMinimum) / parseFloat(editForm.isiSatuan))} ${editForm.satuanBeli || "kemasan"}`
                          : `= ${Math.round(parseFloat(editForm.stokMinimum) * parseFloat(editForm.isiSatuan))} ${editForm.satuanDapur || "unit"}`}
                      </div>
                    )}
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
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="packaged">packaged</option>
                    <option value="raw_bulk">raw_bulk</option>
                  </select>
                </div>

                {/* Kategori Produk */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Kategori Produk</label>
                  <select
                    value={editForm.kategoriBahan}
                    onChange={(e) => setEditForm((f) => ({ ...f, kategoriBahan: e.target.value }))}
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: editForm.kategoriBahan ? "#E2E8F0" : "#4B5563", outline: "none" }}
                  >
                    <option value="">— Pilih Kategori —</option>
                    {["Main Course","Snack","Dessert","Ice Cream","Noodles","Beverage","Kemasan & Alat Makan"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  {editForm.kategoriBahan && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>
                      ID prefix: <span style={{ color: "#C8F135", fontWeight: 700 }}>
                        {{"Main Course":"MCR","Snack":"SNK","Dessert":"DST","Ice Cream":"ICE","Noodles":"NDL","Beverage":"BEV","Kemasan & Alat Makan":"KMS"}[editForm.kategoriBahan] ?? "BHN"}-XXX
                      </span>
                    </div>
                  )}
                </div>

                {/* Outlet */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Outlet</label>
                  <select
                    value={editForm.outletId}
                    onChange={(e) => setEditForm((f) => ({ ...f, outletId: e.target.value }))}
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                  >
                    <option value="">— Semua Outlet —</option>
                    {outletList.map(o => <option key={o.id} value={o.id}>{o.namaOutlet}</option>)}
                  </select>
                </div>

                {/* Vendor/Supplier */}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Supplier (Vendor)</label>
                  <select
                    value={editVendorId}
                    onChange={(e) => setEditVendorId(e.target.value)}
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: editVendorId ? "#E2E8F0" : "#4B5563", outline: "none" }}
                  >
                    <option value="">— Tidak ada supplier —</option>
                    {vendorList.map((v: any) => <option key={v.id} value={v.id}>{v.namaVendor}</option>)}
                  </select>
                  {editVendorId && <div style={{ marginTop: 4, fontSize: 10, color: "#6B7280" }}>Bahan akan ter-sync ke halaman Suppliers</div>}
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
                    {editAiStep === "idle" ? (
                      <button onClick={handleEstimateEditYield} disabled={!editForm.namaBahan || !editForm.isiSatuan}
                        style={{ fontSize: 11, padding: "5px 12px", border: "1px solid rgba(200,241,53,0.4)", borderRadius: 6,
                          background: "rgba(200,241,53,0.1)", color: "#C8F135",
                          cursor: !editForm.namaBahan || !editForm.isiSatuan ? "not-allowed" : "pointer",
                          opacity: !editForm.namaBahan || !editForm.isiSatuan ? 0.5 : 1 }}>
                        🔍 Hitung Estimasi Yield
                      </button>
                    ) : (
                      <button onClick={() => { setEditAiStep("idle"); setEditAiEstimation(null); setEditAiContext({ penggunaan: "", skalaPorsi: "" }); }}
                        style={{ fontSize: 11, padding: "5px 12px", border: "1px solid rgba(75,85,99,0.4)", borderRadius: 6,
                          background: "transparent", color: "#6B7280", cursor: "pointer" }}>
                        ✕ Ulangi
                      </button>
                    )}
                  </div>

                  {editAiStep === "idle" && (
                    <div style={{ fontSize: 11, color: "#4B5563", textAlign: "center", padding: "8px 0" }}>
                      Klik "Hitung Estimasi Yield" untuk estimasi AI
                    </div>
                  )}

                  {editAiStep === "questions" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 6, fontWeight: 600 }}>
                          1. Bahan ini digunakan untuk?
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {["Menu utama (nasi/lauk)", "Minuman", "Dessert / kue", "Camilan / snack", "Bumbu / pelengkap"].map(opt => (
                            <button key={opt} type="button"
                              onClick={() => setEditAiContext(c => ({ ...c, penggunaan: opt }))}
                              style={{ padding: "4px 10px", fontSize: 10, borderRadius: 20, cursor: "pointer",
                                border: `1px solid ${editAiContext.penggunaan === opt ? "#C8F135" : "#2D2D44"}`,
                                background: editAiContext.penggunaan === opt ? "rgba(200,241,53,0.12)" : "transparent",
                                color: editAiContext.penggunaan === opt ? "#C8F135" : "#6B7280" }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      {editAiContext.penggunaan && (
                        <div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 6, fontWeight: 600 }}>
                            2. Porsi untuk skala apa?
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {["Restoran (standar)", "Kafe / coffee shop", "Warung / catering"].map(opt => (
                              <button key={opt} type="button"
                                onClick={() => {
                                  const ctx = { ...editAiContext, skalaPorsi: opt };
                                  setEditAiContext(ctx);
                                  runEditEstimation(ctx);
                                }}
                                style={{ padding: "4px 10px", fontSize: 10, borderRadius: 20, cursor: "pointer",
                                  border: `1px solid ${editAiContext.skalaPorsi === opt ? "#60A5FA" : "#2D2D44"}`,
                                  background: editAiContext.skalaPorsi === opt ? "rgba(96,165,250,0.12)" : "transparent",
                                  color: editAiContext.skalaPorsi === opt ? "#60A5FA" : "#6B7280" }}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {editEstimating && (
                    <div style={{ fontSize: 11, color: "#C8F135", textAlign: "center", padding: "10px 0" }}>
                      ⏳ AI sedang menganalisis...
                    </div>
                  )}

                  {editAiStep === "result" && editAiEstimation && !editEstimating && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Harga Pasar</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#C8F135" }}>{editAiEstimation.hargaPasarFormatted}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Estimasi Porsi / Kemasan</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>±{editAiEstimation.estimasiPorsiPerKemasan ?? "?"} porsi</div>
                        {editAiEstimation.namaMenuContoh && (
                          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{editAiEstimation.namaMenuContoh}</div>
                        )}
                      </div>
                      <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, fontStyle: "italic" }}>
                        {editAiEstimation.narasi}
                      </div>
                      {editAiEstimation.error && (
                        <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#F59E0B" }}>⚠ {editAiEstimation.error}</div>
                      )}
                      <div style={{ gridColumn: "1 / -1", fontSize: 9, color: "#374151" }}>
                        Konteks: {editAiContext.penggunaan} · {editAiContext.skalaPorsi}
                      </div>
                    </div>
                  )}
                  </>)}
                  {/* Yield Mode Calculator */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", gap: 3, marginBottom: 10, background: `var(--color-os-surface)`, borderRadius: 6, padding: 3 }}>
                      <button type="button" onClick={() => setEditYieldMode("direct")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "direct" ? 700 : 400, background: editYieldMode === "direct" ? "#1E1E2E" : "transparent", color: editYieldMode === "direct" ? "#E2E8F0" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Input Langsung
                      </button>
                      <button type="button" onClick={() => setEditYieldMode("batch")} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "batch" ? 700 : 400, background: editYieldMode === "batch" ? "#1E1E2E" : "transparent", color: editYieldMode === "batch" ? "#C8F135" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Batch Produksi
                      </button>
                      <button type="button" onClick={async () => {
                        setEditYieldMode("porsi");
                        if (editForm.namaBahan && !editPorsiEstimasi) {
                          setEditPorsiLoading(true); setEditPorsiNarasi("");
                          try {
                            const r = await estimatePorsiSaja(editForm.namaBahan, editForm.satuanBeli, parseNum(editForm.hargaBeli) || undefined);
                            if (r.porsiPerKemasan) { setEditPorsiEstimasi(String(r.porsiPerKemasan)); setEditForm(f => ({ ...f, isiSatuan: String(r.porsiPerKemasan), satuanDapur: "porsi" })); }
                            setEditPorsiNarasi(r.narasi);
                          } finally { setEditPorsiLoading(false); }
                        }
                      }} style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: editYieldMode === "porsi" ? 700 : 400, background: editYieldMode === "porsi" ? "#1E1E2E" : "transparent", color: editYieldMode === "porsi" ? "#F59E0B" : "#4B5563", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Estimasi Porsi
                      </button>
                    </div>
                    {editYieldMode === "direct" && (() => {
                      const is = parseNum(editForm.isiSatuan);
                      const hb = parseNum(editForm.hargaBeli);
                      return is > 0 && hb > 0 ? (
                        <div style={{ padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(200,241,53,0.1)" }}>
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
                                placeholder="10" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Porsi / produksi</label>
                              <input type="number" min={1} value={editBatchFields.porsiPerBatch}
                                onChange={(e) => { const v = e.target.value; setEditBatchFields(f => ({ ...f, porsiPerBatch: v })); const t = parseNum(editBatchFields.jumlahSubUnit) * parseNum(v) * parseNum(editBatchFields.jumlahBatchPerSubUnit || "1"); if (t > 0) setEditForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="65" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <span style={{ fontSize: 16, color: "#374151", marginBottom: 7, flexShrink: 0 }}>×</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Produksi / sub-unit</label>
                              <input type="number" min={1} value={editBatchFields.jumlahBatchPerSubUnit}
                                onChange={(e) => { const v = e.target.value; setEditBatchFields(f => ({ ...f, jumlahBatchPerSubUnit: v })); const t = parseNum(editBatchFields.jumlahSubUnit) * parseNum(editBatchFields.porsiPerBatch) * parseNum(v || "1"); if (t > 0) setEditForm(f => ({ ...f, isiSatuan: String(t) })); }}
                                placeholder="2" style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 8px", fontSize: 11, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                            </div>
                          </div>
                          {total > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ padding: "8px 10px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(96,165,250,0.15)" }}>
                                <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total Yield</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#60A5FA" }}>{total.toLocaleString("id-ID")} {editForm.satuanDapur || "unit"}</div>
                                <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>{sub} × {ppb} × {bpsu}</div>
                              </div>
                              <div style={{ padding: "8px 10px", background: `var(--color-os-surface)`, borderRadius: 6, border: "1px solid rgba(200,241,53,0.15)" }}>
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
                        {editPorsiLoading ? (
                          <div style={{ padding: "14px 0", textAlign: "center" }}>
                            <span style={{ fontSize: 11, color: "#F59E0B" }}>✦ Claude sedang menghitung estimasi porsi...</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "#6B7280" }}>1 {editForm.satuanBeli || "kemasan"} sekitar</span>
                              <input
                                type="number" min={1} value={editPorsiEstimasi}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditPorsiEstimasi(v);
                                  if (parseNum(v) > 0) setEditForm(f => ({ ...f, isiSatuan: v, satuanDapur: "porsi" }));
                                }}
                                placeholder="?"
                                style={{ width: 72, background: `var(--color-os-surface)`, border: "1px solid #F59E0B", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
                              />
                              <span style={{ fontSize: 11, color: "#6B7280" }}>porsi</span>
                              {editForm.namaBahan && (
                                <button type="button" onClick={async () => {
                                  setEditPorsiLoading(true); setEditPorsiNarasi("");
                                  try {
                                    const r = await estimatePorsiSaja(editForm.namaBahan, editForm.satuanBeli, parseNum(editForm.hargaBeli) || undefined);
                                    if (r.porsiPerKemasan) { setEditPorsiEstimasi(String(r.porsiPerKemasan)); setEditForm(f => ({ ...f, isiSatuan: String(r.porsiPerKemasan), satuanDapur: "porsi" })); }
                                    setEditPorsiNarasi(r.narasi);
                                  } finally { setEditPorsiLoading(false); }
                                }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#F59E0B", cursor: "pointer", fontWeight: 600 }}>
                                  ✦ Estimasi AI
                                </button>
                              )}
                            </div>
                            {editPorsiNarasi && (
                              <div style={{ marginTop: 6, fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>{editPorsiNarasi}</div>
                            )}
                            {parseNum(editPorsiEstimasi) > 0 && parseNum(editForm.hargaBeli) > 0 && (
                              <div style={{ marginTop: 8, padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 6 }}>
                                <span style={{ fontSize: 10, color: "#4B5563" }}>Harga per porsi: </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                                  Rp {Math.round(parseNum(editForm.hargaBeli) / parseNum(editPorsiEstimasi)).toLocaleString("id-ID")}
                                </span>
                                <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>Satuan dapur di-set ke "porsi"</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditTarget(null); setEditAiEstimation(null); setEditYieldMode("direct"); setEditBatchFields({ jumlahSubUnit: "", porsiPerBatch: "", jumlahBatchPerSubUnit: "1" }); setEditPorsiEstimasi(""); setEditPorsiNarasi(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
          <div className="modal-fadein" style={{ width: 620, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
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
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              {/* BOM header row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid var(--color-os-border)" }}>
                <div style={{ width: 110, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Tipe</div>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Item</div>
                <div style={{ width: 70, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Qty</div>
                <div style={{ width: 60, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Satuan</div>
                <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Sub-COGS</div>
                <div style={{ width: 28 }} />
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {bomLines.map((line, idx) => {
                  const sfgItem = line.itemType === "semi_finished" ? sfgList.find(s => s.id === line.itemId) : undefined;
                  const bahan = line.itemType !== "semi_finished" ? bahanList.find((b) => b.id === line.itemId) : undefined;
                  const satuan = line.itemType === "semi_finished" ? (sfgItem?.satuanHasil || sfgItem?.satuan) : bahan?.satuanDapur;
                  const subCogs = line.itemType === "semi_finished"
                    ? line.qty * parseFloat(sfgItem?.cogsPerUnit ?? "0")
                    : bahan ? line.qty * parseFloat(bahan.hargaPerSatuanPorsi ?? "0") : 0;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
                      <select
                        value={line.itemType}
                        onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, itemType: e.target.value as "bahan_dasar" | "semi_finished" | "kemasan", itemId: "" } : x))}
                        style={{ width: 110, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}
                      >
                        <option value="bahan_dasar">Bahan</option>
                        <option value="semi_finished">Sub-Resep</option>
                        <option value="kemasan">📦 Kemasan</option>
                      </select>
                      <div style={{ flex: 1 }}>
                        <input
                          ref={(el) => { bomInputRefs.current[idx] = el; }}
                          value={bomOpenIdx === idx ? (bomSearches[idx] ?? "") : (line.itemType === "semi_finished" ? (sfgList.find(s => s.id === line.itemId)?.namaSemiFinished ?? "") : (bahanList.find((b) => b.id === line.itemId)?.namaBahan ?? ""))}
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
                          style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0", boxSizing: "border-box", outline: "none" }}
                        />
                      </div>
                      <input
                        type="number" value={line.qty} min={0.001} step={0.001}
                        onChange={(e) => setBomLines((l) => l.map((x, i) => i === idx ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 70, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}
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
                  <div style={{ marginTop: 14, padding: "12px 14px", background: `var(--color-os-surface)`, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
                <button onClick={() => setShowBOMEditor(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
            background: `var(--color-os-card)`,
            border: "1px solid var(--color-os-border2)",
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
            if (line.itemType === "semi_finished") {
              const sfgOptions = sfgList.filter(s => !q || s.namaSemiFinished.toLowerCase().includes(q));
              if (sfgOptions.length === 0) return <div style={{ padding: "10px 12px", fontSize: 11, color: "#4B5563" }}>Tidak ada hasil</div>;
              return sfgOptions.map(s => (
                <div key={s.id} onMouseDown={() => { setBomLines(l => l.map((x, i) => i === bomOpenIdx ? { ...x, itemId: s.id } : x)); setBomSearches(sr => { const a = [...sr]; a[bomOpenIdx!] = s.namaSemiFinished; return a; }); setBomOpenIdx(null); }}
                  style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: s.id === line.itemId ? "#C8F135" : "#E2E8F0", background: s.id === line.itemId ? "rgba(200,241,53,0.07)" : "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = s.id === line.itemId ? "rgba(200,241,53,0.07)" : "transparent")}>
                  <div>{s.namaSemiFinished}</div>
                  <div style={{ fontSize: 9, color: "#F59E0B" }}>{parseFloat(s.cogsPerUnit) > 0 ? `${formatRupiah(parseFloat(s.cogsPerUnit))} /${s.satuanHasil || s.satuan}` : "COGS belum dihitung"}</div>
                </div>
              ));
            }
            const options = (
              line.itemType === "kemasan"
                ? bahanList.filter((b) => b.kategoriBahan === "Kemasan & Alat Makan")
                : bahanList.filter((b) => b.kategoriBahan !== "Kemasan & Alat Makan")
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

      {/* Modal Tambah Raw Menu */}
      {showAddSFG && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 420, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #F59E0B, #C8F135, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Raw Menu</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Raw Menu *</label>
                  <input value={sfgForm.namaSemiFinished} onChange={e => setSfgForm(f => ({ ...f, namaSemiFinished: e.target.value }))}
                    placeholder="cth: Sambal Bawang, Suwir Ayam"
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Satuan Hasil *</label>
                    <input value={sfgForm.satuanHasil} onChange={e => setSfgForm(f => ({ ...f, satuanHasil: e.target.value }))}
                      placeholder="gram, porsi, pcs"
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                      {["gram", "ml", "porsi", "pcs", "liter"].map(u => (
                        <button key={u} type="button" onClick={() => setSfgForm(f => ({ ...f, satuanHasil: u }))}
                          style={{ padding: "2px 7px", borderRadius: 8, fontSize: 10, cursor: "pointer", border: `1px solid ${sfgForm.satuanHasil === u ? "rgba(245,158,11,0.5)" : "#2D2D44"}`, background: sfgForm.satuanHasil === u ? "rgba(245,158,11,0.12)" : "transparent", color: sfgForm.satuanHasil === u ? "#F59E0B" : "#6B7280" }}>{u}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Jumlah Hasil *</label>
                    <input type="number" value={sfgForm.jumlahHasil} onChange={e => setSfgForm(f => ({ ...f, jumlahHasil: e.target.value }))}
                      placeholder="200"
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                    <div style={{ fontSize: 10, color: "#4B5563", marginTop: 4 }}>Berapa {sfgForm.satuanHasil || "unit"} yang dihasilkan dari satu batch resep ini?</div>
                  </div>
                </div>
                {outletList.length > 1 && (
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Outlet</label>
                    <select value={sfgForm.outletId} onChange={e => setSfgForm(f => ({ ...f, outletId: e.target.value }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}>
                      {outletList.map(o => <option key={o.id} value={o.id}>{o.namaOutlet}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddSFG(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleCreateSFG} disabled={sfgSaving || !sfgForm.namaSemiFinished.trim()} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {sfgSaving ? "Menyimpan..." : "Simpan Raw Menu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Raw Menu */}
      {editSFG && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 420, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #60A5FA, #F59E0B, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 4px" }}>Edit Raw Menu — <span style={{ color: "#60A5FA", fontFamily: "monospace" }}>{editSFG.id}</span></h2>
              <p style={{ fontSize: 11, color: "#4B5563", margin: "0 0 20px" }}>{editSFG.namaSemiFinished}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Nama Raw Menu *</label>
                  <input value={editSFGForm.namaSemiFinished} onChange={e => setEditSFGForm(f => ({ ...f, namaSemiFinished: e.target.value }))}
                    style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Satuan Hasil</label>
                    <input value={editSFGForm.satuanHasil} onChange={e => setEditSFGForm(f => ({ ...f, satuanHasil: e.target.value }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                      {["gram", "ml", "porsi", "pcs", "liter"].map(u => (
                        <button key={u} type="button" onClick={() => setEditSFGForm(f => ({ ...f, satuanHasil: u }))}
                          style={{ padding: "2px 7px", borderRadius: 8, fontSize: 10, cursor: "pointer", border: `1px solid ${editSFGForm.satuanHasil === u ? "rgba(245,158,11,0.5)" : "#2D2D44"}`, background: editSFGForm.satuanHasil === u ? "rgba(245,158,11,0.12)" : "transparent", color: editSFGForm.satuanHasil === u ? "#F59E0B" : "#6B7280" }}>{u}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Jumlah Hasil</label>
                    <input type="number" value={editSFGForm.jumlahHasil} onChange={e => setEditSFGForm(f => ({ ...f, jumlahHasil: e.target.value }))}
                      style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setEditSFG(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleUpdateSFG} disabled={sfgSaving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {sfgSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal SFG BOM Editor (Raw Menu Recipe) */}
      {showSFGEditor && selectedSFG && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 620, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #F59E0B, #C8F135, transparent)" }} />
            <div style={{ padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 4px" }}>Edit Resep — <span style={{ color: "#F59E0B" }}>{selectedSFG.namaSemiFinished}</span></h2>
              <p style={{ fontSize: 11, color: "#4B5563", margin: "0 0 16px" }}>
                Hasil: {parseFloat(selectedSFG.jumlahHasil).toLocaleString("id-ID")} {selectedSFG.satuanHasil || selectedSFG.satuan}
              </p>
              {/* BOM header */}
              <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid var(--color-os-border)" }}>
                <div style={{ width: 100, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Tipe</div>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Item</div>
                <div style={{ width: 70, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Qty</div>
                <div style={{ width: 60, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Satuan</div>
                <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>Sub-COGS</div>
                <div style={{ width: 28 }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {sfgBomLines.map((line, idx) => {
                  const nestedSfg = line.itemType === "semi_finished" ? sfgList.find(s => s.id === line.itemId && s.id !== selectedSFG.id) : undefined;
                  const bahan = line.itemType === "bahan_dasar" ? bahanList.find(b => b.id === line.itemId) : undefined;
                  const satuan = line.itemType === "semi_finished" ? (nestedSfg?.satuanHasil || nestedSfg?.satuan) : bahan?.satuanDapur;
                  const subCogs = line.itemType === "semi_finished"
                    ? line.qty * parseFloat(nestedSfg?.cogsPerUnit ?? "0")
                    : bahan ? line.qty * parseFloat(bahan.hargaPerSatuanPorsi ?? "0") : 0;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
                      <select value={line.itemType} onChange={e => setSfgBomLines(l => l.map((x, i) => i === idx ? { ...x, itemType: e.target.value as "bahan_dasar" | "semi_finished", itemId: "" } : x))}
                        style={{ width: 100, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }}>
                        <option value="bahan_dasar">Bahan</option>
                        <option value="semi_finished">Sub-Resep</option>
                      </select>
                      <div style={{ flex: 1 }}>
                        <input
                          ref={el => { sfgBomInputRefs.current[idx] = el; }}
                          value={sfgBomOpenIdx === idx ? (sfgBomSearches[idx] ?? "") : (line.itemType === "semi_finished" ? (sfgList.find(s => s.id === line.itemId)?.namaSemiFinished ?? "") : (bahanList.find(b => b.id === line.itemId)?.namaBahan ?? ""))}
                          onChange={e => { setSfgBomSearches(s => { const a = [...s]; a[idx] = e.target.value; return a; }); setSfgBomOpenIdx(idx); const rect = sfgBomInputRefs.current[idx]?.getBoundingClientRect(); if (rect) setSfgBomDropdownRect(rect); }}
                          onFocus={() => { setSfgBomSearches(s => { const a = [...s]; a[idx] = ""; return a; }); setSfgBomOpenIdx(idx); const rect = sfgBomInputRefs.current[idx]?.getBoundingClientRect(); if (rect) setSfgBomDropdownRect(rect); }}
                          onBlur={() => setTimeout(() => setSfgBomOpenIdx(o => o === idx ? null : o), 150)}
                          placeholder="— Cari item —"
                          style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0", boxSizing: "border-box", outline: "none" }}
                        />
                      </div>
                      <input type="number" value={line.qty} min={0.001} step={0.001}
                        onChange={e => setSfgBomLines(l => l.map((x, i) => i === idx ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 70, background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "#E2E8F0" }} />
                      <span style={{ width: 60, fontSize: 10, color: "#6B7280" }}>{satuan ?? "—"}</span>
                      <span style={{ width: 90, fontSize: 10, color: subCogs > 0 ? "#C8F135" : "#4B5563", fontWeight: 700 }}>
                        {subCogs > 0 ? `Rp ${Math.round(subCogs).toLocaleString("id-ID")}` : "—"}
                      </span>
                      <button onClick={() => setSfgBomLines(l => l.filter((_, i) => i !== idx))}
                        style={{ width: 28, background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, padding: 0 }}>🗑</button>
                    </div>
                  );
                })}
                {sfgBomLines.length === 0 && (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#374151", fontSize: 11 }}>Belum ada bahan. Klik "+ Tambah Baris".</div>
                )}
              </div>
              <button onClick={() => setSfgBomLines(l => [...l, { itemType: "bahan_dasar", itemId: "", qty: 1 }])}
                style={{ marginTop: 8, fontSize: 11, padding: "6px 12px", border: "1px dashed #2D2D44", borderRadius: 6, background: "transparent", color: "#6B7280", cursor: "pointer" }}>
                + Tambah Baris
              </button>
              {/* COGS Summary */}
              <div style={{ marginTop: 14, padding: "12px 14px", background: `var(--color-os-surface)`, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total COGS Batch</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#C8F135" }}>Rp {Math.round(sfgTotalCOGS).toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Jumlah Hasil</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>
                    {parseFloat(selectedSFG.jumlahHasil).toLocaleString("id-ID")} {selectedSFG.satuanHasil || selectedSFG.satuan}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>COGS / Unit</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                    {parseFloat(selectedSFG.jumlahHasil) > 0
                      ? `Rp ${Math.round(sfgTotalCOGS / parseFloat(selectedSFG.jumlahHasil)).toLocaleString("id-ID")}`
                      : "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <button onClick={() => setShowSFGEditor(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleSaveSFGBOM} disabled={sfgSaving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {sfgSaving ? "Menyimpan..." : "Simpan Resep"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SFG BOM combobox dropdown — rendered via portal */}
      {sfgBomOpenIdx !== null && sfgBomDropdownRect && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", top: sfgBomDropdownRect.bottom + 2, left: sfgBomDropdownRect.left, width: sfgBomDropdownRect.width, background: `var(--color-os-card)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, zIndex: 9999, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}>
          {(() => {
            const line = sfgBomLines[sfgBomOpenIdx];
            if (!line) return null;
            const q = (sfgBomSearches[sfgBomOpenIdx] ?? "").toLowerCase();
            if (line.itemType === "semi_finished") {
              const sfgOptions = sfgList.filter(s => s.id !== selectedSFG!.id && (!q || s.namaSemiFinished.toLowerCase().includes(q)));
              if (sfgOptions.length === 0) return <div style={{ padding: "10px 12px", fontSize: 11, color: "#4B5563" }}>Tidak ada hasil</div>;
              return sfgOptions.map(s => (
                <div key={s.id} onMouseDown={() => { setSfgBomLines(l => l.map((x, i) => i === sfgBomOpenIdx ? { ...x, itemId: s.id } : x)); setSfgBomSearches(sr => { const a = [...sr]; a[sfgBomOpenIdx!] = s.namaSemiFinished; return a; }); setSfgBomOpenIdx(null); }}
                  style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: s.id === line.itemId ? "#C8F135" : "#E2E8F0" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div>{s.namaSemiFinished}</div>
                  <div style={{ fontSize: 9, color: "#F59E0B" }}>{parseFloat(s.cogsPerUnit) > 0 ? formatRupiah(parseFloat(s.cogsPerUnit)) : "COGS belum dihitung"} /{s.satuanHasil || s.satuan}</div>
                </div>
              ));
            }
            const opts = bahanList.filter(b => !q || b.namaBahan.toLowerCase().includes(q));
            if (opts.length === 0) return <div style={{ padding: "10px 12px", fontSize: 11, color: "#4B5563" }}>Tidak ada hasil</div>;
            return opts.map(b => (
              <div key={b.id} onMouseDown={() => { setSfgBomLines(l => l.map((x, i) => i === sfgBomOpenIdx ? { ...x, itemId: b.id } : x)); setSfgBomSearches(sr => { const a = [...sr]; a[sfgBomOpenIdx!] = b.namaBahan; return a; }); setSfgBomOpenIdx(null); }}
                style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: b.id === line.itemId ? "#C8F135" : "#E2E8F0" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                {b.namaBahan}
              </div>
            ));
          })()}
        </div>,
        document.body
      )}

      {/* Modal Rename ID Bahan (admin only) */}
      {renameTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="modal-fadein" style={{ width: 400, background: `var(--color-os-card)`, borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 6px" }}>Rename ID Bahan</h2>
              <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 20px" }}>ID lama: <span style={{ color: "#C8F135", fontFamily: "monospace" }}>{renameTarget.id}</span></p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>ID Baru</label>
                <input
                  type="text"
                  value={renameNewId}
                  onChange={(e) => { setRenameNewId(e.target.value.toUpperCase()); setRenameError(""); }}
                  placeholder="MCR-BTMK-001"
                  style={{ width: "100%", background: `var(--color-os-surface)`, border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#C8F135", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                />
                {renameError && <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{renameError}</div>}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setRenameTarget(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button
                  disabled={renameLoading}
                  onClick={async () => {
                    setRenameLoading(true);
                    setRenameError("");
                    try {
                      await renameBahanId(renameTarget.id, renameNewId);
                      setRenameTarget(null);
                    } catch (e: unknown) {
                      setRenameError(e instanceof Error ? e.message : "Gagal rename ID");
                    } finally {
                      setRenameLoading(false);
                    }
                  }}
                  className="btn-accent"
                  style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}
                >
                  {renameLoading ? "Menyimpan..." : "Simpan ID"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
