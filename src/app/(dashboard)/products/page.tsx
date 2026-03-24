export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ProductsClient } from "./products-client";
import { getMasterBahan } from "@/actions/bahan";
import { getMasterMenu } from "@/actions/menu";
import { getSemiFinished } from "@/actions/semi-finished";
import { getOutlets } from "@/actions/outlet";
import { getMasterVendor } from "@/actions/vendor";

export default async function ProductsPage() {
  const [bahanList, menuList, sfgList, outletList, vendorList] = await Promise.all([
    getMasterBahan(),
    getMasterMenu(),
    getSemiFinished(),
    getOutlets(),
    getMasterVendor(),
  ]);

  return (
    <Suspense fallback={<div style={{ color: "#6B7280", fontSize: 13 }}>Memuat...</div>}>
      <ProductsClient
        bahanList={bahanList as any}
        menuList={menuList as any}
        sfgList={sfgList}
        outletList={outletList}
        vendorList={vendorList as any}
      />
    </Suspense>
  );
}
