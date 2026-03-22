"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";

interface SidebarProps {
  collapsed: boolean;
  userNama: string;
  userEmail: string;
  userRole: string;
}

export function Sidebar({ collapsed, userNama, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = userRole === "admin";
  const initials = userNama
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showUserMenu]);

  async function handleChangePassword() {
    if (!pwForm.current || !pwForm.next) { setPwError("Semua field wajib diisi."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("Password baru tidak cocok."); return; }
    if (pwForm.next.length < 8) { setPwError("Password baru minimal 8 karakter."); return; }
    setPwSaving(true);
    setPwError("");
    try {
      const result = await authClient.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.next });
      if (result.error) { setPwError(result.error.message ?? "Gagal mengubah password."); return; }
      setShowChangePw(false);
      setPwForm({ current: "", next: "", confirm: "" });
    } catch {
      setPwError("Gagal mengubah password.");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <aside
      className="sidebar-root"
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
      <div ref={menuRef} style={{ position: "relative" }}>
        {/* Context menu */}
        {showUserMenu && !collapsed && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 10, right: 10,
            background: "#1A1A2E", border: "1px solid #2D2D44", borderRadius: 10,
            overflow: "hidden", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <button
              onClick={() => { setShowUserMenu(false); setShowChangePw(true); setPwError(""); setPwForm({ current: "", next: "", confirm: "" }); }}
              style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, color: "#E2E8F0", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              🔐 Ganti Password
            </button>
            <div style={{ height: 1, background: "#2D2D44", margin: "0 10px" }} />
            <button
              onClick={handleSignOut}
              style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              🚪 Keluar
            </button>
          </div>
        )}

        {userRole === "guest" ? (
          /* Guest: show login button instead of user menu */
          <div style={{ padding: "12px 14px", borderTop: "1px solid #1E1E2E" }}>
            {collapsed ? (
              <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#C8F135", color: "#0A0A0F", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>→</Link>
            ) : (
              <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: "rgba(200,241,53,0.1)", border: "1px solid rgba(200,241,53,0.3)", color: "#C8F135", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                🔑 Login ke Akun
              </Link>
            )}
          </div>
        ) : (
        <div
          onClick={() => !collapsed && setShowUserMenu((v) => !v)}
          style={{
            padding: "12px 14px",
            borderTop: "1px solid #1E1E2E",
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflow: "hidden",
            cursor: collapsed ? "default" : "pointer",
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #C8F135, #86EF3C)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#0A0A0F", flexShrink: 0,
            }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userNama}
              </div>
              <div style={{ fontSize: 9, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userEmail}
              </div>
            </div>
          )}
          {!collapsed && (
            <span
              style={{
                fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                background: userRole === "admin" ? "rgba(200,241,53,0.15)" : "rgba(96,165,250,0.15)",
                color: userRole === "admin" ? "#C8F135" : "#60A5FA",
                border: userRole === "admin" ? "1px solid rgba(200,241,53,0.3)" : "1px solid rgba(96,165,250,0.3)",
                textTransform: "uppercase", flexShrink: 0,
              }}
            >
              {userRole}
            </span>
          )}
        </div>
        )}
      </div>

      {/* Modal Ganti Password */}
      {showChangePw && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ width: 380, background: "#13131F", borderRadius: 16, border: "1px solid #2D2D44", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)" }} />
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", margin: "0 0 20px" }}>Ganti Password</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  { label: "Password Saat Ini", key: "current" as const },
                  { label: "Password Baru", key: "next" as const },
                  { label: "Konfirmasi Password Baru", key: "confirm" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4B5563", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                    <input
                      type="password"
                      value={pwForm[key]}
                      onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", background: "#0F0F18", border: "1px solid #2D2D44", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E2E8F0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
              </div>
              {pwError && <p style={{ fontSize: 11, color: "#EF4444", margin: "10px 0 0" }}>{pwError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button onClick={() => setShowChangePw(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #2D2D44", borderRadius: 7, color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Batal</button>
                <button onClick={handleChangePassword} disabled={pwSaving} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #C8F135, #86EF3C)", border: "none", borderRadius: 8, color: "#0D1117", fontSize: 12, fontWeight: 700, cursor: pwSaving ? "not-allowed" : "pointer", opacity: pwSaving ? 0.7 : 1 }}>
                  {pwSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
