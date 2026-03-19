"use client";

import { useState, Fragment } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/shared/badge-status";
import { formatRupiah, formatDateTime } from "@/lib/formatters";
import { sendPO, receivePO } from "@/actions/purchase-order";
import { useRouter } from "next/navigation";

function formatWANumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits;
}

interface POItem {
  id: string; outletId: string; vendorId: string; bahanId: string;
  status: "draft" | "sent" | "received"; qtyOrder: string; hargaSatuan: string;
  totalHarga: string; aiNotes: string | null; tanggalKirim: Date | null;
  tanggalTerima: Date | null; createdBy: string; createdAt: Date | null;
  vendor: { namaVendor: string; estimasiPengiriman: number; kontakWa: string | null };
  bahan: { namaBahan: string; satuanDapur: string; tipeBahan: string };
  createdByUser: { nama: string } | null;
  outlet: { namaOutlet: string } | null;
}

interface POLogsClientProps {
  orders: POItem[];
  stats: { total: number; draft: number; sent: number; received: number };
}

export function POLogsClient({ orders, stats }: POLogsClientProps) {
  const [selectedPO, setSelectedPO] = useState<POItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "sent" | "received">("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const router = useRouter();

  async function handleSend(id: string) {
    setActionLoading(id);
    await sendPO(id);
    setActionLoading(null);
    router.refresh();
  }

  async function handleReceive(id: string) {
    setActionLoading(id);
    await receivePO(id);
    setActionLoading(null);
    router.refresh();
    if (selectedPO?.id === id) setSelectedPO(null);
  }

  const TIMELINE = ["draft", "sent", "received"];

  const q = search.toLowerCase();
  const filtered = orders.filter((po) => {
    const matchSearch = !q || po.bahan?.namaBahan?.toLowerCase().includes(q) || po.vendor?.namaVendor?.toLowerCase().includes(q) || po.id.toLowerCase().includes(q);
    const matchStatus = !statusFilter || po.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  const paged = filtered.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>PO Logs</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen Purchase Order</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total PO" value={stats.total} icon="📋" color="#60A5FA" />
        <StatCard label="Draft" value={stats.draft} icon="📝" color="#6B7280" />
        <StatCard label="Sent" value={stats.sent} icon="📤" color="#F59E0B" />
        <StatCard label="Received" value={stats.received} icon="✅" color="#22C55E" />
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        {/* Search + filter bar */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E1E2E", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Cari bahan, vendor, atau PO ID..."
            style={{ flex: 1, minWidth: 180, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: "#E2E8F0", outline: "none" }}
          />
          {(["", "draft", "sent", "received"] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${statusFilter === s ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: statusFilter === s ? "rgba(200,241,53,0.1)" : "transparent", color: statusFilter === s ? "#C8F135" : "#6B7280", fontSize: 11, cursor: "pointer" }}>
              {s === "" ? "Semua" : s.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["PO ID", "Bahan", "Vendor", "Outlet", "Qty", "Total Biaya", "Status", "Dibuat Oleh", "Tanggal", "Action"].map((h) => (
                <th key={h} className={h === "Bahan" ? "col-sticky-nama" : h === "PO ID" ? "col-hide-mobile" : undefined} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>{search || statusFilter ? "Tidak ada PO yang cocok." : "Belum ada PO."}</td></tr>
            ) : (
              paged.map((po) => (
                <tr key={po.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320", cursor: "pointer" }} onClick={() => setSelectedPO(po)}>
                  <td className="col-hide-mobile" style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#C8F135", fontWeight: 700 }}>{po.id}</td>
                  <td className="col-sticky-nama" style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{po.bahan?.namaBahan}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{po.vendor?.namaVendor}</td>
                  <td style={{ padding: "10px 14px" }}><Badge color="blue" size="sm">{po.outlet?.namaOutlet ?? po.outletId}</Badge></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0" }}>{po.qtyOrder} {po.bahan?.satuanDapur}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#E2E8F0", fontWeight: 700 }}>{formatRupiah(parseFloat(po.totalHarga))}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge color={po.status === "received" ? "green" : po.status === "sent" ? "amber" : "gray"} size="sm">
                      {po.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{po.createdByUser?.nama ?? po.createdBy}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{formatDateTime(po.createdAt)}</td>
                  <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {po.status === "draft" && (
                        <button onClick={() => handleSend(po.id)} disabled={actionLoading === po.id}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#F59E0B", cursor: "pointer", whiteSpace: "nowrap" }}>
                          📤 Kirim
                        </button>
                      )}
                      {po.status === "sent" && (
                        <button onClick={() => handleReceive(po.id)} disabled={actionLoading === po.id}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22C55E", cursor: "pointer", whiteSpace: "nowrap" }}>
                          ✓ Terima
                        </button>
                      )}
                      {po.vendor?.kontakWa && (
                        <a
                          href={`https://wa.me/${formatWANumber(po.vendor.kontakWa)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)", color: "#25D366", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          📱 WA
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid #1E1E2E", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#4B5563" }}>Baris per halaman:</span>
              {[20, 30, 40, 50].map(n => (
                <button key={n} onClick={() => { setRowsPerPage(n); setPage(0); }}
                  style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${rowsPerPage === n ? "rgba(200,241,53,0.5)" : "#2D2D44"}`, background: rowsPerPage === n ? "rgba(200,241,53,0.12)" : "transparent", color: rowsPerPage === n ? "#C8F135" : "#4B5563", fontSize: 11, cursor: "pointer" }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "#4B5563" }}>
                {safePage * rowsPerPage + 1}–{Math.min((safePage + 1) * rowsPerPage, filtered.length)} dari {filtered.length}
              </span>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #2D2D44", background: "transparent", color: safePage === 0 ? "#374151" : "#6B7280", fontSize: 11, cursor: safePage === 0 ? "default" : "pointer" }}>‹</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / rowsPerPage) - 1, p + 1))} disabled={safePage >= Math.ceil(filtered.length / rowsPerPage) - 1}
                style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #2D2D44", background: "transparent", color: safePage >= Math.ceil(filtered.length / rowsPerPage) - 1 ? "#374151" : "#6B7280", fontSize: 11, cursor: safePage >= Math.ceil(filtered.length / rowsPerPage) - 1 ? "default" : "pointer" }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPO && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 520, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#C8F135" }}>{selectedPO.id}</div>
                  <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>{formatDateTime(selectedPO.createdAt)}</div>
                </div>
                <button onClick={() => setSelectedPO(null)} style={{ background: "none", border: "none", color: "#4B5563", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Detail Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Bahan", value: selectedPO.bahan?.namaBahan },
                  { label: "Vendor", value: selectedPO.vendor?.namaVendor },
                  { label: "Outlet", value: selectedPO.outlet?.namaOutlet ?? selectedPO.outletId },
                  { label: "Qty", value: `${selectedPO.qtyOrder} ${selectedPO.bahan?.satuanDapur}` },
                  { label: "Total Biaya", value: formatRupiah(parseFloat(selectedPO.totalHarga)) },
                  { label: "Dibuat Oleh", value: selectedPO.createdByUser?.nama ?? selectedPO.createdBy },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#0F0F18", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#E2E8F0", fontWeight: 600 }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>

              {/* Status Timeline */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 10 }}>STATUS TIMELINE</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {TIMELINE.map((step, idx) => {
                    const isActive = selectedPO.status === step;
                    const isDone = TIMELINE.indexOf(selectedPO.status) > idx;
                    const color = step === "draft" ? "#6B7280" : step === "sent" ? "#F59E0B" : "#22C55E";
                    return (
                      <Fragment key={step}>
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", margin: "0 auto 6px",
                            background: isActive || isDone ? `rgba(${step === "draft" ? "107,114,128" : step === "sent" ? "245,158,11" : "34,197,94"},0.15)` : "#1E1E2E",
                            border: `2px solid ${isActive || isDone ? color : "#2D2D44"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14,
                          }}>
                            {isDone ? "✓" : isActive ? "●" : "○"}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: isActive ? color : "#4B5563", textTransform: "uppercase" }}>
                            {step}
                          </div>
                          {isActive && <div style={{ fontSize: 8, color, marginTop: 2 }}>Current</div>}
                        </div>
                        {idx < TIMELINE.length - 1 && (
                          <div style={{ flex: 1, height: 1, background: "#2D2D44" }} />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              {/* AI Notes */}
              {selectedPO.aiNotes && (
                <div style={{ padding: "12px", background: "rgba(200,241,53,0.05)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#C8F135", fontWeight: 700, marginBottom: 4 }}>✦ Catatan AI</div>
                  <div style={{ fontSize: 11, color: "#E2E8F0", lineHeight: 1.6 }}>{selectedPO.aiNotes}</div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {selectedPO.vendor?.kontakWa && (
                  <a
                    href={`https://wa.me/${formatWANumber(selectedPO.vendor.kontakWa)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)", color: "#25D366", cursor: "pointer", fontSize: 12, textDecoration: "none" }}
                  >
                    📱 Hubungi Vendor
                  </a>
                )}
                {selectedPO.status === "draft" && (
                  <button onClick={() => handleSend(selectedPO.id)} disabled={actionLoading === selectedPO.id}
                    style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#F59E0B", cursor: "pointer", fontSize: 12 }}>
                    📤 Kirim PO
                  </button>
                )}
                {selectedPO.status === "sent" && (
                  <button onClick={() => handleReceive(selectedPO.id)} disabled={actionLoading === selectedPO.id}
                    style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22C55E", cursor: "pointer", fontSize: 12 }}>
                    ✓ Konfirmasi Terima
                  </button>
                )}
                <button style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #2D2D44", background: "transparent", color: "#6B7280", cursor: "pointer", fontSize: 12 }}>
                  📄 Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
