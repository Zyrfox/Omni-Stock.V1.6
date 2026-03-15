export const revalidate = 60;

import { db } from "@/db";
import { masterBahan } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { CategoryClient } from "./category-client";

const ASSET_CATEGORIES = ["Barang Habis Pakai", "Peralatan Operasional", "Aset Tetap", "Bahan Operasional"];

export default async function CategoryPage() {
  const bahanList = await db.query.masterBahan.findMany({
    where: inArray(masterBahan.kategoriBahan, ASSET_CATEGORIES),
    orderBy: (b, { asc }) => [asc(b.namaBahan)],
  });

  return <CategoryClient bahanList={bahanList as any} />;
}
