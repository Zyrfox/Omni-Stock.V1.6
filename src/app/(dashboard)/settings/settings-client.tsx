"use client";

import { useState } from "react";
import { runMigration } from "@/actions/migration";
import { setSystemConfig } from "@/actions/config";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";
import { useRouter } from "next/navigation";

interface Outlet {
  id: string;
  namaOutlet: string;
}

export function SettingsClient({
  isMigrated,
  outletList,
  waTemplates,
}: {
  isMigrated: boolean;
  outletList: Outlet[];
  waTemplates: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  // WA Template state
  const [selectedOutletId, setSelectedOutletId] = useState(outletList[0]?.id ?? "");
  const [waText, setWaText] = useState(waTemplates[outletList[0]?.id ?? ""] ?? DEFAULT_WA_TEMPLATE);
  const [waSaving, setWaSaving] = useState(false);
  const [waSaved, setWaSaved] = useState(false);

  function handleOutletChange(outletId: string) {
    setSelectedOutletId(outletId);
    setWaText(waTemplates[outletId] ?? DEFAULT_WA_TEMPLATE);
    setWaSaved(false);
  }

  async function handleSaveWaTemplate() {
    if (!selectedOutletId) return;
    setWaSaving(true);
    try {
      await setSystemConfig(`wa_template:${selectedOutletId}`, waText);
      waTemplates[selectedOutletId] = waText;
      setWaSaved(true);
      router.refresh();
    } catch {
      alert("Gagal menyimpan template.");
    } finally {
      setWaSaving(false);
    }
  }

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
    <>
      {/* Card 1 — Migration */}
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

      {/* Card 5 — WA Vendor Template */}
      <div style={{ background: `var(--color-os-card)`, border: "1px solid var(--color-os-border)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)", marginBottom: 16 }}>Template Chat Vendor WA</div>
        <p style={{ fontSize: 11, color: "var(--color-os-sub)", marginBottom: 12, lineHeight: 1.6 }}>
          Template pesan otomatis saat klik nomor WA vendor. Gunakan <code style={{ background: "var(--color-os-surface)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>{"{outlet}"}</code> untuk nama outlet.
        </p>

        {outletList.length > 1 && (
          <select
            value={selectedOutletId}
            onChange={(e) => handleOutletChange(e.target.value)}
            style={{
              width: "100%",
              background: "var(--color-os-surface)",
              border: "1px solid var(--color-os-border2)",
              borderRadius: 7,
              padding: "7px 10px",
              fontSize: 12,
              color: "var(--color-os-text)",
              outline: "none",
              marginBottom: 10,
            }}
          >
            {outletList.map((o) => (
              <option key={o.id} value={o.id}>{o.namaOutlet}</option>
            ))}
          </select>
        )}

        <textarea
          value={waText}
          onChange={(e) => { setWaText(e.target.value); setWaSaved(false); }}
          rows={4}
          style={{
            width: "100%",
            background: "var(--color-os-surface)",
            border: "1px solid var(--color-os-border2)",
            borderRadius: 7,
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--color-os-text)",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.6,
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            onClick={handleSaveWaTemplate}
            disabled={waSaving}
            style={{
              padding: "8px 16px",
              borderRadius: 7,
              border: "none",
              background: waSaving ? "color-mix(in srgb, var(--color-os-accent) 12%, transparent)" : "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))",
              color: waSaving ? "var(--color-os-muted)" : "var(--color-os-bg)",
              fontSize: 12,
              fontWeight: 700,
              cursor: waSaving ? "not-allowed" : "pointer",
            }}
          >
            {waSaving ? "Menyimpan..." : "Simpan Template"}
          </button>
          {waSaved && (
            <span style={{ fontSize: 11, color: "var(--color-os-green)", fontWeight: 600 }}>✓ Tersimpan</span>
          )}
        </div>

        <button
          onClick={() => { setWaText(DEFAULT_WA_TEMPLATE); setWaSaved(false); }}
          style={{ marginTop: 8, background: "none", border: "none", fontSize: 10, color: "var(--color-os-muted)", cursor: "pointer", textDecoration: "underline" }}
        >
          Reset ke default
        </button>
      </div>
    </>
  );
}
