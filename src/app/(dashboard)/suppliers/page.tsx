import { Suspense } from "react";
import { SuppliersClient } from "./suppliers-client";
import { getMasterVendorWithStats } from "@/actions/vendor";
import { getMasterBahan } from "@/actions/bahan";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export default async function SuppliersPage() {
  const [vendors, bahanList] = await Promise.all([
    getMasterVendorWithStats(),
    getMasterBahan(),
  ]);

  const [statsResult] = await db.execute(
    sql`SELECT
      COUNT(*) as total_vendor,
      COUNT(*) FILTER (WHERE kontak_wa IS NOT NULL AND kontak_wa != '') as vendor_wa
    FROM master_vendor`
  ) as unknown as Array<{ total_vendor: string; vendor_wa: string }>;

  const totalBahan = bahanList.length;

  return (
    <Suspense fallback={<div style={{ color: "#6B7280", fontSize: 13 }}>Memuat...</div>}>
      <SuppliersClient
        vendors={vendors as any}
        bahanList={bahanList as any}
        stats={{
          totalVendor: parseInt(statsResult?.total_vendor ?? "0"),
          totalBahan,
          vendorDenganWa: parseInt(statsResult?.vendor_wa ?? "0"),
        }}
      />
    </Suspense>
  );
}
