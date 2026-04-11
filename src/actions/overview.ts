"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";

/* ── KPI Stats ──────────────────────────────────────────── */
export async function getOverviewStats() {
  // Revenue & COGS from sales
  const [salesStats] = (await db.execute(sql`
    SELECT
      COALESCE(SUM(st.qty_terjual * COALESCE(mm.harga_jual::numeric, 0)), 0) as revenue,
      COALESCE(SUM(st.qty_terjual * COALESCE(mm.total_cogs::numeric, 0)), 0) as cogs
    FROM sales_transactions st
    JOIN master_menu mm ON mm.id = st.menu_id
  `)) as unknown as Array<{ revenue: string; cogs: string }>;

  // PO spending (this month + total)
  const [poStats] = (await db.execute(sql`
    SELECT
      COALESCE(SUM(total_harga::numeric), 0) as total_spending,
      COALESCE(SUM(total_harga::numeric) FILTER (
        WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
      ), 0) as monthly_spending
    FROM purchase_orders
  `)) as unknown as Array<{ total_spending: string; monthly_spending: string }>;

  // Critical stock items
  const [stockStats] = (await db.execute(sql`
    SELECT COUNT(*) as critical_count
    FROM master_bahan
    WHERE stok_minimum > 0
  `)) as unknown as Array<{ critical_count: string }>;

  // Average margin across menus
  const menuRows = (await db.execute(sql`
    SELECT harga_jual::numeric as hj, total_cogs::numeric as cogs, platform_fee_percent::numeric as fee
    FROM master_menu
    WHERE harga_jual IS NOT NULL AND harga_jual::numeric > 0 AND total_cogs IS NOT NULL AND total_cogs::numeric > 0
  `)) as unknown as Array<{ hj: string; cogs: string; fee: string }>;

  let avgMargin = 0;
  if (menuRows.length > 0) {
    let marginSum = 0;
    for (const row of menuRows) {
      const hj = parseFloat(row.hj);
      const cogs = parseFloat(row.cogs);
      const fee = parseFloat(row.fee || "0");
      const net = hj - (hj * fee / 100);
      if (net > 0) marginSum += ((net - cogs) / net) * 100;
    }
    avgMargin = marginSum / menuRows.length;
  }

  // Menu & bahan counts
  const [counts] = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM master_menu) as menu_count,
      (SELECT COUNT(*) FROM master_bahan) as bahan_count,
      (SELECT COUNT(*) FROM master_vendor) as vendor_count
  `)) as unknown as Array<{ menu_count: string; bahan_count: string; vendor_count: string }>;

  return {
    revenue: parseFloat(salesStats?.revenue ?? "0"),
    cogs: parseFloat(salesStats?.cogs ?? "0"),
    grossProfit: parseFloat(salesStats?.revenue ?? "0") - parseFloat(salesStats?.cogs ?? "0"),
    avgMargin,
    totalSpending: parseFloat(poStats?.total_spending ?? "0"),
    monthlySpending: parseFloat(poStats?.monthly_spending ?? "0"),
    criticalCount: parseInt(stockStats?.critical_count ?? "0"),
    menuCount: parseInt(counts?.menu_count ?? "0"),
    bahanCount: parseInt(counts?.bahan_count ?? "0"),
    vendorCount: parseInt(counts?.vendor_count ?? "0"),
  };
}

/* ── Revenue vs COGS Monthly Trend ──────────────────────── */
export async function getRevenueCogsTrend() {
  const rows = (await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', st.tanggal_transaksi::timestamp), 'YYYY-MM') as month,
      COALESCE(SUM(st.qty_terjual * mm.harga_jual::numeric), 0) as revenue,
      COALESCE(SUM(st.qty_terjual * mm.total_cogs::numeric), 0) as cogs
    FROM sales_transactions st
    JOIN master_menu mm ON mm.id = st.menu_id
    WHERE st.tanggal_transaksi >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', st.tanggal_transaksi::timestamp)
    ORDER BY month
  `)) as unknown as Array<{ month: string; revenue: string; cogs: string }>;

  return (rows || []).map((r) => ({
    month: r.month,
    revenue: parseFloat(r.revenue),
    cogs: parseFloat(r.cogs),
    profit: parseFloat(r.revenue) - parseFloat(r.cogs),
  }));
}

/* ── Top Selling Items ──────────────────────────────────── */
export async function getTopSellingItems(limit = 10) {
  const rows = (await db.execute(sql`
    SELECT mm.nama_menu, SUM(st.qty_terjual) as total_sold,
      SUM(st.qty_terjual * mm.harga_jual::numeric) as total_revenue
    FROM sales_transactions st
    JOIN master_menu mm ON mm.id = st.menu_id
    GROUP BY mm.id, mm.nama_menu
    ORDER BY total_sold DESC
    LIMIT ${limit}
  `)) as unknown as Array<{ nama_menu: string; total_sold: string; total_revenue: string }>;

  return (rows || []).map((r) => ({
    name: r.nama_menu,
    sold: parseInt(r.total_sold),
    revenue: parseFloat(r.total_revenue),
  }));
}

