"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

interface SidebarProps {
  collapsed: boolean;
  userNama: string;
  userEmail: string;
  userRole: string;
}

export function Sidebar({ collapsed, userNama, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";
  const initials = userNama
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      style={{
        width: collapsed ? 58 : 220,
        minWidth: collapsed ? 58 : 220,
        backgroundColor: "#0F0F18",
        borderRight: "1px solid #1E1E2E",
        transition: "width 0.2s ease, min-width 0.2s ease",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "18px 14px 14px",
          borderBottom: "1px solid #1E1E2E",
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #C8F135, #86EF3C)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
            color: "#0A0A0F",
            fontWeight: 800,
          }}
        >
          ⊚
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", letterSpacing: 0.5 }}>
              OMNI-STOCK
            </div>
            <div style={{ fontSize: 9, color: "#4B5563" }}>Easy Going Group</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {NAV_ITEMS.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <div
                style={{
                  padding: "10px 14px 4px",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: "#374151",
                  textTransform: "uppercase",
                }}
              >
                {section.section}
              </div>
            )}
            {section.items.map((item) => {
              // Skip admin-only items for managers
              if (item.adminOnly && !isAdmin) return null;

              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: collapsed ? "10px 0" : "8px 14px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    backgroundColor: isActive ? "rgba(200,241,53,0.07)" : "transparent",
                    borderLeft: isActive ? "3px solid #C8F135" : "3px solid transparent",
                    color: isActive ? "#C8F135" : "#6B7280",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: "none",
                    transition: "background 0.15s, color 0.15s",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && (
                    <span style={{ flex: 1, whiteSpace: "nowrap" }}>{item.label}</span>
                  )}
                  {!collapsed && item.adminOnly && (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "1px 4px",
                        borderRadius: 3,
                        background: "rgba(200,241,53,0.15)",
                        color: "#C8F135",
                        border: "1px solid rgba(200,241,53,0.3)",
                      }}
                    >
                      A
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Pill */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid #1E1E2E",
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #C8F135, #86EF3C)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#0A0A0F",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#E2E8F0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userNama}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#4B5563",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userEmail}
            </div>
          </div>
        )}
        {!collapsed && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 3,
              background:
                userRole === "admin"
                  ? "rgba(200,241,53,0.15)"
                  : "rgba(96,165,250,0.15)",
              color: userRole === "admin" ? "#C8F135" : "#60A5FA",
              border:
                userRole === "admin"
                  ? "1px solid rgba(200,241,53,0.3)"
                  : "1px solid rgba(96,165,250,0.3)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {userRole}
          </span>
        )}
      </div>
    </aside>
  );
}
