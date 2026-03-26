import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
  sub?: string;
}

export function StatCard({ label, value, icon: Icon, color = "#E2E8F0", sub }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--color-os-card)",
        border: "1px solid var(--color-os-border)",
        borderRadius: 12,
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {Icon && (
        <div
          className="stat-card-icon"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            opacity: 0.15,
            userSelect: "none",
            color,
          }}
        >
          <Icon size={22} />
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-os-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="stat-card-val"
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
        <div style={{ fontSize: 11, color: "var(--color-os-muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