/* ── Cost Breakdown by Kategori Bahan ───────────────────── */
export async function getCostBreakdownByCategory() {
  const rows = (await db.execute(sql`
    SELECT
      COALESCE(mb.kategori_bahan, 'Lainnya') as kategori,
      SUM(mr.qty::numeric * mb.harga_per_satuan_porsi::numeric) as total_cost
    FROM mapping_resep mr
    JOIN master_bahan mb ON mb.id = mr.item_id
    WHERE mr.item_type = 'bahan_dasar' AND mb.harga_per_satuan_porsi IS NOT NULL
    GROUP BY mb.kategori_bahan
    ORDER BY total_cost DESC
  `)) as unknown as Array<{ kategori: string; total_cost: string }>;

  return (rows || []).map((r) => ({
    name: r.kategori,
    value: parseFloat(r.total_cost),
  }));
}

/* ── Vendor Spending ────────────────────────────────────── */
export async function getVendorSpending() {
  const rows = (await db.execute(sql`
    SELECT mv.nama_vendor, SUM(po.total_harga::numeric) as total
    FROM purchase_orders po
    JOIN master_vendor mv ON mv.id = po.vendor_id
    GROUP BY mv.id, mv.nama_vendor
    ORDER BY total DESC
    LIMIT 8
  `)) as unknown as Array<{ nama_vendor: string; total: string }>;

  return (rows || []).map((r) => ({
    name: r.nama_vendor,
    value: parseFloat(r.total),
  }));
}

/* ── Margin Distribution ────────────────────────────────── */
export async function getMarginDistribution() {
  const rows = (await db.execute(sql`
    SELECT id, nama_menu, harga_jual::numeric as hj, total_cogs::numeric as cogs, platform_fee_percent::numeric as fee
    FROM master_menu
    WHERE harga_jual IS NOT NULL AND harga_jual::numeric > 0
  `)) as unknown as Array<{ id: string; nama_menu: string; hj: string; cogs: string; fee: string }>;

  // Bucket: red (<40), amber (40-64), green (>=65)
  let red = 0, amber = 0, green = 0;
  for (const row of rows || []) {
    const hj = parseFloat(row.hj);
    const cogs = parseFloat(row.cogs || "0");
    const fee = parseFloat(row.fee || "0");
    const net = hj - (hj * fee / 100);
    const margin = net > 0 ? ((net - cogs) / net) * 100 : 0;
    if (margin < 40) red++;
    else if (margin < 65) amber++;
    else green++;
  }

  return [
    { name: "< 40%", value: red, fill: "#EF4444" },
    { name: "40-64%", value: amber, fill: "#F59E0B" },
    { name: ">= 65%", value: green, fill: "#22C55E" },
  ];
}

/* ── Monthly Purchase Trend ─────────────────────────────── */
export async function getMonthlyPurchaseTrend() {
  const rows = (await db.execute(sql`
    SELECT
      EXTRACT(MONTH FROM created_at) as month,
      COALESCE(SUM(total_harga::numeric), 0) as total
    FROM purchase_orders
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    GROUP BY month
    ORDER BY month
  `)) as unknown as Array<{ month: string; total: string }>;

  const monthMap = new Map<number, number>();
  (rows || []).forEach((r) => monthMap.set(parseInt(r.month), parseFloat(r.total)));

  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    value: monthMap.get(i + 1) ?? 0,
  }));
}

/* ── Stock Health Summary ───────────────────────────────── */
export async function getStockHealthSummary() {
  // We'll return counts based on master_bahan with stok_minimum > 0
  // Since actual stock levels come from uploads, we'll count based on stok_minimum presence
  const rows = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE stok_minimum > 0 AND avg_daily_consumption > 0 AND lead_time_days > 0) as tracked,
      COUNT(*) as total
    FROM master_bahan
  `)) as unknown as Array<{ tracked: string; total: string }>;

  return {
    tracked: parseInt(rows?.[0]?.tracked ?? "0"),
    total: parseInt(rows?.[0]?.total ?? "0"),
  };
}

/* ── Data Freshness ─────────────────────────────────────── */
export async function getDataFreshness() {
  const rows = (await db.execute(sql`
    SELECT
      o.nama_outlet,
      MAX(ub.tanggal_kartu_stok) as last_upload,
      MAX(ub.created_at) as last_upload_at
    FROM outlets o
    LEFT JOIN upload_batches ub ON ub.outlet_id = o.id
    GROUP BY o.id, o.nama_outlet
    ORDER BY o.nama_outlet
  `)) as unknown as Array<{ nama_outlet: string; last_upload: string | null; last_upload_at: string | null }>;

  return (rows || []).map((r) => ({
    outlet: r.nama_outlet,
    lastUpload: r.last_upload,
    lastUploadAt: r.last_upload_at,
  }));
}
