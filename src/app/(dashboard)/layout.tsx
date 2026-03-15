"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomBar } from "@/components/layout/bottom-bar";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0A0F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#C8F135", fontSize: 24 }}>⊚</div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as {
    nama?: string;
    email: string;
    role?: string;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0A0F" }}>
      <Sidebar
        collapsed={collapsed}
        userNama={user.nama ?? user.email}
        userEmail={user.email}
        userRole={user.role ?? "manager"}
      />
      <div className="dashboard-content" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          userNama={user.nama ?? user.email}
        />
        <main className="dashboard-main" style={{ flex: 1, padding: "24px", overflowY: "auto" }}>{children}</main>
      </div>
      <BottomBar userRole={user.role ?? "manager"} />
    </div>
  );
}
