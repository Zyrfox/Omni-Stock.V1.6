"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/shared/badge-status";
import { formatDate } from "@/lib/formatters";
import { createUser, deleteUser, updateUser } from "@/actions/users";
import { generatePassword } from "@/lib/password-utils";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type UserRole = "admin" | "manager" | "supervisor" | "staff";

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "var(--color-os-accent)",
  manager: "var(--color-os-blue)",
  supervisor: "var(--color-os-amber)",
  staff: "#A78BFA",
};

interface UserItem {
  id: string; nama: string; email: string; role: UserRole;
  outletId: string | null; createdAt: Date | null; mustChangePassword: boolean | null;
  outlet: { namaOutlet: string } | null;
}

interface OutletOption { id: string; namaOutlet: string; }

export function UsersClient({ userList, outletList }: { userList: UserItem[]; outletList: OutletOption[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [credentials, setCredentials] = useState<{ nama: string; email: string; password: string; role: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ nama: "", role: "manager" as UserRole, outletId: "" });
  const [saving, setSaving] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState(generatePassword());
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ nama: "", email: "", role: "manager" as UserRole, outletId: "" });

  async function handleCreateUser() {
    setSaving(true);
    try {
      const result = await createUser({ ...form, password: generatedPwd, outletId: form.outletId || undefined });
      setCredentials({ nama: form.nama, email: form.email, password: result.password, role: form.role });
      setShowAddUser(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Gagal membuat user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditUser() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateUser(editTarget.id, {
        nama: editForm.nama,
        name: editForm.nama,
        role: editForm.role,
        outletId: editForm.outletId || null,
      });
      setEditTarget(null);
      router.refresh();
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

      {isMobile ? (
        /* ── Mobile: card list ── */
        <div className="user-card-list">
          {userList.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada pengguna.</div>
          ) : userList.map((u) => {
            const isSelf = u.id === currentUserId;
            const initials = u.nama.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={u.id} className="user-card">
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--color-os-border)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: `var(--color-os-bg)`, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-os-text)" }}>{u.nama}</span>
                      {isSelf && <Badge color="accent" size="sm">ANDA</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-os-muted)", marginTop: 1 }}>{u.email}</div>
                  </div>
                  {/* Role pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROLE_COLOR[u.role], display: "inline-block" }} />
                    <span style={{ fontSize: 11, color: ROLE_COLOR[u.role], fontWeight: 700, textTransform: "uppercase" }}>{u.role}</span>
                  </div>
                </div>
                {/* Card body */}
                <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: "Outlet", value: u.outlet?.namaOutlet ?? "Semua" },
                    { label: "Terdaftar", value: formatDate(u.createdAt) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "var(--color-os-card)", borderRadius: 5, padding: "3px 8px", fontSize: 10 }}>
                      <span style={{ color: "var(--color-os-muted)" }}>{label}: </span>
                      <span style={{ color: "var(--color-os-text)", fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                  {u.mustChangePassword ? (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-os-amber)", background: "color-mix(in srgb, var(--color-os-amber) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-amber) 30%, transparent)", borderRadius: 5, padding: "3px 8px" }}>Ganti PW</div>
                  ) : (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-os-green)", background: "color-mix(in srgb, var(--color-os-green) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-green) 20%, transparent)", borderRadius: 5, padding: "3px 8px" }}>Aktif</div>
                  )}
                </div>
                {/* Card actions */}
                {!isSelf && (
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--color-os-border)", display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setEditTarget(u); setEditForm({ nama: u.nama, role: u.role, outletId: u.outletId ?? "" }); }}
                      style={{ flex: 1, fontSize: 12, padding: "7px 0", borderRadius: 6, border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", color: "var(--color-os-blue)", cursor: "pointer", fontWeight: 600 }}
                    >Edit</button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      style={{ flex: 1, fontSize: 12, padding: "7px 0", borderRadius: 6, border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-red) 10%, transparent)", color: "var(--color-os-red)", cursor: "pointer", fontWeight: 600 }}
                    >Hapus</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Desktop: table ── */
        <div style={{ background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-os-row-hover)" }}>
                {["Username / Email", "Role", "Outlet", "Terdaftar Sejak", "Status", "Aksi"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--color-os-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userList.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--color-os-muted)", fontSize: 12 }}>Belum ada pengguna.</td></tr>
              ) : (
                userList.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const initials = u.nama.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <tr key={u.id} className="table-row-hover" style={{ borderBottom: "1px solid var(--color-os-border)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-os-accent), var(--color-os-accentD))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: `var(--color-os-bg)`, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-os-text)" }}>{u.nama}</span>
                              {isSelf && <Badge color="accent" size="sm">ANDA</Badge>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--color-os-muted)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROLE_COLOR[u.role], display: "inline-block" }} />
                          <span style={{ fontSize: 11, color: ROLE_COLOR[u.role], fontWeight: 600, textTransform: "uppercase" }}>{u.role}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-os-sub)" }}>{u.outlet?.namaOutlet ?? "Semua"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--color-os-sub)" }}>{formatDate(u.createdAt)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {u.mustChangePassword ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-os-amber)", background: "color-mix(in srgb, var(--color-os-amber) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-amber) 30%, transparent)", borderRadius: 4, padding: "2px 7px" }}>🔑 Ganti PW</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--color-os-green)", fontWeight: 600 }}>● Aktif</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {!isSelf && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => { setEditTarget(u); setEditForm({ nama: u.nama, role: u.role, outletId: u.outletId ?? "" }); }}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-blue) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-blue) 10%, transparent)", color: "var(--color-os-blue)", cursor: "pointer" }}
                            >Edit</button>
                            <button onClick={() => setDeleteTarget(u)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", background: "color-mix(in srgb, var(--color-os-red) 10%, transparent)", color: "var(--color-os-red)", cursor: "pointer" }}>🗑</button>
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
      )}

      {/* Modal Tambah User */}
      {showAddUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 480, background: "var(--color-os-card)", borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD), transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 20px" }}>Tambah Pengguna</h2>
              {[
                { label: "Nama Lengkap *", key: "nama", placeholder: "John Doe" },
                { label: "Email Google *", key: "email", placeholder: "john@easygoing.id", type: "email" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                  <input type={type ?? "text"} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ width: "100%", background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  style={{ width: "100%", background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)" }}>
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Password (Auto-generated)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={generatedPwd}
                    style={{ flex: 1, background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-amber)", outline: "none" }} />
                  <button onClick={() => setGeneratedPwd(generatePassword())}
                    style={{ padding: "8px 12px", background: "var(--color-os-border)", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-text)", cursor: "pointer", fontSize: 12 }}>↻</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddUser(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-sub)", fontSize: 12, cursor: "pointer" }}>Batal</button>
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
          <div className="modal-fadein" style={{ width: 480, background: "var(--color-os-card)", borderRadius: 16, border: "1px solid color-mix(in srgb, var(--color-os-accent) 30%, transparent)", boxShadow: "0 0 40px color-mix(in srgb, var(--color-os-accent) 10%, transparent)", overflow: "hidden" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD), transparent)" }} />
            <div style={{ padding: 24 }}>
              <div style={{ background: "color-mix(in srgb, var(--color-os-amber) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-amber) 30%, transparent)", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11, color: "var(--color-os-amber)" }}>
                ⚠ Tampil sekali saja — salin dan kirim ke user secara private
              </div>
              {[
                { label: "Email", value: credentials.email, key: "email" },
                { label: "Password", value: credentials.password, key: "password", sensitive: true },
              ].map(({ label, value, key, sensitive }) => (
                <div key={key} style={{ marginBottom: 14, background: "var(--color-os-surface)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--color-os-muted)", marginBottom: 4 }}>{label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: sensitive ? "var(--color-os-amber)" : "var(--color-os-accent)" }}>{value}</span>
                    <button onClick={() => copyText(value, key)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--color-os-border2)", background: "var(--color-os-border)", color: copied === key ? "var(--color-os-green)" : "var(--color-os-sub)", cursor: "pointer" }}>
                      {copied === key ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={copyAll} style={{ width: "100%", padding: "10px", borderRadius: 7, border: "1px solid var(--color-os-border2)", background: "var(--color-os-border)", color: copied === "all" ? "var(--color-os-green)" : "var(--color-os-text)", cursor: "pointer", fontSize: 12, marginBottom: 12 }}>
                {copied === "all" ? "✓ Disalin!" : "📋 Copy Semua Kredensial (Siap Kirim)"}
              </button>
              <p style={{ fontSize: 10, color: "var(--color-os-muted)", textAlign: "center", margin: "0 0 16px" }}>User wajib ganti password setelah login pertama kali.</p>
              <button onClick={() => setCredentials(null)} className="btn-accent" style={{ width: "100%", padding: "11px", border: "none", cursor: "pointer", fontSize: 12, borderRadius: 8 }}>
                ✓ Selesai, Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 420, background: "var(--color-os-card)", borderRadius: 16, border: "1px solid var(--color-os-border2)", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, var(--color-os-accent), var(--color-os-accentD), transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-os-text)", margin: "0 0 4px" }}>Edit Pengguna</h2>
              <div style={{ fontSize: 11, color: "var(--color-os-muted)", marginBottom: 20 }}>{editTarget.email}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Nama Lengkap *</label>
                <input
                  value={editForm.nama}
                  onChange={(e) => setEditForm((f) => ({ ...f, nama: e.target.value }))}
                  style={{ width: "100%", background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  style={{ width: "100%", background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)" }}>
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--color-os-muted)", marginBottom: 4, textTransform: "uppercase" }}>Outlet</label>
                <select value={editForm.outletId} onChange={(e) => setEditForm((f) => ({ ...f, outletId: e.target.value }))}
                  style={{ width: "100%", background: "var(--color-os-surface)", border: "1px solid var(--color-os-border2)", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--color-os-text)" }}>
                  <option value="">— Semua Outlet —</option>
                  {outletList.map((o) => (
                    <option key={o.id} value={o.id}>{o.namaOutlet} ({o.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setEditTarget(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-sub)", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleEditUser} disabled={saving} className="btn-accent" style={{ padding: "8px 16px", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 12, borderRadius: 8, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Menyimpan..." : "✓ Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-fadein" style={{ width: 380, background: "var(--color-os-card)", borderRadius: 16, border: "1px solid var(--color-os-border2)", padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-os-text)" }}>Hapus Pengguna?</div>
              <div style={{ fontSize: 12, color: "var(--color-os-sub)", marginTop: 8 }}>
                Akun <span style={{ color: "var(--color-os-red)", fontWeight: 600 }}>{deleteTarget.email}</span> akan dihapus permanen.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: "8px 24px", background: "transparent", border: "1px solid var(--color-os-border2)", borderRadius: 7, color: "var(--color-os-sub)", fontSize: 12, cursor: "pointer" }}>Batal</button>
              <button onClick={handleDelete} disabled={saving} style={{ padding: "8px 24px", background: "color-mix(in srgb, var(--color-os-red) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)", borderRadius: 7, color: "var(--color-os-red)", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                {saving ? "..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
