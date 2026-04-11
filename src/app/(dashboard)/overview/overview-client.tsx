"use client";

import { useAppContext } from "@/contexts/app-context";
import { formatRupiah, formatRupiahShort } from "@/lib/formatters";
import { StatCard } from "@/components/shared/stat-card";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import { MONTHS_ID } from "@/lib/constants";
import { exportToXlsx } from "@/lib/export-xlsx";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  ShoppingCart,
  AlertTriangle,
  Package,
  Users,
  Download,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

/* ── Types ──────────────────────────────────────────────── */
interface OverviewProps {
  stats: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    avgMargin: number;
    totalSpending: number;
    monthlySpending: number;
    criticalCount: number;
    menuCount: number;
    bahanCount: number;
    vendorCount: number;
  };
  revenueTrend: Array<{ month: string; revenue: number; cogs: number; profit: number }>;
  topSelling: Array<{ name: string; sold: number; revenue: number }>;
  costByCategory: Array<{ name: string; value: number }>;
  vendorSpending: Array<{ name: string; value: number }>;
  marginDist: Array<{ name: string; value: number; fill: string }>;
  purchaseTrend: Array<{ month: number; value: number }>;
  stockHealth: { tracked: number; total: number };
  freshness: Array<{ outlet: string; lastUpload: string | null; lastUploadAt: string | null }>;
}

