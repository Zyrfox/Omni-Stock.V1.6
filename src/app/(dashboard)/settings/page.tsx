export const revalidate = 60;

import { db } from "@/db";
import { systemConfigs, outlets } from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { SettingsClient } from "./settings-client";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";

export default async function SettingsPage() {
  const [migrationConfig, outletList, waTemplateRows] = await Promise.all([
    db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, "is_initial_migration_done"),
    }),
    db.query.outlets.findMany({ orderBy: (o, { asc }) => [asc(o.namaOutlet)] }),
    db.select().from(systemConfigs).where(like(systemConfigs.key, "wa_template:%")),
  ]);

  const isMigrated = migrationConfig?.value === "true";

  const waTemplates: Record<string, string> = {};
  for (const row of waTemplateRows) {
    const outletId = row.key.replace("wa_template:", "");
    waTemplates[outletId] = row.value ?? DEFAULT_WA_TEMPLATE;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Konfigurasi sistem — Admin & Manager</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Card 1 — One-Way Migration */}
        <SettingsClient isMigrated={isMigrated} outletList={outletList} waTemplates={waTemplates} />

        {/* Card 2 — Supabase PITR */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>Supabase PITR Backup</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-os-green)", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--color-os-green)", fontWeight: 600 }}>● PITR Active</span>
          </div>
          {[
            { label: "Retention Period", value: "7 days" },
            { label: "Region", value: "ap-southeast-1" },
            { label: "Storage", value: "Configured in Supabase Dashboard" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}>
              <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{label}</span>
              <span style={{ fontSize: 11, color: "var(--color-os-text)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Card 3 — Auth Info */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>Auth (Better Auth)</div>
          {[
            { label: "Provider", value: "Email + Password" },
            { label: "Library", value: "better-auth" },
            { label: "Session", value: "JWT · 7 hari" },
            { label: "Allowed Domain", value: process.env.NEXT_PUBLIC_APP_URL ?? "localhost:3000" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-os-border)" }}>
              <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{label}</span>
              <span style={{ fontSize: 11, color: "var(--color-os-text)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Card 4 — System Info */}
        <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>System Info</div>
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
              <span style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{label}</span>
              <span style={{ fontSize: 11, color: "var(--color-os-accent)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
