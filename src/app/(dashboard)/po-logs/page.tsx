export const revalidate = 60;

import { Suspense } from "react";
import { POLogsClient } from "./po-logs-client";
import { getPurchaseOrders, getPOStats } from "@/actions/purchase-order";

export default async function POLogsPage() {
  const [orders, stats] = await Promise.all([
    getPurchaseOrders(),
    getPOStats(),
  ]);

  return (
    <Suspense fallback={<div style={{ color: "#6B7280", fontSize: 13 }}>Memuat...</div>}>
      <POLogsClient orders={orders as any} stats={stats} />
    </Suspense>
  );
}
