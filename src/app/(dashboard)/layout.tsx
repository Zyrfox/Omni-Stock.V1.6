"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomBar } from "@/components/layout/bottom-bar";
import { useSession } from "@/lib/auth-client";
import { AppProvider } from "@/contexts/app-context";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#C8F135", fontSize: 24 }}>⊚</div>
      </div>
    );
  }

  const isGuest = !session;
  const user = session?.user as { nama?: string; email: string; role?: string } | undefined;
  const userRole = isGuest ? "guest" : (user?.role ?? "manager");

  return (
    <AppProvider isGuest={isGuest} userRole={userRole}>
      <div style={{ display: "flex", minHeight: "100vh", background: "#0A0A0F" }}>
        <Sidebar
          collapsed={collapsed}
          userNama={isGuest ? "Tamu" : (user?.nama ?? user?.email ?? "")}
          userEmail={isGuest ? "" : (user?.email ?? "")}
          userRole={userRole}
        />
        <div className="dashboard-content" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Topbar
            onToggleSidebar={() => setCollapsed((c) => !c)}
            userNama={isGuest ? "Tamu" : (user?.nama ?? user?.email ?? "")}
          />
          {/* Guest banner */}
          {isGuest && (
            <div className="guest-banner" style={{ background: "rgba(200,241,53,0.08)", borderBottom: "1px solid rgba(200,241,53,0.2)", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#C8F135", fontWeight: 600 }}>
                👁 Mode Tamu — hanya bisa melihat, tidak bisa melakukan aksi
              </span>
              <Link href="/login" style={{ fontSize: 11, color: "#0A0A0F", background: "#C8F135", padding: "4px 12px", borderRadius: 6, fontWeight: 700, textDecoration: "none" }}>
                Login →
              </Link>
            </div>
          )}
          <main className="dashboard-main" style={{ flex: 1, padding: "24px", overflowY: "auto" }}>{children}</main>
        </div>
        <BottomBar userRole={userRole} />
      </div>
    </AppProvider>
  );
}
