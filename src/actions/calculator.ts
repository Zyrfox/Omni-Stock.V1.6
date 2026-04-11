"use server";

import { db } from "@/db";
import {
  masterMenu,
  mappingResep,
  masterBahan,
  semiFinished,
  menuCostComponents,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/* ── Lightweight menu list for the selector ─────────────── */
export async function getMenuListForCalculator() {
  return db.query.masterMenu.findMany({
    columns: {
      id: true,
      namaMenu: true,
      kategori: true,
      totalCogs: true,
      hargaJual: true,
      channelType: true,
      platformFeePercent: true,
    },
    orderBy: (m, { asc }) => [asc(m.namaMenu)],
  });
}

/* ── Full calculator data for one menu ──────────────────── */
export async function getCalculatorData(menuId: string) {
  // 1. Menu record
  const menu = await db.query.masterMenu.findFirst({
    where: eq(masterMenu.id, menuId),
  });
  if (!menu) return null;

  // 2. BOM lines
  const bomLines = await db.query.mappingResep.findMany({
    where: eq(mappingResep.parentId, menuId),
  });

  // 3. Resolve ingredient details
  const bahanIds = bomLines
    .filter((l) => l.itemType === "bahan_dasar")
    .map((l) => l.itemId);
  const sfgIds = bomLines
    .filter((l) => l.itemType === "semi_finished")
    .map((l) => l.itemId);

  const [bahanRows, sfgRows] = await Promise.all([
    bahanIds.length > 0
      ? db.query.masterBahan.findMany({ where: inArray(masterBahan.id, bahanIds) })
      : Promise.resolve([]),
    sfgIds.length > 0
      ? db.query.semiFinished.findMany({ where: inArray(semiFinished.id, sfgIds) })
      : Promise.resolve([]),
  ]);

  const bahanMap = new Map(bahanRows.map((b) => [b.id, b]));
  const sfgMap = new Map(sfgRows.map((s) => [s.id, s]));

  const materialCosts = bomLines.map((line) => {
    if (line.itemType === "bahan_dasar") {
      const b = bahanMap.get(line.itemId);
      return {
        name: b?.namaBahan ?? line.itemId,
        qty: parseFloat(line.qty),
        unit: b?.satuanDapur ?? "",
        unitCost: parseFloat(b?.hargaPerSatuanPorsi ?? "0"),
        totalCost:
          parseFloat(line.qty) * parseFloat(b?.hargaPerSatuanPorsi ?? "0"),
      };
    } else {
      const s = sfgMap.get(line.itemId);
      return {
        name: s?.namaSemiFinished ?? line.itemId,
        qty: parseFloat(line.qty),
        unit: s?.satuanHasil ?? "porsi",
        unitCost: parseFloat(s?.cogsPerUnit ?? "0"),
        totalCost:
          parseFloat(line.qty) * parseFloat(s?.cogsPerUnit ?? "0"),
      };
    }
  });

  // 4. Existing cost components
  const components = await db.query.menuCostComponents.findMany({
    where: eq(menuCostComponents.menuId, menuId),
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  });

  return { menu, materialCosts, components };
}

/* ── Save cost components (delete + insert) ─────────────── */
export async function saveMenuCostComponents(
  menuId: string,
  items: Array<{
    type: "labor" | "equipment" | "other";
    name: string;
    qty: number;
    unit: string;
    rate: number;
    divisor: number;
  }>
) {
  // Delete existing
  await db
    .delete(menuCostComponents)
    .where(eq(menuCostComponents.menuId, menuId));

  if (items.length === 0) {
    revalidatePath("/calculator");
    return;
  }

  // Generate sequential IDs
  const lastIdResult = await db.execute(
    sql`SELECT id FROM menu_cost_components ORDER BY id DESC LIMIT 1`
  );
  const lastIdRows = lastIdResult as unknown as Array<{ id: string }>;
  let counter = 1;
  if (lastIdRows && lastIdRows.length > 0) {
    const lastPart = lastIdRows[0].id.split("-").pop() ?? "0";
    counter = (parseInt(lastPart, 10) || 0) + 1;
  }

  const rows = items.map((item) => {
    const id = `MCC-${String(counter++).padStart(3, "0")}`;
    let totalCost: number;
    if (item.type === "equipment") {
      totalCost = item.divisor > 0 ? item.rate / item.divisor : 0;
    } else {
      totalCost = item.qty * item.rate;
    }
    return {
      id,
      menuId,
      type: item.type,
      name: item.name,
      qty: String(item.qty),
      unit: item.unit || null,
      rate: String(item.rate),
      divisor: String(item.divisor || 1),
      totalCost: String(Math.round(totalCost * 100) / 100),
    };
  });

  await db.insert(menuCostComponents).values(rows);
  revalidatePath("/calculator");
}