/* ── Component ──────────────────────────────────────────── */
export function OverviewClient({
  stats,
  revenueTrend,
  topSelling,
  costByCategory,
  vendorSpending,
  marginDist,
  purchaseTrend,
  stockHealth,
  freshness,
}: OverviewProps) {
  const { userRole } = useAppContext();

  if (!["admin", "manager"].includes(userRole)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-os-sub)" }}>
        Akses ditolak — hanya Admin & Manager.
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-os-card)",
    border: "1px solid var(--color-os-border)",
    borderRadius: 12,
    padding: 20,
  };

  const chartTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--color-os-text)",
    margin: "0 0 12px",
  };

  const currentMonth = new Date().getMonth() + 1;

  /* ── Export all data ─────────────────────────────────── */
  function handleExport() {
    const rows: Record<string, unknown>[] = [];
    rows.push({ Section: "KPI", Metric: "Total Revenue", Value: stats.revenue });
    rows.push({ Section: "KPI", Metric: "Total COGS", Value: stats.cogs });
    rows.push({ Section: "KPI", Metric: "Gross Profit", Value: stats.grossProfit });
    rows.push({ Section: "KPI", Metric: "Avg Margin", Value: `${stats.avgMargin.toFixed(1)}%` });
    rows.push({ Section: "KPI", Metric: "PO Spending (Bulan Ini)", Value: stats.monthlySpending });
    rows.push({ Section: "", Metric: "", Value: "" });
    topSelling.forEach((t) => rows.push({ Section: "Top Selling", Metric: t.name, Value: t.sold, Revenue: t.revenue }));
    rows.push({ Section: "", Metric: "", Value: "" });
    vendorSpending.forEach((v) => rows.push({ Section: "Vendor Spending", Metric: v.name, Value: v.value }));
    exportToXlsx(rows, "Overview_Report");
  }

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Overview</h1>
          <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>
            Analitik bisnis — revenue, pengeluaran, & performa
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            fontSize: 11,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--color-os-border2)",
            background: "var(--color-os-surface)",
            color: "var(--color-os-sub)",
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Revenue" value={formatRupiahShort(stats.revenue)} icon={DollarSign} color="var(--color-os-green)" sub={stats.revenue > 0 ? formatRupiah(stats.revenue) : "Belum ada data sales"} />
        <StatCard label="Total COGS" value={formatRupiahShort(stats.cogs)} icon={TrendingDown} color="var(--color-os-red)" />
        <StatCard label="Gross Profit" value={formatRupiahShort(stats.grossProfit)} icon={TrendingUp} color={stats.grossProfit >= 0 ? "var(--color-os-accent)" : "var(--color-os-red)"} />
        <StatCard
          label="Avg Margin"
          value={`${stats.avgMargin.toFixed(1)}%`}
          icon={Percent}
          color={stats.avgMargin >= 65 ? "var(--color-os-green)" : stats.avgMargin >= 40 ? "var(--color-os-amber)" : "var(--color-os-red)"}
          sub={`${stats.menuCount} menu items`}
        />
        <StatCard label="PO Bulan Ini" value={formatRupiahShort(stats.monthlySpending)} icon={ShoppingCart} color="var(--color-os-blue)" />
        <StatCard
          label="Master Bahan"
          value={stats.bahanCount}
          icon={Package}
          color="var(--color-os-text)"
          sub={`${stats.vendorCount} vendor`}
        />
      </div>

      {/* Revenue vs COGS Trend */}
      {revenueTrend.length > 0 ? (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h3 style={chartTitleStyle}>Revenue vs COGS (12 Bulan)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cogsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-os-border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "var(--color-os-sub)" }}
                tickFormatter={(v: string) => {
                  const m = parseInt(v.split("-")[1]);
                  return MONTHS_ID[m - 1] || v;
                }}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} tickFormatter={(v) => formatRupiahShort(v)} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-os-sub)" }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22C55E" fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="cogs" name="COGS" stroke="#EF4444" fill="url(#cogsGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart title="Revenue vs COGS (12 Bulan)" text="Belum ada data sales. Import data penjualan dari Pawoon untuk melihat tren." />
      )}

      {/* Row 1: Top Selling + Margin Distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* Top Selling Items */}
        {topSelling.length > 0 ? (
          <div style={cardStyle}>
            <h3 style={chartTitleStyle}>Top 10 Menu Terlaris</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, topSelling.length * 30)}>
              <BarChart data={topSelling} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10, fill: "var(--color-os-sub)" }}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, name) => name === "sold" ? `${v} unit` : formatRupiah(Number(v))} />
                <Bar dataKey="sold" name="Terjual" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart title="Top 10 Menu Terlaris" text="Belum ada data penjualan." />
        )}

        {/* Margin Distribution */}
        <div style={cardStyle}>
          <h3 style={chartTitleStyle}>Distribusi Margin Menu</h3>
          {marginDist.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={marginDist} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => `${v} menu`} />
                <Bar dataKey="value" name="Jumlah Menu" radius={[4, 4, 0, 0]}>
                  {marginDist.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>
              Belum ada menu dengan harga jual.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            {marginDist.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.fill, display: "inline-block" }} />
                <span style={{ color: "var(--color-os-sub)" }}>{d.name}: <b style={{ color: "var(--color-os-text)" }}>{d.value}</b></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Cost by Category + Vendor Spending */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* Cost Breakdown by Category */}
        {costByCategory.length > 0 ? (
          <div style={cardStyle}>
            <h3 style={chartTitleStyle}>Biaya Bahan per Kategori</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={costByCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 10 }}
                >
                  {costByCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart title="Biaya Bahan per Kategori" text="Belum ada resep/BOM yang tercatat." />
        )}

        {/* Vendor Spending */}
        {vendorSpending.length > 0 ? (
          <div style={cardStyle}>
            <h3 style={chartTitleStyle}>Pengeluaran per Vendor</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={vendorSpending}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  dataKey="value"
                  label={({ name, percent }) => `${(name as string).length > 12 ? (name as string).slice(0, 12) + "…" : name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 10 }}
                >
                  {vendorSpending.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart title="Pengeluaran per Vendor" text="Belum ada PO yang tercatat." />
        )}
      </div>

      {/* Row 3: Monthly Purchase Trend + Stock Health */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* Monthly Purchase Trend */}
        <div style={cardStyle}>
          <h3 style={chartTitleStyle}>Tren Pembelian Bulanan ({new Date().getFullYear()})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={purchaseTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-os-border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "var(--color-os-sub)" }}
                tickFormatter={(v: number) => MONTHS_ID[v - 1]}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-os-sub)" }} tickFormatter={(v) => formatRupiahShort(v)} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRupiah(Number(v))} labelFormatter={(v) => MONTHS_ID[(Number(v)) - 1]} />
              <Bar dataKey="value" name="Pengeluaran" radius={[4, 4, 0, 0]}>
                {purchaseTrend.map((d, i) => (
                  <Cell key={i} fill={d.month === currentMonth ? CHART_COLORS[0] : CHART_COLORS[1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Health */}
        <div style={cardStyle}>
          <h3 style={chartTitleStyle}>Kesehatan Stok</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `conic-gradient(var(--color-os-accent) ${stockHealth.total > 0 ? (stockHealth.tracked / stockHealth.total) * 360 : 0}deg, var(--color-os-border2) 0deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
              }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "var(--color-os-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-accent)" }}>
                    {stockHealth.total > 0 ? Math.round((stockHealth.tracked / stockHealth.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-os-sub)" }}>Bahan Terpantau</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-os-text)" }}>{stockHealth.total}</div>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", textTransform: "uppercase" }}>Total Bahan</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-os-accent)" }}>{stockHealth.tracked}</div>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", textTransform: "uppercase" }}>Terpantau</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: stats.criticalCount > 0 ? "var(--color-os-red)" : "var(--color-os-green)" }}>
                  {stats.criticalCount}
                </div>
                <div style={{ fontSize: 10, color: "var(--color-os-muted)", textTransform: "uppercase" }}>Dgn Stok Min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Freshness Table */}
      {freshness.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h3 style={chartTitleStyle}>Data Freshness — Upload Terakhir per Outlet</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Tanggal Kartu Stok</th>
                  <th style={thStyle}>Upload At</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {freshness.map((f) => {
                  const daysSince = f.lastUploadAt
                    ? Math.floor((Date.now() - new Date(f.lastUploadAt).getTime()) / 86400000)
                    : null;
                  let badge: { label: string; color: string; bg: string };
                  if (daysSince === null) {
                    badge = { label: "Belum upload", color: "var(--color-os-muted)", bg: "var(--color-os-surface)" };
                  } else if (daysSince <= 3) {
                    badge = { label: "Fresh", color: "var(--color-os-green)", bg: "color-mix(in srgb, var(--color-os-green) 12%, transparent)" };
                  } else if (daysSince <= 7) {
                    badge = { label: `${daysSince}d ago`, color: "var(--color-os-amber)", bg: "color-mix(in srgb, var(--color-os-amber) 12%, transparent)" };
                  } else {
                    badge = { label: `${daysSince}d ago`, color: "var(--color-os-red)", bg: "color-mix(in srgb, var(--color-os-red) 12%, transparent)" };
                  }
                  return (
                    <tr key={f.outlet}>
                      <td style={tdStyle}>{f.outlet}</td>
                      <td style={tdStyle}>{f.lastUpload ?? "—"}</td>
                      <td style={tdStyle}>{f.lastUploadAt ? new Date(f.lastUploadAt).toLocaleDateString("id-ID") : "—"}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: badge.color,
                          background: badge.bg,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared table styles ──────────────────────────────── */
const thStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "var(--color-os-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "8px 12px",
  textAlign: "left",
  borderBottom: "1px solid var(--color-os-border)",
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "8px 12px",
  borderBottom: "1px solid var(--color-os-border)",
  color: "var(--color-os-text)",
};

/* ── Empty chart placeholder ──────────────────────────── */
function EmptyChart({ title, text }: { title: string; text: string }) {
  return (
    <div style={{
      background: "var(--color-os-card)",
      border: "1px solid var(--color-os-border)",
      borderRadius: 12,
      padding: 20,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 12px" }}>{title}</h3>
      <div style={{
        padding: 40,
        textAlign: "center",
        color: "var(--color-os-muted)",
        fontSize: 12,
        background: "var(--color-os-surface)",
        borderRadius: 8,
      }}>
        {text}
      </div>
    </div>
  );
}
