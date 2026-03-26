"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { changePassword } from "@/actions/change-password";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Password tidak cocok.");
      return;
    }
    if (!session?.user?.id) {
      setError("Sesi tidak ditemukan. Silakan login ulang.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(session.user.id, newPassword);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `var(--color-os-bg)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', Arial, sans-serif",
      }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,241,53,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          right: -80,
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          width: 420,
          background: `var(--color-os-card)`,
          borderRadius: 18,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #C8F135, #86EF3C, transparent)",
          }}
        />

        <div style={{ padding: "36px 40px 40px" }}>
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <svg width="52" height="28" viewBox="0 0 52 28" fill="none">
              <circle cx="10" cy="14" r="8" stroke="#C8F135" strokeWidth="2.5" />
              <circle cx="26" cy="14" r="8" stroke="#C8F135" strokeWidth="2.5" />
              <circle cx="42" cy="14" r="8" stroke="#C8F135" strokeWidth="2.5" />
            </svg>
          </div>

          <h1
            style={{
              textAlign: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "#E2E8F0",
              margin: 0,
              marginBottom: 6,
            }}
          >
            Ganti Password
          </h1>
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#6B7280",
              margin: 0,
              marginBottom: 28,
            }}
          >
            Buat password baru sebelum melanjutkan
          </p>

          <form onSubmit={handleSubmit}>
            {/* New Password */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4B5563",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Password Baru
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimal 8 karakter"
                  style={{
                    width: "100%",
                    background: `var(--color-os-surface)`,
                    border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "#2D2D44"}`,
                    borderRadius: 8,
                    padding: "10px 40px 10px 14px",
                    fontSize: 13,
                    color: "#E2E8F0",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { if (!error) e.target.style.borderColor = "#C8F135"; }}
                  onBlur={(e) => { if (!error) e.target.style.borderColor = "#2D2D44"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#4B5563",
                  }}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4B5563",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Ulangi password baru"
                style={{
                  width: "100%",
                  background: `var(--color-os-surface)`,
                  border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "#2D2D44"}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#E2E8F0",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { if (!error) e.target.style.borderColor = "#C8F135"; }}
                onBlur={(e) => { if (!error) e.target.style.borderColor = "#2D2D44"; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#EF4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "none",
                background: loading ? "#1E2A06" : "linear-gradient(135deg, #C8F135, #86EF3C)",
                color: loading ? "#4B5563" : `var(--color-os-bg)`,
                fontSize: 13,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid #4B5563",
                      borderTopColor: "#C8F135",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Menyimpan...
                </>
              ) : (
                "→ Simpan Password Baru"
              )}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "#4B5563",
              marginTop: 28,
              marginBottom: 0,
            }}
          >
            Easy Going Group © 2026 · OMNI-STOCK
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
