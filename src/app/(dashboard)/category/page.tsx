import { db } from "@/db";
import { masterBahan } from "@/db/schema";
import { Badge } from "@/components/shared/badge-status";
import { CategoryClient } from "./category-client";

export default async function CategoryPage() {
  const bahanList = await db.query.masterBahan.findMany({
    orderBy: (b, { asc }) => [asc(b.namaBahan)],
  });

  return <CategoryClient bahanList={bahanList as any} />;
}
