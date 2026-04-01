"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";
import { Upload, Menu, LogOut, Palette } from "lucide-react";
import { useTheme, THEMES, type Theme } from "@/components/providers/theme-provider";

const THEME_DOTS: Record<Theme, string> = {
  dark: "var(--color-os-accent)",
  light: "#16A34A",
  tokyo: "#7AA2F7",
  catppuccin: "#CBA6F7",
  solarized: "#B58900",
};

// 3 pinned items — FAB occupies the center slot
const PINNED_HREFS = ["/dashboard", "/products", "/po-logs"];
const ALL_FLAT: NavItem[] = NAV_ITEMS.flatMap((s) => s.items);

interface BottomBarProps {
  userRole: string;
}

export function BottomBar({ userRole }: BottomBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isAdmin = userRole === "admin";

  const pinnedItems = ALL_FLAT.filter((item) => PINNED_HREFS.includes(item.href));

  const moreItems = ALL_FLAT.filter(
    (item) => !PINNED_HREFS.includes(item.href) && (!item.adminOnly || isAdmin)
  );

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  function handleFabClick() {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/dashboard") {
      window.dispatchEvent(new CustomEvent("omni:fab-upload"));
    } else {
      router.push("/dashboard");
    }
  }

  const slotStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    textDecoration: "none",
    color: isActive ? "var(--color-os-accent)" : "var(--color-os-sub)",
    backgroundColor: isActive ? "color-mix(in srgb, var(--color-os-accent) 5%, transparent)" : "transparent",
    borderTop: isActive ? "2px solid var(--color-os-accent)" : "2px solid transparent",
    transition: "color 0.15s",
  });

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className="bottom-bar-mobile"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: "var(--color-os-surface)",
          borderTop: "1px solid var(--color-os-border)",
          alignItems: "stretch",
          zIndex: 60,
        }}
      >
        {/* Slot 1 — Dashboard */}
        {pinnedItems[0] && (() => {
          const item = pinnedItems[0];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} style={slotStyle(isActive)}>
              <item.icon size={18} />
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                {item.label.split(" ")[0]}
              </span>
            </Link>
          );
        })()}

        {/* Slot 2 — Products */}
        {pinnedItems[1] && (() => {
          const item = pinnedItems[1];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} style={slotStyle(isActive)}>
              <item.icon size={18} />
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                {item.label.split(" ")[0]}
              </span>
            </Link>
          );
        })()}

        {/* Slot 3 — FAB Upload */}
        <button
          onClick={handleFabClick}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))",
              border: "3px solid #0F0F18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-os-bg)",
              marginTop: -14,
              boxShadow: "0 4px 14px color-mix(in srgb, var(--color-os-accent) 40%, transparent)",
            }}
          >
            <Upload size={18} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 9, color: "var(--color-os-sub)", marginTop: 3, letterSpacing: 0.3 }}>Upload</span>
        </button>

        {/* Slot 4 — PO Logs */}
        {pinnedItems[2] && (() => {
          const item = pinnedItems[2];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} style={slotStyle(isActive)}>
              <item.icon size={18} />
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                {item.label.split(" ")[0]}
              </span>
            </Link>
          );
        })()}

        {/* Slot 5 — More */}
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: moreOpen ? "var(--color-os-accent)" : "var(--color-os-sub)",
            borderTop: "2px solid transparent",
          }}
        >
          <Menu size={18} />
          <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: 0.3 }}>More</span>
        </button>
      </nav>

      {/* More — bottom sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 70,
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: "fixed",
              bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
              left: 0,
              right: 0,
              background: "var(--color-os-card)",
              borderTop: "1px solid var(--color-os-border2)",
              borderRadius: "16px 16px 0 0",
              zIndex: 71,
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            {/* Drag handle */}
            <div style={{ textAlign: "center", padding: "12px 0 6px" }}>
              <div style={{ width: 36, height: 3, background: "var(--color-os-border2)", borderRadius: 2, display: "inline-block" }} />
            </div>

            <div style={{ padding: "4px 0 8px" }}>
              {moreItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "11px 20px",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--color-os-accent)" : "var(--color-os-text)",
                      backgroundColor: isActive ? "color-mix(in srgb, var(--color-os-accent) 7%, transparent)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--color-os-accent)" : "3px solid transparent",
                    }}
                  >
                    <item.icon size={16} style={{ flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ height: 1, background: "var(--color-os-border)", margin: "0 16px" }} />

            {/* Theme picker */}
            <div style={{ padding: "10px 20px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Palette size={14} style={{ color: "var(--color-os-sub)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Theme</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 7,
                      border: theme === t.id ? "1px solid color-mix(in srgb, var(--color-os-accent) 50%, transparent)" : "1px solid var(--color-os-border2)",
                      background: theme === t.id ? "color-mix(in srgb, var(--color-os-accent) 8%, transparent)" : "var(--color-os-surface)",
                      color: theme === t.id ? "var(--color-os-accent)" : "var(--color-os-sub)",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: theme === t.id ? 700 : 400,
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: THEME_DOTS[t.id], flexShrink: 0 }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: "var(--color-os-border)", margin: "8px 16px" }} />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "none",
                border: "none",
                textAlign: "left",
                fontSize: 13,
                color: "var(--color-os-red)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 4,
              }}
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
