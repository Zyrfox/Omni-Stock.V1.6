"use client";

import { useState } from "react";
import { runMigration } from "@/actions/migration";
import { useRouter } from "next/navigation";

export function SettingsClient({ isMigrated }: { isMigrated: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleMigration() {
    if (!confirm("Migrasi hanya dapat dilakukan SEKALI dan tidak dapat diurungkan. Lanjutkan?")) return;
    setLoading(true);
    try {
      const res = await runMigration();
      setResult(res.message);
      router.refresh();
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>One-Way Bridge Migration</div>
      <p style={{ fontSize: 11, color: "var(--color-os-sub)", marginBottom: 16, lineHeight: 1.6 }}>
        Migrasi data one-way dari Google Sheets ke Supabase. Hanya dapat dilakukan sekali — setelah selesai, tombol dikunci permanen.
      </p>

      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: isMigrated ? "color-mix(in srgb, var(--color-os-green) 8%, transparent)" : "color-mix(in srgb, var(--color-os-amber) 8%, transparent)",
          border: `1px solid ${isMigrated ? "color-mix(in srgb, var(--color-os-green) 30%, transparent)" : "color-mix(in srgb, var(--color-os-amber) 30%, transparent)"}`,
          marginBottom: 16,
          fontSize: 12,
          color: isMigrated ? "var(--color-os-green)" : "var(--color-os-amber)",
          fontWeight: 600,
        }}
      >
        {isMigrated ? "✅ Migration Complete" : "⚠ Ready to Migrate"}
      </div>

      {result && (
        <div style={{ padding: "8px 12px", background: `var(--color-os-surface)`, borderRadius: 6, fontSize: 11, color: "var(--color-os-text)", marginBottom: 12 }}>
          {result}
        </div>
      )}

      <button
        onClick={handleMigration}
        disabled={isMigrated || loading}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 8,
          border: "none",
          background: isMigrated ? "color-mix(in srgb, var(--color-os-accent) 12%, transparent)" : loading ? "color-mix(in srgb, var(--color-os-accent) 12%, transparent)" : "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))",
          color: isMigrated || loading ? "var(--color-os-muted)" : `var(--color-os-bg)`,
          fontSize: 12,
          fontWeight: 800,
          cursor: isMigrated || loading ? "not-allowed" : "pointer",
          opacity: isMigrated || loading ? 0.7 : 1,
        }}
      >
        {isMigrated ? "✓ Migration Complete (Locked)" : loading ? "Migrating..." : "🔄 Sync from Google Sheets"}
      </button>
    </div>
  );
}
