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
import { relations } from "drizzle-orm";

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
  name: text("name").notNull().default(""),           // Better Auth required field
  emailVerified: boolean("email_verified").notNull().default(false), // Better Auth required
  image: text("image"),                               // Better Auth optional
  nama: text("nama").notNull().default(""),           // App display name (Indonesian)
  role: roleEnum("role").notNull().default("manager"),
  passwordHash: text("password_hash"),               // Reference copy (auth via accounts table)
  mustChangePassword: boolean("must_change_password").default(true),
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Better Auth: sessions ────────────────────────────────
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// ─── Better Auth: accounts ────────────────────────────────
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// ─── Better Auth: verifications ───────────────────────────
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  jumlahHasil: numeric("jumlah_hasil", { precision: 15, scale: 4 }).notNull().default("1"),
  satuanHasil: text("satuan_hasil").notNull().default("porsi"),
  totalCogs: numeric("total_cogs", { precision: 15, scale: 2 }).notNull().default("0"),
  cogsPerUnit: numeric("cogs_per_unit", { precision: 15, scale: 6 }).notNull().default("0"),
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
  // Channel grouping — "dine_in" | "takeaway" | "grabfood" | "shopee" | "gofood" | "other"
  channelType: text("channel_type"),
  // Platform commission % (e.g. 20 = 20%). Used to compute effective margin.
  platformFeePercent: numeric("platform_fee_percent", { precision: 5, scale: 2 }).default("0"),
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
  estimasiPengiriman: integer("estimasi_pengiriman").notNull().default(3),
  vendorPlatform: text("vendor_platform").default("offline"), // "offline" | "shopee" | "tokopedia" | "whatsapp" | "lainnya"
  linkToko: text("link_toko"), // URL to online store (Shopee, Tokopedia, etc.)
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
  uploadBatchId: text("upload_batch_id").notNull(),
  tanggalTransaksi: date("tanggal_transaksi").notNull(),
  menuId: text("menu_id")
    .references(() => masterMenu.id, { onDelete: "cascade" })
    .notNull(),
  qtyTerjual: integer("qty_terjual").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 11. upload_batches ──────────────────────────────────
export const uploadBatches = pgTable("upload_batches", {
  id: text("id").primaryKey(), // UPL-001
  outletId: text("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  tanggalKartuStok: date("tanggal_kartu_stok").notNull(), // date from header row of Kartu Stok file
  outletNameRaw: text("outlet_name_raw"), // outlet name as read from Excel (before matching)
  totalProduk: integer("total_produk").notNull().default(0), // total rows in Excel
  matchedBahan: integer("matched_bahan").notNull().default(0), // rows matched to master_bahan
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── 12. purchase_orders ─────────────────────────────────
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
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }), // nullable — survives user deletion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Relations ────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  outlet: one(outlets, { fields: [users.outletId], references: [outlets.id] }),
  purchaseOrders: many(purchaseOrders),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const outletsRelations = relations(outlets, ({ many }) => ({
  users: many(users),
  masterBahan: many(masterBahan),
  masterMenu: many(masterMenu),
  masterVendor: many(masterVendor),
  salesTransactions: many(salesTransactions),
  purchaseOrders: many(purchaseOrders),
  uploadBatches: many(uploadBatches),
}));

export const uploadBatchesRelations = relations(uploadBatches, ({ one }) => ({
  outlet: one(outlets, { fields: [uploadBatches.outletId], references: [outlets.id] }),
  uploadedByUser: one(users, { fields: [uploadBatches.uploadedBy], references: [users.id] }),
}));

export const masterBahanRelations = relations(masterBahan, ({ one, many }) => ({
  outlet: one(outlets, { fields: [masterBahan.outletId], references: [outlets.id] }),
  vendorBahan: many(vendorBahan),
  purchaseOrders: many(purchaseOrders),
  mappingResep: many(mappingResep, { relationName: "bahanInRecipe" }),
}));

export const masterVendorRelations = relations(masterVendor, ({ one, many }) => ({
  outlet: one(outlets, { fields: [masterVendor.outletId], references: [outlets.id] }),
  vendorBahan: many(vendorBahan),
  purchaseOrders: many(purchaseOrders),
}));

export const vendorBahanRelations = relations(vendorBahan, ({ one }) => ({
  vendor: one(masterVendor, { fields: [vendorBahan.vendorId], references: [masterVendor.id] }),
  bahan: one(masterBahan, { fields: [vendorBahan.bahanId], references: [masterBahan.id] }),
}));

export const masterMenuRelations = relations(masterMenu, ({ one, many }) => ({
  outlet: one(outlets, { fields: [masterMenu.outletId], references: [outlets.id] }),
  salesTransactions: many(salesTransactions),
  mappingResep: many(mappingResep, { relationName: "menuRecipes" }),
}));

export const mappingResepRelations = relations(mappingResep, ({ one }) => ({
  // Link itemId → master_bahan (works for bahan_dasar items; null for semi_finished)
  bahan: one(masterBahan, {
    fields: [mappingResep.itemId],
    references: [masterBahan.id],
    relationName: "bahanInRecipe",
  }),
  // Link parentId → master_menu (works for menu parents; null for semi_finished parents)
  parentMenu: one(masterMenu, {
    fields: [mappingResep.parentId],
    references: [masterMenu.id],
    relationName: "menuRecipes",
  }),
  // Link parentId → semi_finished (works for semi_finished parents)
  parentSfg: one(semiFinished, {
    fields: [mappingResep.parentId],
    references: [semiFinished.id],
    relationName: "sfgRecipes",
  }),
}));

export const salesTransactionsRelations = relations(salesTransactions, ({ one }) => ({
  outlet: one(outlets, { fields: [salesTransactions.outletId], references: [outlets.id] }),
  menu: one(masterMenu, { fields: [salesTransactions.menuId], references: [masterMenu.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one }) => ({
  outlet: one(outlets, { fields: [purchaseOrders.outletId], references: [outlets.id] }),
  vendor: one(masterVendor, { fields: [purchaseOrders.vendorId], references: [masterVendor.id] }),
  bahan: one(masterBahan, { fields: [purchaseOrders.bahanId], references: [masterBahan.id] }),
  createdByUser: one(users, { fields: [purchaseOrders.createdBy], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const semiFinishedRelations = relations(semiFinished, ({ one, many }) => ({
  outlet: one(outlets, { fields: [semiFinished.outletId], references: [outlets.id] }),
  mappingResep: many(mappingResep, { relationName: "sfgRecipes" }),
}));

// ─── Type Exports ─────────────────────────────────────────
export type SystemConfig = typeof systemConfigs.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbSession = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type MasterBahan = typeof masterBahan.$inferSelect;
export type NewMasterBahan = typeof masterBahan.$inferInsert;
export type SemiFinished = typeof semiFinished.$inferSelect;
export type MasterMenu = typeof masterMenu.$inferSelect;
export type MappingResep = typeof mappingResep.$inferSelect;
export type MasterVendor = typeof masterVendor.$inferSelect;
export type NewMasterVendor = typeof masterVendor.$inferInsert;
export type VendorBahan = typeof vendorBahan.$inferSelect;
export type SalesTransaction = typeof salesTransactions.$inferSelect;
export type UploadBatch = typeof uploadBatches.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
