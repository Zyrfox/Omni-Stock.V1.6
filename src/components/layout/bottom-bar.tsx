"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";

// 3 pinned items — FAB occupies the center slot
const PINNED_HREFS = ["/dashboard", "/products", "/po-logs"];
const ALL_FLAT = NAV_ITEMS.flatMap((s) => s.items as unknown as Array<{ label: string; icon: string; href: string; adminOnly: boolean }>);

interface BottomBarProps {
  userRole: string;
}

export function BottomBar({ userRole }: BottomBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
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
    color: isActive ? "#C8F135" : "#6B7280",
    backgroundColor: isActive ? "rgba(200,241,53,0.05)" : "transparent",
    borderTop: isActive ? "2px solid #C8F135" : "2px solid transparent",
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
          background: "#0F0F18",
          borderTop: "1px solid #1E1E2E",
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
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
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
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
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
              background: "linear-gradient(135deg, #C8F135, #86EF3C)",
              border: "3px solid #0F0F18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              color: "#0A0A0F",
              fontWeight: 800,
              marginTop: -14,
              boxShadow: "0 4px 14px rgba(200,241,53,0.4)",
            }}
          >
            ⬆
          </div>
          <span style={{ fontSize: 9, color: "#6B7280", marginTop: 3, letterSpacing: 0.3 }}>Upload</span>
        </button>

        {/* Slot 4 — PO Logs */}
        {pinnedItems[2] && (() => {
          const item = pinnedItems[2];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} style={slotStyle(isActive)}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
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
            color: moreOpen ? "#C8F135" : "#6B7280",
            borderTop: "2px solid transparent",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
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
              background: "#13131F",
              borderTop: "1px solid #2D2D44",
              borderRadius: "16px 16px 0 0",
              zIndex: 71,
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            {/* Drag handle */}
            <div style={{ textAlign: "center", padding: "12px 0 6px" }}>
              <div style={{ width: 36, height: 3, background: "#2D2D44", borderRadius: 2, display: "inline-block" }} />
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
                      color: isActive ? "#C8F135" : "#E2E8F0",
                      backgroundColor: isActive ? "rgba(200,241,53,0.07)" : "transparent",
                      borderLeft: isActive ? "3px solid #C8F135" : "3px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ height: 1, background: "#1E1E2E", margin: "0 16px" }} />

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
                color: "#EF4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 16 }}>🚪</span>
              <span>Keluar</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
