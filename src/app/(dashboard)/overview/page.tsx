export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { OverviewClient } from "./overview-client";
import {
  getOverviewStats,
  getRevenueCogsTrend,
  getTopSellingItems,
  getCostBreakdownByCategory,
  getVendorSpending,
  getMarginDistribution,
  getMonthlyPurchaseTrend,
  getStockHealthSummary,
  getDataFreshness,
} from "@/actions/overview";

export default async function OverviewPage() {
  const [
    stats,
    revenueTrend,
    topSelling,
    costByCategory,
    vendorSpending,
    marginDist,
    purchaseTrend,
    stockHealth,
    freshness,
  ] = await Promise.all([
    getOverviewStats(),
    getRevenueCogsTrend(),
    getTopSellingItems(),
    getCostBreakdownByCategory(),
    getVendorSpending(),
    getMarginDistribution(),
    getMonthlyPurchaseTrend(),
    getStockHealthSummary(),
    getDataFreshness(),
  ]);

  return (
    <Suspense fallback={<div style={{ color: "var(--color-os-sub)", fontSize: 13 }}>Memuat...</div>}>
      <OverviewClient
        stats={stats}
        revenueTrend={revenueTrend}
        topSelling={topSelling}
        costByCategory={costByCategory}
        vendorSpending={vendorSpending}
        marginDist={marginDist}
        purchaseTrend={purchaseTrend}
        stockHealth={stockHealth}
        freshness={freshness}
      />
    </Suspense>
  );
}
