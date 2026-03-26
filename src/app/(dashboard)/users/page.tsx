export const revalidate = 60;

import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { getUserStats } from "@/actions/users";
import { StatCard } from "@/components/shared/stat-card";
import { Users, Shield, User } from "lucide-react";
import { Badge } from "@/components/shared/badge-status";
import { formatDate } from "@/lib/formatters";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const [userList, stats, outletList] = await Promise.all([
    db.query.users.findMany({
      with: { outlet: true },
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    }),
    getUserStats(),
    db.query.outlets.findMany({ orderBy: (o, { asc }) => [asc(o.namaOutlet)] }),
  ]);

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>Users</h1>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>Manajemen pengguna — Admin Only</p>
      </div>

      {/* Admin-only banner */}
      <div style={{ background: "rgba(200,241,53,0.04)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12 }}>🔒</span>
        <span style={{ fontSize: 12, color: "#C8F135" }}>Halaman ini hanya dapat diakses oleh Admin. Data pengguna bersifat sensitif.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Pengguna" value={stats.total} icon={Users} color="#60A5FA" />
        <StatCard label="Admin" value={stats.admin} icon={Shield} color="#C8F135" />
        <StatCard label="Manager" value={stats.manager} icon={User} color="#22C55E" />
      </div>

      <UsersClient userList={userList as any} outletList={outletList} />
    </div>
  );
}
