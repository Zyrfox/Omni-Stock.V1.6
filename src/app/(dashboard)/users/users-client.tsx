"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatDate } from "@/lib/formatters";
import { createUser, deleteUser } from "@/actions/users";
import { generatePassword } from "@/lib/id-generator";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface UserItem {
  id: string; nama: string; email: string; role: "admin" | "manager";
  outletId: string | null; createdAt: Date | null; mustChangePassword: boolean | null;
  outlet: { namaOutlet: string } | null;
}

export function UsersClient({ userList }: { userList: UserItem[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [showAddUser, setShowAddUser] = useState(false);
  const [credentials, setCredentials] = useState<{ nama: string; email: string; password: string; role: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState(generatePassword());
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ nama: "", email: "", role: "manager" as "admin" | "manager", outletId: "" });

  async function handleCreateUser() {
    setSaving(true);
    try {
      const result = await createUser({ ...form, outletId: form.outletId || undefined });
      setCredentials({ nama: form.nama, email: form.email, password: generatedPwd, role: form.role });
      setShowAddUser(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Gagal membuat user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function copyAll() {
    if (!credentials) return;
    const text = `[OMNI-STOCK Login]
Nama: ${credentials.nama}
Email: ${credentials.email}
Password: ${credentials.password}
Role: ${credentials.role.toUpperCase()}

Login: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`;
    copyText(text, "all");
  }

  const currentUserId = session?.user?.id;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => { setGeneratedPwd(generatePassword()); setShowAddUser(true); }} className="btn-accent"
          style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
          👤+ Tambah Pengguna
        </button>
      </div>

      <div style={{ background: "#13131F", border: "1px solid #1E1E2E", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#14142A" }}>
              {["Username / Email", "Role", "Outlet", "Terdaftar Sejak", "Status", "Aksi"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #1E1E2E" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {userList.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#4B5563", fontSize: 12 }}>Belum ada pengguna.</td></tr>
            ) : (
              userList.map((u) => {
                const isSelf = u.id === currentUserId;
                const initials = u.nama.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <tr key={u.id} className="table-row-hover" style={{ borderBottom: "1px solid #131320" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #C8F135, #86EF3C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0A0A0F", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{u.nama}</span>
                            {isSelf && <Badge color="accent" size="sm">ANDA</Badge>}
                          </div>
                          <div style={{ fontSize: 11, color: "#4B5563" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.role === "admin" ? "#C8F135" : "#60A5FA", display: "inline-block" }} />
                        <span style={{ fontSize: 11, color: u.role === "admin" ? "#C8F135" : "#60A5FA", fontWeight: 600, textTransform: "uppercase" }}>{u.role}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{u.outlet?.namaOutlet ?? "Semua"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280" }}>{formatDate(u.createdAt)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: "#22C55E", fontWeight: 600 }}>● Aktif</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {!isSelf && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => setDeleteTarget(u)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer" }}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah User */}
      {showAddUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 480, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Tambah Pengguna</h2>
              {[
                { label: "Nama Lengkap *", key: "nama", placeholder: "John Doe" },
                { label: "Email Google *", key: "email", placeholder: "john@easygoing.id", type: "email" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                  <input type={type ?? "text"} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0" }}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>Password (Auto-generated)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={generatedPwd}
                    style={{ flex: 1, background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#F59E0B", outline: "none" }} />
                  <button onClick={() => setGeneratedPwd(generatePassword())}
                    style={{ padding: "8px 12px", background: "#1E1E2E", border: "1px solid #2D2D44", borderRadius: 7, color: "#E2E8F0", cursor: "pointer", fontSize: 12 }}>↻</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddUser(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleCreateUser} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                  {saving ? "Membuat..." : "✓ Buat Akun & Tampilkan Kredensial"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credential Card */}
      {credentials && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110 }}>
          <div className="modal-fadein" style={{ width: 480, background: "#13131F", borderRadius: 16, border: "1px solid rgba(200,241,53,0.3)", boxShadow: "0 0 40px rgba(200,241,53,0.1)", overflow: "hidden" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11, color: "#F59E0B" }}>
                ⚠ Tampil sekali saja — salin dan kirim ke user secara private
              </div>
              {[
                { label: "Email", value: credentials.email, key: "email" },
                { label: "Password", value: credentials.password, key: "password", sensitive: true },
              ].map(({ label, value, key, sensitive }) => (
                <div key={key} style={{ marginBottom: 14, background: "#0F0F18", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 4 }}>{label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: sensitive ? "#F59E0B" : "#C8F135" }}>{value}</span>
                    <button onClick={() => copyText(value, key)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #2D2D44", background: "#1E1E2E", color: copied === key ? "#22C55E" : "#6B7280", cursor: "pointer" }}>
                      {copied === key ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={copyAll} style={{ width: "100%", padding: "10px", borderRadius: 7, border: "1px solid #2D2D44", background: "#1E1E2E", color: copied === "all" ? "#22C55E" : "#E2E8F0", cursor: "pointer", fontSize: 12, marginBottom: 12 }}>
                {copied === "all" ? "✓ Disalin!" : "📋 Copy Semua Kredensial (Siap Kirim)"}
              </button>
              <p style={{ fontSize: 10, color: "#4B5563", textAlign: "center", margin: "0 0 16px" }}>User wajib ganti password setelah login pertama kali.</p>
              <button onClick={() => setCredentials(null)} className="btn-accent" style={{ width: "100%", padding: "11px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                ✓ Selesai, Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 380, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>Hapus Pengguna?</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
                Akun <span style={{ color: "#EF4444", fontWeight: 600 }}>{deleteTarget.email}</span> akan dihapus permanen.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: "8px 24px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={handleDelete} disabled={saving} style={{ padding: "8px 24px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#EF4444", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                {saving ? "..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
