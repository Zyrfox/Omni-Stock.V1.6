export const revalidate = 60;

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { StatCard } from "@/components/shared/stat-card";
import { Store, DollarSign, BarChart2, AlertTriangle } from "lucide-react";
import { StoresClient } from "./stores-client";

export default async function StoresPage() {
  const outletList = await db.query.outlets.findMany();

  const [statsResult] = await db.execute(
    sql`SELECT COUNT(*) as total FROM outlets`
  ) as unknown as Array<{ total: string }>;

  // Menu profitability: menu + cogs + harga_jual + terjual last 30 days
  const menuProfitList = await db.execute(
    sql`SELECT
      mm.id,
      mm.nama_menu,
      mm.total_cogs,
      mm.harga_jual,
      COALESCE(SUM(st.qty_terjual), 0) as terjual_bulan
    FROM master_menu mm
    LEFT JOIN sales_transactions st
      ON st.menu_id = mm.id
      AND st.tanggal_transaksi >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY mm.id, mm.nama_menu, mm.total_cogs, mm.harga_jual
    ORDER BY mm.nama_menu`
  ) as unknown as Array<{
    id: string; nama_menu: string; total_cogs: string | null;
    harga_jual: string | null; terjual_bulan: string;
  }>;

  const formattedMenuList = menuProfitList.map((m) => ({
    id: m.id,
    namaMenu: m.nama_menu,
    totalCogs: m.total_cogs,
    hargaJual: m.harga_jual,
    terjualBulan: m.terjual_bulan,
  }));

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Stores</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Compliance & performa per outlet</p>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Outlet" value={parseInt(statsResult?.total ?? "0")} icon={Store} color="var(--color-os-blue)" sub="Aktif" />
        <StatCard label="Inventory Net Worth" value="Rp 0" icon={DollarSign} color="var(--color-os-green)" sub="Total semua cabang" />
        <StatCard label="Avg Upload Compliance" value="0%" icon={BarChart2} color="var(--color-os-amber)" sub="Target: 80%" />
        <StatCard label="Butuh Perhatian" value="0" icon={AlertTriangle} color="var(--color-os-red)" sub="Compliance rendah" />
      </div>

      <StoresClient
        outletList={outletList}
        menuProfitList={formattedMenuList}
        totalOutlet={parseInt(statsResult?.total ?? "0")}
      />
    </div>
  );
}
