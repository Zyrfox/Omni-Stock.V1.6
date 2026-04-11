export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { POLogsClient } from "./po-logs-client";
import { getPurchaseOrders, getPOStats } from "@/actions/purchase-order";
import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { like } from "drizzle-orm";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";

export default async function POLogsPage() {
  const [orders, stats, outletList, waTemplateRows] = await Promise.all([
    getPurchaseOrders(),
    getPOStats(),
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
      <POLogsClient
        orders={orders as any}
        stats={stats}
        outletList={outletList.map((o) => ({ id: o.id, namaOutlet: o.namaOutlet }))}
        waTemplates={waTemplates}
      />
    </Suspense>
  );
}
