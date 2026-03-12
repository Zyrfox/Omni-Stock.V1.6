import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  numeric,
  real,
  timestamp,
  date,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["admin", "manager"]);
export const tipeBahanEnum = pgEnum("tipe_bahan", ["packaged", "raw_bulk"]);
export const consumptionSourceEnum = pgEnum("consumption_source", ["manual", "auto"]);
export const kategoriMenuEnum = pgEnum("kategori_menu", ["food", "beverage"]);
export const parentTypeEnum = pgEnum("parent_type", ["menu", "semi_finished"]);
export const itemTypeEnum = pgEnum("item_type", ["bahan_dasar", "semi_finished"]);
export const poStatusEnum = pgEnum("po_status", ["draft", "sent", "received"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["pending", "in_transit", "delivered"]);

// ─── 1. system_configs ───────────────────────────────────
export const systemConfigs = pgTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value"),
});

// ─── 2. outlets ──────────────────────────────────────────
export const outlets = pgTable("outlets", {
  id: text("id").primaryKey(), // OUT-001
  namaOutlet: text("nama_outlet").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 3. users ────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(), // USR-001
  email: text("email").notNull().unique(),
  nama: text("nama").notNull(),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").default(true),
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 4. master_bahan ─────────────────────────────────────
export const masterBahan = pgTable("master_bahan", {
  id: text("id").primaryKey(), // BHN-001
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  namaBahan: text("nama_bahan").notNull(),
  tipeBahan: tipeBahanEnum("tipe_bahan").notNull(),
  kategoriBahan: text("kategori_bahan"),
  hargaBeli: numeric("harga_beli", { precision: 15, scale: 2 }).notNull(),
  satuanBeli: text("satuan_beli").notNull(), // e.g. "1_karung"
  isiSatuan: numeric("isi_satuan", { precision: 15, scale: 4 }).notNull(), // yield per kemasan
  satuanDapur: text("satuan_dapur").notNull(), // e.g. "gram"
  stokMinimum: integer("stok_minimum").notNull(),
  leadTimeDays: integer("lead_time_days").notNull().default(1),
  avgDailyConsumption: real("avg_daily_consumption").notNull().default(0),
  avgConsumptionSource: consumptionSourceEnum("avg_consumption_source").default("manual"),
  hargaPerSatuanPorsi: numeric("harga_per_satuan_porsi", { precision: 15, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── 5. semi_finished ────────────────────────────────────
export const semiFinished = pgTable("semi_finished", {
  id: text("id").primaryKey(), // SFG-001
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  namaSemiFinished: text("nama_semi_finished").notNull(),
  satuan: text("satuan").notNull(),
  stokMinimum: numeric("stok_minimum", { precision: 15, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 6. master_menu ──────────────────────────────────────
export const masterMenu = pgTable("master_menu", {
  id: text("id").primaryKey(), // MNU-001
  namaMenu: text("nama_menu").notNull(),
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  kategori: kategoriMenuEnum("kategori"),
  hargaJual: numeric("harga_jual", { precision: 15, scale: 2 }),
  totalCogs: numeric("total_cogs", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── 7. mapping_resep ────────────────────────────────────
export const mappingResep = pgTable("mapping_resep", {
  id: text("id").primaryKey(), // RSP-001
  parentId: text("parent_id").notNull(), // MNU-xxx or SFG-xxx
  parentType: parentTypeEnum("parent_type").notNull(),
  itemId: text("item_id").notNull(), // BHN-xxx or SFG-xxx
  itemType: itemTypeEnum("item_type").notNull(),
  qty: numeric("qty", { precision: 15, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 8. master_vendor ────────────────────────────────────
export const masterVendor = pgTable("master_vendor", {
  id: text("id").primaryKey(), // VND-001
  namaVendor: text("nama_vendor").notNull(),
  noRekening: text("no_rekening"),
  kontakWa: text("kontak_wa"),
  estimasiPengiriman: integer("estimasi_pengiriman").notNull().default(3), // lead time hari
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── 9. vendor_bahan (Many-to-Many) ──────────────────────
export const vendorBahan = pgTable(
  "vendor_bahan",
  {
    id: text("id").primaryKey(), // VBH-001
    vendorId: text("vendor_id")
      .references(() => masterVendor.id, { onDelete: "cascade" })
      .notNull(),
    bahanId: text("bahan_id")
      .references(() => masterBahan.id, { onDelete: "cascade" })
      .notNull(),
    hargaPerSatuan: numeric("harga_per_satuan", { precision: 15, scale: 2 }).notNull(),
    isPrimary: boolean("is_primary").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique("unique_vendor_bahan").on(t.vendorId, t.bahanId)]
);

// ─── 10. sales_transactions ──────────────────────────────
export const salesTransactions = pgTable("sales_transactions", {
  id: text("id").primaryKey(), // TRX-001
  outletId: text("outlet_id")
    .references(() => outlets.id, { onDelete: "cascade" })
    .notNull(),
  uploadBatchId: text("upload_batch_id").notNull(), // grouping per sesi upload
  tanggalTransaksi: date("tanggal_transaksi").notNull(),
  menuId: text("menu_id")
    .references(() => masterMenu.id, { onDelete: "cascade" })
    .notNull(),
  qtyTerjual: integer("qty_terjual").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 11. purchase_orders ─────────────────────────────────
export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(), // PO-001
  outletId: text("outlet_id")
    .references(() => outlets.id, { onDelete: "cascade" })
    .notNull(),
  vendorId: text("vendor_id")
    .references(() => masterVendor.id, { onDelete: "restrict" })
    .notNull(),
  bahanId: text("bahan_id")
    .references(() => masterBahan.id, { onDelete: "restrict" })
    .notNull(),
  status: poStatusEnum("status").notNull().default("draft"),
  qtyOrder: numeric("qty_order", { precision: 15, scale: 4 }).notNull(),
  hargaSatuan: numeric("harga_satuan", { precision: 15, scale: 2 }).notNull(),
  totalHarga: numeric("total_harga", { precision: 15, scale: 2 }).notNull(),
  aiNotes: text("ai_notes"),
  tanggalKirim: timestamp("tanggal_kirim"),
  tanggalTerima: timestamp("tanggal_terima"),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Type Exports ─────────────────────────────────────────
export type SystemConfig = typeof systemConfigs.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MasterBahan = typeof masterBahan.$inferSelect;
export type NewMasterBahan = typeof masterBahan.$inferInsert;
export type SemiFinished = typeof semiFinished.$inferSelect;
export type MasterMenu = typeof masterMenu.$inferSelect;
export type MappingResep = typeof mappingResep.$inferSelect;
export type MasterVendor = typeof masterVendor.$inferSelect;
export type NewMasterVendor = typeof masterVendor.$inferInsert;
export type VendorBahan = typeof vendorBahan.$inferSelect;
export type SalesTransaction = typeof salesTransactions.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
