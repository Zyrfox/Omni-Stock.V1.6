export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { SuppliersClient } from "./suppliers-client";
import { getMasterVendorWithStats } from "@/actions/vendor";
import { getMasterBahan } from "@/actions/bahan";
import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { sql, like } from "drizzle-orm";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";

export default async function SuppliersPage() {
  const [vendors, bahanList, outletList, waTemplateRows] = await Promise.all([
    getMasterVendorWithStats(),
    getMasterBahan(),
    db.query.outlets.findMany({ orderBy: (o, { asc }) => [asc(o.namaOutlet)] }),
    db.select().from(systemConfigs).where(like(systemConfigs.key, "wa_template:%")),
  ]);

  const [statsResult] = await db.execute(
    sql`SELECT
      COUNT(*) as total_vendor,
      COUNT(*) FILTER (WHERE kontak_wa IS NOT NULL AND kontak_wa != '') as vendor_wa
    FROM master_vendor`
  ) as unknown as Array<{ total_vendor: string; vendor_wa: string }>;

  const waTemplates: Record<string, string> = {};
  for (const row of waTemplateRows) {
    const outletId = row.key.replace("wa_template:", "");
    waTemplates[outletId] = row.value ?? DEFAULT_WA_TEMPLATE;
  }

  return (
    <Suspense fallback={<div style={{ color: "var(--color-os-sub)", fontSize: 13 }}>Memuat...</div>}>
      <SuppliersClient
        vendors={vendors as any}
        allBahan={bahanList.map((b) => ({ id: b.id, namaBahan: b.namaBahan }))}
        stats={{
          totalVendor: parseInt(statsResult?.total_vendor ?? "0"),
          totalBahan: bahanList.length,
          vendorDenganWa: parseInt(statsResult?.vendor_wa ?? "0"),
        }}
        outletList={outletList.map((o) => ({ id: o.id, namaOutlet: o.namaOutlet }))}
        waTemplates={waTemplates}
      />
    </Suspense>
  );
}
