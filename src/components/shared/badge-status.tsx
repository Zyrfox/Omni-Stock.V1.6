import { StockStatus, STATUS_CONFIG } from "@/lib/stock-status";

interface BadgeStatusProps {
  status: StockStatus;
  size?: "sm" | "md";
  detail?: string;
}

export function BadgeStatus({ status, size = "md", detail }: BadgeStatusProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        borderRadius: 4,
        fontSize: size === "sm" ? 9 : 10,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
      {status}
      {detail && <span style={{ fontWeight: 500, opacity: 0.8 }}>({detail})</span>}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: "blue" | "green" | "amber" | "red" | "accent" | "gray";
  size?: "sm" | "md";
}

const BADGE_COLORS = {
  blue: { color: "var(--color-os-blue)", bg: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-blue) 30%, transparent)" },
  green: { color: "var(--color-os-green)", bg: "color-mix(in srgb, var(--color-os-green) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-green) 30%, transparent)" },
  amber: { color: "var(--color-os-amber)", bg: "color-mix(in srgb, var(--color-os-amber) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-amber) 30%, transparent)" },
  red: { color: "var(--color-os-red)", bg: "color-mix(in srgb, var(--color-os-red) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-red) 30%, transparent)" },
  accent: { color: "var(--color-os-accent)", bg: "color-mix(in srgb, var(--color-os-accent) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-accent) 30%, transparent)" },
  gray: { color: "var(--color-os-sub)", bg: "color-mix(in srgb, var(--color-os-sub) 10%, transparent)", border: "color-mix(in srgb, var(--color-os-sub) 30%, transparent)" },
};

export function Badge({ children, color = "blue", size = "md" }: BadgeProps) {
  const cfg = BADGE_COLORS[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: size === "sm" ? "1px 5px" : "2px 7px",
        borderRadius: 4,
        fontSize: size === "sm" ? 9 : 10,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
