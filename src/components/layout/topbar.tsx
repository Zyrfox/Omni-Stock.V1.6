"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

interface TopbarProps {
  onToggleSidebar: () => void;
  userNama: string;
}

export function Topbar({ onToggleSidebar, userNama }: TopbarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header
      style={{
        height: 52,
        backgroundColor: "#0F0F18",
        borderBottom: "1px solid #1E1E2E",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        style={{
          background: "none",
          border: "none",
          color: "#6B7280",
          fontSize: 18,
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 6,
          lineHeight: 1,
        }}
        title="Toggle Sidebar"
      >
        ☰
      </button>

      {/* AI Search */}
      <div
        style={{
          flex: 1,
          maxWidth: 400,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#14142A",
          border: "1px solid #2D2D44",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        <span style={{ color: "#C8F135", fontSize: 13 }}>✦</span>
        <span style={{ fontSize: 12, color: "#4B5563", flex: 1 }}>Ask AI anything...</span>
        <kbd
          style={{
            fontSize: 10,
            color: "#4B5563",
            background: "#1E1E2E",
            border: "1px solid #2D2D44",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          ⌘K
        </kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Notification Bell */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowNotif(!showNotif)}
          style={{
            background: "none",
            border: "none",
            color: "#6B7280",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 6px",
            position: "relative",
          }}
        >
          🔔
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#EF4444",
              display: "block",
            }}
          />
        </button>

        {showNotif && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 260,
              background: "#13131F",
              border: "1px solid #2D2D44",
              borderRadius: 10,
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              zIndex: 50,
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #1E1E2E",
                fontSize: 12,
                fontWeight: 700,
                color: "#E2E8F0",
              }}
            >
              Notifikasi
            </div>
            <div
              style={{
                padding: "24px 14px",
                textAlign: "center",
                fontSize: 11,
                color: "#4B5563",
              }}
            >
              Tidak ada notifikasi baru
            </div>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        style={{
          fontSize: 11,
          color: "#6B7280",
          background: "none",
          border: "1px solid #2D2D44",
          borderRadius: 6,
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Keluar
      </button>
    </header>
  );
}
