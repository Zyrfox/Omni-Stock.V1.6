"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useTheme, THEMES, type Theme } from "@/components/providers/theme-provider";

const THEME_DOTS: Record<Theme, string> = {
  dark: "var(--color-os-accent)",
  light: "#16A34A",
  tokyo: "#7AA2F7",
  catppuccin: "#CBA6F7",
  solarized: "#B58900",
};

interface ThemeSwitcherProps {
  collapsed?: boolean;
}

export function ThemeSwitcher({ collapsed = false }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const current = THEMES.find((t) => t.id === theme);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 8,
          padding: collapsed ? "8px 0" : "8px 14px",
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%",
          background: open ? "color-mix(in srgb, var(--color-os-accent) 7%, transparent)" : "none",
          border: "none",
          borderLeft: open ? "3px solid var(--color-os-accent)" : "3px solid transparent",
          color: open ? "var(--color-os-accent)" : "var(--color-os-sub)",
          cursor: "pointer",
          fontSize: 12,
          transition: "color 0.15s",
        }}
      >
        <Palette size={15} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, textAlign: "left" }}>Theme</span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: THEME_DOTS[theme],
              flexShrink: 0,
            }} />
          </>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 4px)",
          left: collapsed ? 58 : 8,
          right: collapsed ? "auto" : 8,
          width: collapsed ? 160 : "auto",
          background: "var(--color-os-surface)",
          border: "1px solid var(--color-os-border2)",
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 100,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "6px 10px 4px", fontSize: 9, fontWeight: 700, color: "var(--color-os-muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: theme === t.id ? "color-mix(in srgb, var(--color-os-accent) 7%, transparent)" : "none",
                border: "none",
                textAlign: "left",
                fontSize: 12,
                color: theme === t.id ? "var(--color-os-accent)" : "var(--color-os-text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: THEME_DOTS[t.id],
                flexShrink: 0,
                border: theme === t.id ? "2px solid var(--color-os-accent)" : "2px solid transparent",
              }} />
              {t.label}
              {theme === t.id && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-os-accent)" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
