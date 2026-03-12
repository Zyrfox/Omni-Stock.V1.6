import { Suspense } from "react";
import { ProductsClient } from "./products-client";
import { getMasterBahan } from "@/actions/bahan";
import { getMasterMenu } from "@/actions/menu";
import { db } from "@/db";
import { semiFinished } from "@/db/schema";

export default async function ProductsPage() {
  const [bahanList, menuList, sfgList] = await Promise.all([
    getMasterBahan(),
    getMasterMenu(),
    db.query.semiFinished.findMany({ orderBy: (s, { asc }) => [asc(s.namaSemiFinished)] }),
  ]);

  return (
    <Suspense fallback={<div style={{ color: "#6B7280", fontSize: 13 }}>Memuat...</div>}>
      <ProductsClient bahanList={bahanList as any} menuList={menuList as any} sfgList={sfgList} />
    </Suspense>
  );
}
