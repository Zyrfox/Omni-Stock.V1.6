/**
 * OMNI-STOCK — Seed Script
 * Creates:
 *   - 1 default outlet
 *   - 1 admin user (must_change_password: false)
 *
 * Usage: npx tsx src/db/seed.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as bcrypt from "bcrypt";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Create default outlet
  const outletId = "OUT-001";
  await db
    .insert(schema.outlets)
    .values({ id: outletId, namaOutlet: "Pusat - Easy Going Group" })
    .onConflictDoNothing();
  console.log("✅ Outlet created: OUT-001 — Pusat Easy Going Group");

  // 2. Create admin user
  const adminId = "USR-001";
  const adminEmail = "admin@easygoing.id";
  const adminPassword = "Admin@123456"; // Change immediately after login
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db
    .insert(schema.users)
    .values({
      id: adminId,
      email: adminEmail,
      nama: "Admin OMNI-STOCK",
      role: "admin",
      passwordHash,
      mustChangePassword: false,
      outletId: null, // admin has access to all outlets
    })
    .onConflictDoNothing();

  console.log("✅ Admin user created:");
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Role:     admin`);
  console.log("\n⚠️  PENTING: Ganti password admin setelah login pertama kali!");

  // 3. Initialize system_configs
  await db
    .insert(schema.systemConfigs)
    .values({ key: "is_initial_migration_done", value: "false" })
    .onConflictDoNothing();
  console.log("✅ system_configs initialized");

  console.log("\n🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
