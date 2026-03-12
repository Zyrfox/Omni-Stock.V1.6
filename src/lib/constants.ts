/**
 * OMNI-STOCK — Global Constants
 * Navigation items, color tokens, etc.
 */

export const NAV_ITEMS = [
  {
    section: "DISCOVER",
    items: [
      { label: "Dashboard", icon: "⊞", href: "/dashboard", adminOnly: false },
      { label: "Stores", icon: "🏪", href: "/stores", adminOnly: false },
    ],
  },
  {
    section: "INVENTORY",
    items: [
      { label: "Products & Recipes", icon: "📦", href: "/products", adminOnly: false },
      { label: "Assets & Inv.", icon: "🗂", href: "/category", adminOnly: false },
      { label: "Suppliers", icon: "🚚", href: "/suppliers", adminOnly: false },
      { label: "Billing", icon: "💳", href: "/billing", adminOnly: false },
      { label: "Upload History", icon: "⬆", href: "/upload-history", adminOnly: false },
      { label: "PO Logs", icon: "📋", href: "/po-logs", adminOnly: false },
      { label: "Delivery", icon: "🚛", href: "/delivery", adminOnly: false },
      { label: "Report", icon: "📊", href: "/report", adminOnly: false },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { label: "Users", icon: "👥", href: "/users", adminOnly: true },
      { label: "Settings", icon: "⚙", href: "/settings", adminOnly: true },
    ],
  },
] as const;

export const COLORS = {
  bg: "#0A0A0F",
  surface: "#0F0F18",
  card: "#13131F",
  border: "#1E1E2E",
  border2: "#2D2D44",
  muted: "#4B5563",
  sub: "#6B7280",
  text: "#E2E8F0",
  accent: "#C8F135",
  accentD: "#86EF3C",
  red: "#EF4444",
  amber: "#F59E0B",
  green: "#22C55E",
  blue: "#60A5FA",
  rowHover: "#14142A",
} as const;

export const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export const SIDEBAR_WIDTH_EXPANDED = 220;
export const SIDEBAR_WIDTH_COLLAPSED = 58;
export const TOPBAR_HEIGHT = 52;
