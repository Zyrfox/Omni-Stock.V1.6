/** Shared category → ID prefix mapping for master_bahan */
export const KATEGORI_ABBR: Record<string, string> = {
  "Main Course": "MCR",
  "Snack": "SNCK",
  "Dessert": "DSRT",
  "Ice Cream": "ICE",
  "Noodles": "MIE",
  "Beverage": "BVRG",
  "Kemasan & Alat Makan": "PACK",
  "Raw Materials": "RM",
  "Bahan Produksi": "BP",
};

/** All category names in display order */
export const ALL_KATEGORI = Object.keys(KATEGORI_ABBR);

/** Outlet namaOutlet → ID abbreviation */
export const OUTLET_ABBR: Record<string, string> = {
  "Back To Mie Kitchen": "BTMK",
  "Back To Mie Forest": "BTMF",
  "Taman Sari Forest": "TSF",
  "Healthopia Clinic": "HC",
};

/** Get category abbreviation — falls back to "BHN" */
export function getKategoriAbbr(kategori: string | null | undefined): string {
  if (!kategori) return "BHN";
  return KATEGORI_ABBR[kategori] ?? "BHN";
}

/** Get outlet abbreviation from namaOutlet — falls back to uppercased initials */
export function getOutletAbbr(namaOutlet: string | null | undefined): string {
  if (!namaOutlet) return "GEN";
  if (OUTLET_ABBR[namaOutlet]) return OUTLET_ABBR[namaOutlet];
  // Derive from initials as fallback
  return namaOutlet
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
}
