import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatRupiah, formatDateTime } from "./formatters";

interface MaterialRow {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
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

interface ShippingRow {
  jasaKirim: string;
  jenisKirim: string;
  mode: "tiered" | "nominal";
  beratPaket: number;
  beratPerPack: number;
  jumlahPerPaket: number;
  satuan: string;
  beratAwal: number;
  tarifAwal: number;
  tarifTambahan: number;
  beratMaks: number;
  nominalOngkir: number;
}

export interface HppPdfPayload {
  title: string;
  materialCosts: MaterialRow[];
  laborCosts: LaborRow[];
  laborMode: "per-porsi" | "per-hari";
  equipmentCosts: EquipmentRow[];
  otherCosts: OtherRow[];
  shippingCosts: ShippingRow[];
  totals: {
    bahan: number;
    labor: number;
    equipment: number;
    other: number;
    shipping: number;
    biayaProduk: number;
    laba: number;
    hargaBersihAwal: number;
    diskon: number;
    hargaBersih: number;
    pajak: number;
    hargaAkhir: number;
    profitPerUnit: number;
  };
  inputs: {
    marginTarget: number;
    discountPercent: number;
    taxPercent: number;
  };
}

export function exportHppToPdf(p: HppPdfPayload, fileName: string): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ── Header ───────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text("KALKULATOR HPP", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("OMNI-STOCK · Easy Going Group", pageW - margin, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text(p.title, margin, y);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Dibuat: ${formatDateTime(new Date())}`, pageW - margin, y, { align: "right" });
  y += 8;

  // ── Summary stat row ─────────────────────────────────────
  const summary = [
    { label: "BIAYA PRODUKSI", value: formatRupiah(p.totals.biayaProduk) },
    { label: "TARGET MARGIN", value: `${p.inputs.marginTarget}%` },
    { label: "HARGA AKHIR", value: formatRupiah(p.totals.hargaAkhir) },
    { label: "PROFIT / UNIT", value: formatRupiah(p.totals.profitPerUnit) },
  ];
  const cardW = (pageW - margin * 2 - 6) / 4;
  summary.forEach((s, i) => {
    const x = margin + i * (cardW + 2);
    doc.setDrawColor(220);
    doc.setFillColor(245, 250, 247);
    doc.roundedRect(x, y, cardW, 16, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(s.label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 83, 45);
    doc.text(s.value, x + 3, y + 12);
  });
  y += 22;

  // ── Detail tables ────────────────────────────────────────
  if (p.materialCosts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Bahan", "Jumlah", "Satuan", "Harga / Unit", "Total"]],
      body: p.materialCosts.map((m) => [
        m.name,
        m.qty,
        m.unit,
        formatRupiah(m.unitCost),
        formatRupiah(m.qty * m.unitCost),
      ]),
      foot: [["", "", "", "Subtotal Bahan", formatRupiah(p.totals.bahan)]],
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45], fontSize: 8 },
      footStyles: { fillColor: [240, 245, 242], textColor: [20, 83, 45], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  if (p.laborCosts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [[`Tenaga Kerja (${p.laborMode === "per-hari" ? "per-hari ÷ porsi" : "per-porsi"})`, "Qty", "Satuan", "Rate", "Total / Porsi"]],
      body: p.laborCosts.map((m) => {
        const total = p.laborMode === "per-hari" ? (m.qty > 0 ? m.rate / m.qty : 0) : m.qty * m.rate;
        return [m.name, m.qty, m.unit, formatRupiah(m.rate), formatRupiah(total)];
      }),
      foot: [["", "", "", "Subtotal Tenaga Kerja", formatRupiah(p.totals.labor)]],
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45], fontSize: 8 },
      footStyles: { fillColor: [240, 245, 242], textColor: [20, 83, 45], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  if (p.equipmentCosts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Peralatan", "Pemakaian (porsi)", "Harga Beli", "Per Porsi"]],
      body: p.equipmentCosts.map((m) => [
        m.name,
        m.usageCount,
        formatRupiah(m.price),
        formatRupiah(m.usageCount > 0 ? m.price / m.usageCount : 0),
      ]),
      foot: [["", "", "Subtotal Peralatan", formatRupiah(p.totals.equipment)]],
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45], fontSize: 8 },
      footStyles: { fillColor: [240, 245, 242], textColor: [20, 83, 45], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  if (p.otherCosts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Lain-Lain", "Qty", "Harga / Unit", "Total"]],
      body: p.otherCosts.map((m) => [
        m.name,
        m.qty,
        formatRupiah(m.unitCost),
        formatRupiah(m.qty * m.unitCost),
      ]),
      foot: [["", "", "Subtotal Lain-Lain", formatRupiah(p.totals.other)]],
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45], fontSize: 8 },
      footStyles: { fillColor: [240, 245, 242], textColor: [20, 83, 45], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  if (p.shippingCosts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Ongkos Kirim", "Mode", "Berat (kg)", "Isi/Pack", "Total / Paket", "Per Satuan"]],
      body: p.shippingCosts.map((m) => {
        let totalPaket: number;
        if (m.mode === "nominal") {
          totalPaket = m.nominalOngkir;
        } else {
          const beratEfektif = Math.min(m.beratPaket, m.beratMaks > 0 ? m.beratMaks : m.beratPaket);
          if (beratEfektif <= m.beratAwal || m.beratAwal <= 0) {
            totalPaket = m.tarifAwal;
          } else {
            totalPaket = m.tarifAwal + (beratEfektif - m.beratAwal) * m.tarifTambahan;
          }
        }
        const jumlahPack = m.beratPerPack > 0 ? m.beratPaket / m.beratPerPack : 0;
        const totalUnit = jumlahPack * m.jumlahPerPaket;
        const perSatuan = totalUnit > 0 ? totalPaket / totalUnit : 0;
        return [
          `${m.jasaKirim || "—"} (${m.jenisKirim || "—"})`,
          m.mode === "tiered" ? "Tarif Berjenjang" : "Nominal",
          m.beratPaket,
          `${m.jumlahPerPaket} ${m.satuan}`,
          formatRupiah(totalPaket),
          `${formatRupiah(perSatuan)} / ${m.satuan || "unit"}`,
        ];
      }),
      foot: [["", "", "", "", "Subtotal Ongkos Kirim", formatRupiah(p.totals.shipping)]],
      theme: "striped",
      headStyles: { fillColor: [20, 83, 45], fontSize: 8 },
      footStyles: { fillColor: [240, 245, 242], textColor: [20, 83, 45], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: { 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // ── Final breakdown ──────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [["Rincian Harga Final", ""]],
    body: [
      ["Total Bahan", formatRupiah(p.totals.bahan)],
      ["Total Tenaga Kerja", formatRupiah(p.totals.labor)],
      ["Total Peralatan", formatRupiah(p.totals.equipment)],
      ["Total Lain-Lain", formatRupiah(p.totals.other)],
      ["Total Ongkos Kirim", formatRupiah(p.totals.shipping)],
      [{ content: "Biaya Produk", styles: { fontStyle: "bold" } }, { content: formatRupiah(p.totals.biayaProduk), styles: { fontStyle: "bold" } }],
      [`Laba (target margin ${p.inputs.marginTarget}%)`, formatRupiah(p.totals.laba)],
      ["Harga Bersih Awal", formatRupiah(p.totals.hargaBersihAwal)],
      [`Diskon (${p.inputs.discountPercent}%)`, `- ${formatRupiah(p.totals.diskon)}`],
      ["Harga Bersih", formatRupiah(p.totals.hargaBersih)],
      [`Pajak Penjualan (${p.inputs.taxPercent}%)`, `+ ${formatRupiah(p.totals.pajak)}`],
      [
        { content: "HARGA AKHIR", styles: { fontStyle: "bold", fillColor: [20, 83, 45], textColor: [255, 255, 255] } },
        { content: formatRupiah(p.totals.hargaAkhir), styles: { fontStyle: "bold", fillColor: [20, 83, 45], textColor: [255, 255, 255], halign: "right" } },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 83, 45], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
    margin: { left: margin, right: margin },
  });

  // ── Footer (every page) ──────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Halaman ${i} dari ${pageCount} · OMNI-STOCK Kalkulator HPP`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
  }

  doc.save(`${fileName}.pdf`);
}
