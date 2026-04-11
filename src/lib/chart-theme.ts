/**
 * Shared Recharts theme constants for OMNI-STOCK.
 * Used by Kalkulator HPP and Overview pages.
 */

export const CHART_COLORS = [
  "#C8F135", // accent
  "#60A5FA", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#22C55E", // green
  "#A78BFA", // purple
  "#FB923C", // orange
  "#2DD4BF", // teal
];

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-os-card)",
  border: "1px solid var(--color-os-border2)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-os-text)",
};

export const CHART_LEGEND_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-os-sub)",
};
