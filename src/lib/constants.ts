/**
 * OMNI-STOCK — Global Constants
 * Navigation items, color tokens, etc.
 */

import {
  LayoutDashboard,
  Store,
  Package,
  Layers,
  Truck,
  CreditCard,
  Upload,
  ClipboardList,
  PackageCheck,
  BarChart2,
  Users,
  Settings2,
  Calculator,
  PieChart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles?: string[]; // if undefined/empty = visible to all; if set = only these roles
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const NAV_ITEMS: NavSection[] = [
  {
    section: "DISCOVER",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Stores", icon: Store, href: "/stores" },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      { label: "Kalkulator HPP", icon: Calculator, href: "/calculator", roles: ["admin", "manager"] },
      { label: "Overview", icon: PieChart, href: "/overview", roles: ["admin", "manager"] },
    ],
  },
  {
    section: "INVENTORY",
    items: [
      { label: "Products & Recipes", icon: Package, href: "/products" },
      { label: "Assets & Inv.", icon: Layers, href: "/category" },
      { label: "Suppliers", icon: Truck, href: "/suppliers" },
      { label: "Billing", icon: CreditCard, href: "/billing" },
      { label: "Upload History", icon: Upload, href: "/upload-history" },
      { label: "PO Logs", icon: ClipboardList, href: "/po-logs" },
      { label: "Delivery", icon: PackageCheck, href: "/delivery" },
      { label: "Report", icon: BarChart2, href: "/report" },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { label: "Users", icon: Users, href: "/users", roles: ["admin"] },
      { label: "Settings", icon: Settings2, href: "/settings", roles: ["admin"] },
    ],
  },
];

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
