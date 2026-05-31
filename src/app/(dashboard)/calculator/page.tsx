export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { CalculatorClient } from "./calculator-client";
import { getCalculatorMaterialOptions, getMenuListForCalculator } from "@/actions/calculator";

export default async function CalculatorPage() {
  const [menuList, materialOptions] = await Promise.all([
    getMenuListForCalculator(),
    getCalculatorMaterialOptions(),
  ]);

  return (
    <Suspense fallback={<div style={{ color: "var(--color-os-sub)", fontSize: 13 }}>Memuat...</div>}>
      <CalculatorClient menuList={menuList} materialOptions={materialOptions} />
    </Suspense>
  );
}
