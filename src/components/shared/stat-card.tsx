interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, color = "#E2E8F0", sub }: StatCardProps) {
  return (
    <div
      style={{
        background: "#13131F",
        border: "1px solid #1E1E2E",
        borderRadius: 12,
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {icon && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontSize: 22,
            opacity: 0.15,
            userSelect: "none",
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#4B5563",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
