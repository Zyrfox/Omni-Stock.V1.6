"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { getCriticalBahan, globalSearch, type SearchResult, type CriticalAlert } from "@/actions/search";
import { Bell, Menu, Package, UtensilsCrossed, Store } from "lucide-react";

interface TopbarProps {
  onToggleSidebar: () => void;
  userNama: string;
}

export function Topbar({ onToggleSidebar, userNama }: TopbarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const [criticalItems, setCriticalItems] = useState<CriticalAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch critical count on mount
  useEffect(() => {
    getCriticalBahan().then(({ criticalCount: c, items }) => {
      setCriticalCount(c);
      setCriticalItems(items);
    }).catch(() => {});
  }, []);

  // Click outside handlers
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await globalSearch(q);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    setShowSearch(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  const typeIconMap: Record<string, React.ReactNode> = {
    bahan: <Package size={14} style={{ color: "var(--color-os-accent)" }} />,
    menu: <UtensilsCrossed size={14} style={{ color: "var(--color-os-blue)" }} />,
    vendor: <Store size={14} style={{ color: "var(--color-os-amber)" }} />,
  };
  const typeLabel: Record<string, string> = { bahan: "Bahan Baku", menu: "Menu", vendor: "Supplier" };

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header
      style={{
        height: 52,
        backgroundColor: "var(--color-os-surface)",
        borderBottom: "1px solid var(--color-os-border)",
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
        className="topbar-hamburger"
        style={{ background: "none", border: "none", color: "var(--color-os-sub)", cursor: "pointer", padding: "4px 6px", borderRadius: 6, lineHeight: 1, display: "flex", alignItems: "center" }}
        title="Toggle Sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Search Bar */}
      <div ref={searchRef} className="topbar-search" style={{ position: "relative", flex: 1, maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 8, padding: "6px 12px" }}>
          <span style={{ color: "var(--color-os-accent)", fontSize: 13 }}>✦</span>
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
            placeholder="Cari bahan, menu, supplier..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--color-os-text)", minWidth: 0 }}
          />
          {searching && <span style={{ fontSize: 10, color: "var(--color-os-muted)" }}>...</span>}
          {!searching && !searchQuery && (
            <kbd style={{ fontSize: 10, color: "var(--color-os-muted)", background: "var(--color-os-bg)", border: "1px solid var(--color-os-border)", borderRadius: 4, padding: "1px 5px" }}>⌘K</kbd>
          )}
        </div>

        {showSearch && searchQuery.length >= 2 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--color-os-card)", border: "1px solid var(--color-os-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden" }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--color-os-muted)", textAlign: "center" }}>
                {searching ? "Mencari..." : "Tidak ada hasil"}
              </div>
            ) : (
              <>
                {(["bahan", "menu", "vendor"] as const).map((type) => {
                  const group = searchResults.filter((r) => r.type === type);
                  if (!group.length) return null;
                  return (
                    <div key={type}>
                      <div style={{ padding: "8px 14px 4px", fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {typeLabel[type]}
                      </div>
                      {group.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { router.push(r.href); setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                          style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                          className="table-row-hover"
                        >
                          <span style={{ display: "flex", alignItems: "center" }}>{typeIconMap[r.type]}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-os-text)" }}>{r.label}</div>
                            <div style={{ fontSize: 10, color: "var(--color-os-sub)" }}>{r.id} · {r.sub}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Notification Bell */}
      <div ref={notifRef} style={{ position: "relative" }}>
        <button
          onClick={() => setShowNotif(!showNotif)}
          style={{ background: "none", border: "none", color: "var(--color-os-sub)", cursor: "pointer", padding: "4px 6px", position: "relative", display: "flex", alignItems: "center" }}
        >
          <Bell size={18} />
          {criticalCount > 0 && (
            <span style={{
              position: "absolute", top: 2, right: 2,
              minWidth: 14, height: 14, borderRadius: 7,
              background: "var(--color-os-red)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff", padding: "0 3px",
            }}>
              {criticalCount > 9 ? "9+" : criticalCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            width: 280, background: "var(--color-os-card)", border: "1px solid var(--color-os-border)",
            borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 50,
          }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-os-border)", fontSize: 12, fontWeight: 700, color: "var(--color-os-text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Notifikasi</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {criticalItems.length > 0 && (
                  <button
                    onClick={() => { setCriticalItems([]); setCriticalCount(0); }}
                    style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "transparent", color: "var(--color-os-sub)", border: "1px solid var(--color-os-border)", cursor: "pointer" }}
                  >
                    Tandai Dibaca
                  </button>
                )}
                {criticalCount > 0 && (
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "color-mix(in srgb, var(--color-os-red) 15%, transparent)", color: "var(--color-os-red)", border: "1px solid color-mix(in srgb, var(--color-os-red) 30%, transparent)" }}>
                    {criticalCount} item
                  </span>
                )}
              </div>
            </div>
            {criticalItems.length === 0 ? (
              <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 11, color: "var(--color-os-muted)" }}>
                Tidak ada notifikasi
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                <div style={{ padding: "8px 14px 4px", fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Pantau Stok (Min. Stok Aktif)
                </div>
                {criticalItems.map((item) => (
                  <div key={item.bahanId} style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-os-border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-os-text)" }}>{item.namaBahan}</div>
                      <div style={{ fontSize: 10, color: "var(--color-os-sub)" }}>
                        Min: {item.stokMinimum}{item.vendorNama ? ` · ${item.vendorNama}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => { router.push("/products"); setShowNotif(false); }}
                      style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "color-mix(in srgb, var(--color-os-amber) 15%, transparent)", color: "var(--color-os-amber)", border: "1px solid color-mix(in srgb, var(--color-os-amber) 30%, transparent)", cursor: "pointer" }}
                    >
                      PANTAU
                    </button>
                  </div>
                ))}
                <div style={{ padding: "10px 14px", fontSize: 10, color: "var(--color-os-muted)", textAlign: "center" }}>
                  Upload Kartu Stok untuk data stok real-time
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="topbar-keluar"
        style={{ fontSize: 11, color: "var(--color-os-sub)", background: "none", border: "1px solid var(--color-os-border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
      >
        Keluar
      </button>
    </header>
  );
}
