export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";
import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { sql, like } from "drizzle-orm";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";

async function getDashboardData() {
  const [totalBahan] = await db.execute(
    sql`SELECT COUNT(*) as count FROM master_bahan`
  ) as unknown as Array<{ count: string }>;

  const recentPOs = await db.query.purchaseOrders.findMany({
    with: { vendor: true, bahan: true, outlet: true },
    orderBy: (po, { desc }) => [desc(po.createdAt)],
    limit: 10,
  });

  const allBahan = await db.query.masterBahan.findMany({
    with: {
      vendorBahan: {
        with: { vendor: true },
        where: (vb, { eq }) => eq(vb.isPrimary, true),
        limit: 1,
      },
    },
    orderBy: (b, { asc }) => [asc(b.namaBahan)],
  });

  // Widget 1 — Top Contributors (users by PO count)
  const topContributors = await db.execute(
    sql`SELECT u.id, u.nama, u.email, u.role,
      COUNT(po.id) as po_count
    FROM users u
    LEFT JOIN purchase_orders po ON po.created_by = u.id
    GROUP BY u.id, u.nama, u.email, u.role
    ORDER BY po_count DESC
    LIMIT 3`
  ) as unknown as Array<{ id: string; nama: string; email: string; role: string; po_count: string }>;

  // Widget 2 — Audit Pengeluaran
  const [auditStats] = await db.execute(
    sql`SELECT
      COALESCE(SUM(total_harga) FILTER (WHERE status != 'received'), 0) as outstanding,
      COALESCE(SUM(total_harga) FILTER (WHERE status = 'received'), 0) as paid
    FROM purchase_orders`
  ) as unknown as Array<{ outstanding: string; paid: string }>;

  const topVendors = await db.execute(
    sql`SELECT mv.nama_vendor,
      COALESCE(SUM(po.total_harga), 0) as total
    FROM purchase_orders po
    JOIN master_vendor mv ON mv.id = po.vendor_id
    GROUP BY mv.nama_vendor
    ORDER BY total DESC
    LIMIT 3`
  ) as unknown as Array<{ nama_vendor: string; total: string }>;

  return {
    totalBahan: parseInt(totalBahan?.count ?? "0"),
    recentPOs,
    allBahan,
    topContributors,
    auditData: {
      outstanding: parseFloat(auditStats?.outstanding ?? "0"),
      paid: parseFloat(auditStats?.paid ?? "0"),
      topVendors,
    },
  };
}

export default async function DashboardPage() {
  const [data, outletList, waTemplateRows] = await Promise.all([
    getDashboardData(),
    db.query.outlets.findMany({ orderBy: (o, { asc }) => [asc(o.namaOutlet)] }),
    db.select().from(systemConfigs).where(like(systemConfigs.key, "wa_template:%")),
  ]);

  const waTemplates: Record<string, string> = {};
  for (const row of waTemplateRows) {
    const outletId = row.key.replace("wa_template:", "");
    waTemplates[outletId] = row.value ?? DEFAULT_WA_TEMPLATE;
  }

  return (
    <Suspense fallback={<div style={{ color: "var(--color-os-sub)", fontSize: 13 }}>Memuat...</div>}>
      <DashboardClient
        totalBahan={data.totalBahan}
        recentPOs={data.recentPOs as any}
        allBahan={data.allBahan as any}
        topContributors={data.topContributors}
        auditData={data.auditData}
        outletList={outletList.map((o) => ({ id: o.id, namaOutlet: o.namaOutlet }))}
        waTemplates={waTemplates}
      />
    </Suspense>
  );
}
