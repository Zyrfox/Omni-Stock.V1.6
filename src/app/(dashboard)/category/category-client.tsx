"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah } from "@/lib/formatters";

interface BahanItem {
  id: string; namaBahan: string; kategoriBahan: string | null;
  outletId: string | null; stokMinimum: number; hargaBeli: string;
}

export function CategoryClient({ bahanList }: { bahanList: BahanItem[] }) {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const tabs = ["Barang Habis Pakai", "Aset Tetap", "Mutasi Antar Cabang"];

  // Filter consumables (kategori_bahan contains "habis pakai" or similar)
  const consumables = bahanList.filter((b) =>
    b.kategoriBahan?.toLowerCase().includes("habis") ||
    b.kategoriBahan?.toLowerCase().includes("consumable") ||
    !b.kategoriBahan
  );

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Assets & Inventory</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen barang habis pakai, aset, dan mutasi</p>
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
                {["ID", "Nama Barang", "Kategori", "Outlet", "Stok", "Min. Stok", "Status", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consumables.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada data barang habis pakai.</td></tr>
              ) : (
                consumables.map((b) => (
                  <tr key={b.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#4B5563" }}>{b.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{b.namaBahan}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{b.kategoriBahan ?? "Umum"}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{b.outletId ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>0 unit</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#4B5563" }}>{b.stokMinimum}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color="red" size="sm">🔴 Low Stock</Badge></td>
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
        </div>
      )}

      {activeTab === 3 && (
        <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>↔</div>
          <div style={{ fontSize: 12, color: "#4B5563" }}>Belum ada data mutasi antar cabang.</div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>Mutasi akan muncul di sini saat ada transfer bahan antar outlet.</div>
        </div>
      )}
    </div>
  );
}
