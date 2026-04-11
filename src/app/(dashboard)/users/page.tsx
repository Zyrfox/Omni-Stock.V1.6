export const dynamic = "force-dynamic";

import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { getUserStats } from "@/actions/users";
import { StatCard } from "@/components/shared/stat-card";
import { Users, Shield, User, UserCheck, UserCog } from "lucide-react";
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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-os-text)", margin: 0 }}>Users</h1>
        <p style={{ fontSize: 12, color: "var(--color-os-sub)", margin: "4px 0 0" }}>Manajemen pengguna — Admin Only</p>
      </div>

      {/* Admin-only banner */}
      <div style={{ background: "color-mix(in srgb, var(--color-os-accent) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-accent) 15%, transparent)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12 }}>🔒</span>
        <span style={{ fontSize: 12, color: "var(--color-os-accent)" }}>Halaman ini hanya dapat diakses oleh Admin. Data pengguna bersifat sensitif.</span>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Pengguna" value={stats.total} icon={Users} color="var(--color-os-blue)" />
        <StatCard label="Admin" value={stats.admin} icon={Shield} color="var(--color-os-accent)" />
        <StatCard label="Manager" value={stats.manager} icon={User} color="var(--color-os-green)" />
        <StatCard label="Supervisor" value={stats.supervisor} icon={UserCheck} color="var(--color-os-amber)" />
        <StatCard label="Staff" value={stats.staff} icon={UserCog} color="#A78BFA" />
      </div>

      <UsersClient userList={userList as any} outletList={outletList} />
    </div>
  );
}
