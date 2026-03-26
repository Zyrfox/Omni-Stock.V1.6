export const revalidate = 60;

import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const migrationConfig = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "is_initial_migration_done"),
  });

  const isMigrated = migrationConfig?.value === "true";

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Konfigurasi sistem — Admin Only</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Card 1 — One-Way Migration */}
        <SettingsClient isMigrated={isMigrated} />

        {/* Card 2 — Supabase PITR */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 16 }}>Supabase PITR Backup</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#22C55E", fontWeight: 600 }}>● PITR Active</span>
          </div>
          {[
            { label: "Retention Period", value: "7 days" },
            { label: "Region", value: "ap-southeast-1" },
            { label: "Storage", value: "Configured in Supabase Dashboard" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}>
              <span style={{ fontSize: 11, color: "#4B5563" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#E2E8F0" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Card 3 — Auth Info */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 16 }}>Auth (Better Auth)</div>
          {[
            { label: "Provider", value: "Email + Password" },
            { label: "Library", value: "better-auth" },
            { label: "Session", value: "JWT · 7 hari" },
            { label: "Allowed Domain", value: process.env.NEXT_PUBLIC_APP_URL ?? "localhost:3000" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}>
              <span style={{ fontSize: 11, color: "#4B5563" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#E2E8F0" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Card 4 — System Info */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 16 }}>System Info</div>
          {[
            { label: "Version", value: "V1.5 Phase 1" },
            { label: "Framework", value: "Next.js 15 (App Router)" },
            { label: "Database", value: "Supabase PostgreSQL" },
            { label: "ORM", value: "Drizzle ORM" },
            { label: "AI Engine", value: "Google Gemini API" },
            { label: "Deployment", value: "Vercel" },
            { label: "ID Format", value: "PREFIX-001 (no UUID)" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}>
              <span style={{ fontSize: 11, color: "#4B5563" }}>{label}</span>
              <span style={{ fontSize: 11, color: "#C8F135" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
