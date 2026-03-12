import { StockStatus, STATUS_CONFIG } from "@/lib/stock-status";

interface BadgeStatusProps {
  status: StockStatus;
  size?: "sm" | "md";
}

export function BadgeStatus({ status, size = "md" }: BadgeStatusProps) {
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
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: "blue" | "green" | "amber" | "red" | "accent" | "gray";
  size?: "sm" | "md";
}

const BADGE_COLORS = {
  blue: { color: "#60A5FA", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.3)" },
  green: { color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" },
  amber: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  red: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
  accent: { color: "#C8F135", bg: "rgba(200,241,53,0.1)", border: "rgba(200,241,53,0.3)" },
  gray: { color: "#6B7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" },
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
