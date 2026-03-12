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
    <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 16 }}>One-Way Bridge Migration</div>
      <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
        Migrasi data one-way dari Google Sheets ke Supabase. Hanya dapat dilakukan sekali — setelah selesai, tombol dikunci permanen.
      </p>

      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: isMigrated ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${isMigrated ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
          marginBottom: 16,
          fontSize: 12,
          color: isMigrated ? "#22C55E" : "#F59E0B",
          fontWeight: 600,
        }}
      >
        {isMigrated ? "✅ Migration Complete" : "⚠ Ready to Migrate"}
      </div>

      {result && (
        <div style={{ padding: "8px 12px", background: "#0F0F18", borderRadius: 6, fontSize: 11, color: "#E2E8F0", marginBottom: 12 }}>
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
          background: isMigrated ? "#1E2A06" : loading ? "#1E2A06" : "linear-gradient(135deg, #C8F135, #86EF3C)",
          color: isMigrated || loading ? "#4B5563" : "#0A0A0F",
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
