"use server";

import { db } from "@/db";
import { masterBahan, masterMenu, masterVendor } from "@/db/schema";
import { ilike, or } from "drizzle-orm";

export interface SearchResult {
  type: "bahan" | "menu" | "vendor";
  id: string;
  label: string;
  sub?: string;
  href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = `%${query.trim()}%`;

  const [bahans, menus, vendors] = await Promise.all([
    db.query.masterBahan.findMany({
      where: ilike(masterBahan.namaBahan, q),
      columns: { id: true, namaBahan: true, kategoriBahan: true },
      limit: 5,
    }),
    db.query.masterMenu.findMany({
      where: ilike(masterMenu.namaMenu, q),
      columns: { id: true, namaMenu: true, kategori: true },
      limit: 5,
    }),
    db.query.masterVendor.findMany({
      where: or(ilike(masterVendor.namaVendor, q), ilike(masterVendor.kontakWa, q)),
      columns: { id: true, namaVendor: true, vendorPlatform: true },
      limit: 5,
    }),
  ]);

  const results: SearchResult[] = [];
  for (const b of bahans) {
    results.push({ type: "bahan", id: b.id, label: b.namaBahan, sub: b.kategoriBahan ?? "Bahan Baku", href: "/products" });
  }
  for (const m of menus) {
    results.push({ type: "menu", id: m.id, label: m.namaMenu, sub: m.kategori ?? "Menu", href: "/products" });
  }
  for (const v of vendors) {
    results.push({ type: "vendor", id: v.id, label: v.namaVendor, sub: v.vendorPlatform ?? "Supplier", href: "/suppliers" });
  }
  return results;
}

export interface CriticalAlert {
  bahanId: string;
  namaBahan: string;
  stokMinimum: number;
  vendorNama?: string;
}

export async function getCriticalBahan(): Promise<{ criticalCount: number; items: CriticalAlert[] }> {
  // Items with stok_minimum > 0 are "potentially critical" (we don't store current stock)
  // We flag items with high stok_minimum as needing attention
  const items = await db.query.masterBahan.findMany({
    where: (b, { gt }) => gt(b.stokMinimum, 0),
    with: {
      vendorBahan: {
        where: (vb, { eq }) => eq(vb.isPrimary, true),
        with: { vendor: true },
        limit: 1,
      },
    },
    orderBy: (b, { desc }) => [desc(b.stokMinimum)],
    limit: 10,
  });

  const alerts: CriticalAlert[] = items.map((b) => ({
    bahanId: b.id,
    namaBahan: b.namaBahan,
    stokMinimum: b.stokMinimum,
    vendorNama: b.vendorBahan[0]?.vendor?.namaVendor,
  }));

  return { criticalCount: alerts.length, items: alerts };
}
