
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import Link from "next/link";

type TabRole = "STAFF" | "SPV" | "MANAGER";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabRole>("MANAGER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Email atau password salah.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: TabRole[] = ["STAFF", "SPV", "MANAGER"];

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

          {/* Title */}
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
            Selamat Datang
          </h1>
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#6B7280",
              margin: 0,
              marginBottom: 24,
            }}
          >
            Masuk ke OMNI-STOCK Dashboard
          </p>

          {/* Tab Role */}
          <div
            style={{
              display: "flex",
              marginBottom: 24,
              borderBottom: "1px solid var(--color-os-border)",
            }}
          >
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  borderBottom: tab === t ? "2px solid #C8F135" : "2px solid transparent",
                  color: tab === t ? "#C8F135" : "#4B5563",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "8px 0",
                  cursor: "pointer",
                  marginBottom: -1,
                  letterSpacing: 0.5,
                  transition: "color 0.15s",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
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
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@easygoing.id"
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
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = "#C8F135";
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.borderColor = "#2D2D44";
                }}
              />
            </div>

            {/* Password */}
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
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
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
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => {
                    if (!error) e.target.style.borderColor = "#C8F135";
                  }}
                  onBlur={(e) => {
                    if (!error) e.target.style.borderColor = "#2D2D44";
                  }}
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
                transition: "opacity 0.15s",
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
                  Memverifikasi...
                </>
              ) : (
                "→ Masuk ke Dashboard"
              )}
            </button>
          </form>

          {/* Guest access */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link
              href="/dashboard"
              style={{ fontSize: 11, color: "#4B5563", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C8F135")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4B5563")}
            >
              👁 Lihat sebagai Tamu →
            </Link>
          </div>

          {/* Footer */}
          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "#4B5563",
              marginTop: 16,
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
