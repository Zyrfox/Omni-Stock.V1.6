export function PageSkeleton({ rows = 6, cards = 0 }: { rows?: number; cards?: number }) {
  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 16, fontFamily: "'DM Sans', Arial, sans-serif" }}>
      {/* Title */}
      <div className="skeleton" style={{ width: 220, height: 28 }} />
      <div className="skeleton" style={{ width: 320, height: 14, opacity: 0.6 }} />

      {/* Optional stat cards */}
      {cards > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards}, 1fr)`, gap: 12, marginTop: 8 }}>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* Table skeleton */}
      <div style={{ background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
        {/* header row */}
        <div style={{ background: "var(--color-os-row-hover)", padding: "10px 16px", display: "flex", gap: 16 }}>
          {[80, 200, 100, 100, 80].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 12 }} />
          ))}
        </div>
        {/* data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-os-border)", display: "flex", gap: 16, alignItems: "center", opacity: 1 - i * (0.12 / rows) }}>
            {[80, 200, 100, 100, 80].map((w, j) => (
              <div key={j} className="skeleton" style={{ width: w, height: 12 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
