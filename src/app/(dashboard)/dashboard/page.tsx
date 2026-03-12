import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";
import { db } from "@/db";
import { masterBahan, purchaseOrders, masterVendor } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";

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

  return {
    totalBahan: parseInt(totalBahan?.count ?? "0"),
    recentPOs,
    allBahan,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <Suspense fallback={<div style={{ color: "#6B7280", fontSize: 13 }}>Memuat...</div>}>
      <DashboardClient
        totalBahan={data.totalBahan}
        recentPOs={data.recentPOs as any}
        allBahan={data.allBahan as any}
      />
    </Suspense>
  );
}
