# OMNI-STOCK V1.6 — Mobile UI PRD
## Panduan Lengkap Implementasi Mobile-First Responsive

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | Maret 2026 |
| **Parent PRD** | PRD_OmniStock_V1_5_FINAL.md (V1.6) |
| **Scope** | Mobile responsive untuk semua 12+ halaman |
| **Breakpoint** | `< 768px` = mobile, `768–1024px` = tablet, `> 1024px` = desktop |

---

## Daftar Isi

1. [Prinsip Umum Mobile](#1-prinsip-umum-mobile)
2. [Navigasi Mobile](#2-navigasi-mobile)
3. [Login Mobile](#3-login-mobile)
4. [Dashboard Mobile](#4-dashboard-mobile)
5. [Tabel Inventory Mobile](#5-tabel-inventory-mobile)
6. [PO Cart Mobile](#6-po-cart-mobile)
7. [Products & Recipes Mobile](#7-products--recipes-mobile)
8. [Master Menu + Channel Grouping Mobile](#8-master-menu--channel-grouping-mobile)
9. [BOM Editor Mobile](#9-bom-editor-mobile)
10. [AI Yield Wizard Mobile](#10-ai-yield-wizard-mobile)
11. [Suppliers Mobile](#11-suppliers-mobile)
12. [PO Logs Mobile](#12-po-logs-mobile)
13. [Halaman Lainnya](#13-halaman-lainnya)
14. [Komponen Shared Mobile](#14-komponen-shared-mobile)
15. [Implementasi Teknis](#15-implementasi-teknis)

---

## 1. Prinsip Umum Mobile

### 1.1 Filosofi
- **Mobile bukan versi kecil dari desktop** — mobile adalah antarmuka utama untuk staff lapangan dan manager yang cek stok dari HP
- Semua data yang tersedia di desktop HARUS bisa diakses di mobile, tapi **layout dan interaksi disesuaikan**
- Prioritas: readability > density. Jangan paksa tabel 10 kolom ke layar 360px

### 1.2 Strategi Adaptasi

| Komponen Desktop | Adaptasi Mobile |
|---|---|
| Sidebar navigasi 220px | Bottom navigation bar 5 slot |
| Topbar 52px | Compact header per halaman |
| Tabel horizontal 10+ kolom | **Dual mode**: Card View (default) + Table Scroll (opsional) |
| Stat cards grid 4 kolom | Grid 2×2 |
| Stat cards grid 3 kolom | Grid 3×1 (stacked) atau 2+1 |
| Modal 480–620px | Fullscreen sheet (slide dari bawah) |
| Sidebar PO Cart 300px | Fullscreen page terpisah |
| Widget row 2×2 | Stack vertikal 1 kolom |
| Drag-and-drop baris tabel | Drag handle tetap ada di card view, hidden di table scroll view |
| Pagination "20 baris" | Pagination tetap, dengan opsi "Load more" sebagai alternatif |

### 1.3 Breakpoints & Tailwind Classes

```
Mobile:  < 768px   → default (tanpa prefix)
Tablet:  768–1024px → md:
Desktop: > 1024px   → lg:
```

Pattern Tailwind yang konsisten:
```html
<!-- Grid responsif -->
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">

<!-- Sidebar → hidden di mobile -->
<aside class="hidden lg:flex ...">

<!-- Bottom nav → hidden di desktop -->
<nav class="flex lg:hidden fixed bottom-0 ...">

<!-- Modal → fullscreen di mobile -->
<div class="fixed inset-0 md:inset-auto md:w-[520px] md:rounded-2xl ...">
```

### 1.4 Touch Targets
- Minimum touch target: `44×44px` untuk semua tombol dan link
- Padding tombol: minimal `10px 16px`
- Jarak antar tombol aksi: minimal `8px`
- Badge/pill yang bisa diklik: minimal `32px` tinggi

### 1.5 Dark Theme (Sama dengan Desktop)
Semua color tokens dari PRD utama Section 2.1 berlaku identik di mobile. Tidak ada light mode.

---

## 2. Navigasi Mobile

### 2.1 Bottom Navigation Bar

Menggantikan sidebar di layar `< 1024px`. Fixed di bawah layar.

```
┌──────────────────────────────────────────┐
│   Home    Produk   [+Upload]   PO   Menu │
│    ⊞       📦        ⬆        📋    ☰   │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Container: `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`
- Background: `surface (#0F0F18)`, border-top: `1px solid border (#1E1E2E)`
- Padding: `6px 0 env(safe-area-inset-bottom, 16px)` — support iPhone safe area
- Z-index: `50`
- 5 slot, flex equal width

**Slot Detail:**

| # | Label | Icon | Route / Action | Badge |
|---|---|---|---|---|
| 1 | Home | ⊞ | `/dashboard` | — |
| 2 | Produk | 📦 | `/products` | — |
| 3 | Upload | + (FAB) | Trigger file input upload | — |
| 4 | PO | 📋 | `/po-logs` | Count draft PO (jika > 0) |
| 5 | Lainnya | ☰ | Buka "More Menu" page/sheet | Red dot jika ada notif |

**Slot 3 — Upload FAB (Floating Action Button):**
- Lingkaran `42×42px`, background gradient accent (`#C8F135 → #86EF3C`)
- Posisi: naik `-14px` dari baseline bottom nav
- Border: `3px solid surface` untuk visual separation
- Icon: `+` bold 18px, color `#0A0A0F`
- Klik → langsung trigger `<input type="file" accept=".xls,.xlsx">` — shortcut upload kartu stok

**Active State:**
- Color label + icon: `accent (#C8F135)`
- Inactive: `muted (#4B5563)`

**Kapan Bottom Nav Disembunyikan:**
- JANGAN sembunyikan saat scroll — selalu visible
- Sembunyikan HANYA di halaman `/login` dan `/change-password`

### 2.2 Compact Page Header

Menggantikan topbar di mobile. Per halaman.

```
┌──────────────────────────────────────────┐
│ [Logo] Dashboard              🔔  [Avatar]│
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Height: auto (flexible), padding: `env(safe-area-inset-top, 36px) 14px 8px`
- Background: `surface (#0F0F18)`, border-bottom: `1px solid border`
- Kiri: Logo icon (28px) + Page title (14px bold)
- Kanan: Notification bell (dengan red dot) + Avatar circle (26px)

### 2.3 "Lainnya" / More Menu Page

Halaman navigasi untuk semua route yang tidak masuk di bottom nav.

**Layout:**
- Profil card: Avatar besar (40px) + nama + email + badge role
- Grouped menu list (style iOS settings):
  - **Inventory**: Stores, Assets & Inv., Suppliers, Billing, Upload History, Delivery, Report
  - **Admin Only**: Users [A], Settings [A]
  - **Akun**: Ganti Password, Keluar

**Setiap menu item:**
- Padding: `12px 14px`
- Kiri: label 12px `text`, kanan: chevron `›` color `muted`
- Border-bottom: `1px solid border` antar item
- Admin-only items: badge `"A"` kecil di kanan label

---

## 3. Login Mobile

### 3.1 Layout
- Full viewport, background `#0A0A0F`
- Blob dekoratif: tetap ada tapi ukuran dikurangi 60% (160×160px dan 140×140px)
- Card: `width: 100%`, `max-width: 360px`, padding `24px 20px`, margin `0 16px`
- Card tetap centered vertikal + horizontal

### 3.2 Komponen
Semua komponen identik dengan desktop (PRD Section 4.2), dengan penyesuaian:
- Input field: `font-size: 16px` (PENTING — mencegah auto-zoom di iOS)
- Tombol CTA: `padding: 14px` (lebih besar dari desktop)
- Link Guest `"Lihat sebagai Guest →"`: ukuran `13px`, padding `10px 0` (touch target)
- Footer: `font-size: 10px`, margin-top `16px`
- Logo SVG: tetap `52×28px`

---

## 4. Dashboard Mobile

### 4.1 Page Header
```
[Logo 28px] Dashboard                    🔔 [N]
```

### 4.2 Smart Batch Uploader
- Full width card, padding `12px`
- Badge last upload: sama spec, tapi wrap ke baris baru jika panjang
- Drop zone: padding `14px`, border dashed
- Teks: "Upload atau drag file" (12px) + ".xls dan .xlsx" (9px)

### 4.3 Stat Cards — Grid 2×2
```
┌─────────────┐ ┌─────────────┐
│ Total Prod. │ │  Available  │
│     42      │ │     34      │
└─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐
│ Warn+Crit   │ │ Out of Stock│
│     6       │ │     2       │
└─────────────┘ └─────────────┘
```

**Spesifikasi:**
- `grid grid-cols-2 gap-2`
- Setiap card: background `card`, border `1px solid border`, border-radius `10px`, padding `10px`
- Icon watermark: **DISEMBUNYIKAN** di mobile (`hidden md:block`)
- Label: `8px` uppercase muted
- Nilai: `20px` bold (dikurangi dari 28px desktop)

### 4.4 Widget Stack (Vertikal, bukan 2×2)
Di mobile, semua 4 widget ditumpuk vertikal dalam 1 kolom:

1. **Smart Stock Warning** — sama spec, max 3 item
2. **AI Predictive Restock** — sama spec, label "powered by Claude API"
3. **Top Contributors** — sama spec
4. **Audit Pengeluaran** — sama spec

Gap antar widget: `8px`

### 4.5 Tabel Inventory
→ Lihat Section 5 (dedicated section)

### 4.6 Keranjang PO
→ Lihat Section 6

### 4.7 PO Logs Section
- Tabel scrollable horizontal, minimal kolom: PO ID, Vendor, Total Biaya, Status, Action
- Atau gunakan card view jika layar < 400px

---

## 5. Tabel Inventory Mobile

Ini adalah komponen terpenting di mobile karena ada 253+ bahan. Harus ada **2 mode tampilan** yang bisa di-toggle user.

### 5.1 Header Section

```
┌──────────────────────────────────────────┐
│ Tabel Inventory                 253 item │
│                                 [Filter] │
│ [🔍 Cari nama bahan...                ] │
│ [Semua(253)] [Critical(12)] [Warning(8)] │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Title: `14px` extrabold + item count `9px muted`
- Tombol Filter: icon funnel + "Filter" — badge biru, klik → expand filter panel
- Search bar: background `#14142A`, border `border2`, border-radius `7px`, padding `7px 10px`
- Status chips: horizontal scroll, gap `4px`
  - Active chip: background `rgba(200,241,53,0.1)`, color `accent`, border accent
  - Inactive: transparent, color sesuai status, border status

### 5.2 Mode A — Card View (DEFAULT Mobile)

Setiap bahan baku ditampilkan sebagai card individual.

```
┌─ CRITICAL ────────────────────────────────┐
│ Garnish – Selada                 CRITICAL │
│ GRN-BTMK-002                             │
│                                           │
│ Stok Akhir    Min. Stok    Harga Beli     │
│ 0 lembar      50           Rp 10.000/kg  │
│                                           │
│ [📦 packaged]  Vendor: —                  │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │          + Rancang PO                 │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**Spesifikasi per Card:**
- Container: background `card`, border `1px solid border`, border-radius `10px`
- **Border-left 3px** sesuai status:
  - CRITICAL: `#EF4444`
  - WARNING: `#F59E0B`
  - SAFE: `#22C55E`
- Overflow hidden (untuk CTA area)

**Konten card:**
- **Baris 1** — Nama + Status Badge
  - Nama: `12px` bold `text`, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
  - Status badge: spec standar (8px bold, padding `3px 7px`, border-radius `4px`)
  - Layout: `flex justify-between items-start`
- **Baris 2** — ID Bahan
  - Font: `9px` monospace `Courier New`, color `muted`
- **Baris 3** — Data Grid (3 kolom)
  - Layout: `grid grid-cols-3 gap-2`
  - Setiap cell:
    - Label: `7px` uppercase muted, letter-spacing `0.3px`
    - Nilai: `14px` bold (stok warna sesuai status, min muted, harga `text`)
    - Satuan: `9px` muted inline setelah nilai
- **Baris 4** — Badges
  - Tipe bahan: badge `packaged` (biru 📦) atau `raw_bulk` (hijau 🌿)
  - Vendor: `9px muted` inline, "—" jika kosong
  - Layout: `flex gap-2 items-center`
- **Baris 5** — CTA Area (HANYA untuk CRITICAL dan WARNING)
  - Container: background `rgba(status,0.06)`, border-top `1px solid rgba(status,0.1)`, padding `8px 12px`
  - Tombol: full width, background `rgba(status,0.15)`, border `1px solid rgba(status,0.2)`, border-radius `7px`
  - Teks: `"+ Rancang PO"`, `11px` bold, color status
  - Setelah diklik (in cart): `"✓ In Cart"`, color green, background `rgba(green,0.08)`
- **SAFE items**: TIDAK ada CTA area (card lebih pendek)

### 5.3 Mode B — Table Scroll View

Tabel horizontal identik dengan desktop, tapi scrollable.

**Wrapper:**
```html
<div class="overflow-x-auto -mx-3 px-3">
  <table class="min-w-[900px]">
```

**Kolom (identik desktop):**
| # | Kolom | Width | Sticky? |
|---|---|---|---|
| 1 | # | 30px | — |
| 2 | ID Bahan | 110px | — |
| 3 | Nama Bahan | 150px | **Ya** (`sticky left-0 z-10 bg-card`) |
| 4 | Tipe | 80px | — |
| 5 | Stok Akhir | 80px | — |
| 6 | Min. Stok | 65px | — |
| 7 | Status | 75px | — |
| 8 | Vendor | 100px | — |
| 9 | Harga Beli | 90px | — |
| 10 | Aksi | 100px | — |

**Sticky Column:**
- Kolom "Nama Bahan": `position: sticky; left: 0; z-index: 10; background: card`
- Shadow hint: `box-shadow: 4px 0 8px rgba(0,0,0,0.3)` di sisi kanan

**Scroll Indicator:**
- Teks `"← Scroll horizontal →"` di bawah tabel, `9px muted`, text-align center
- Atau CSS scroll shadow di kiri/kanan wrapper

### 5.4 Toggle View
- Tombol toggle ada di **Filter Panel** (bukan di header utama)
- Opsi: `Card` (default) | `Tabel`
- State disimpan di localStorage agar persistent

### 5.5 Filter Panel

Muncul saat user klik tombol "Filter" di header. Slide dari bawah atau expand inline.

**Isi filter:**

| Filter | Tipe | Opsi |
|---|---|---|
| Status | Chip multi-select | Semua / Critical / Warning / Safe |
| Vendor | Dropdown select | Semua Vendor / [list vendor] |
| Tipe Bahan | Chip select | Semua / Packaged / Raw/Bulk |
| Baris per halaman | Chip select | 20 / 30 / 40 / 50 |
| Tampilan | Chip select | Card / Tabel |

- Tombol "Reset" di kanan atas panel
- Tombol "Terapkan Filter" full width CTA di bawah

### 5.6 Pagination Mobile
- Layout: `flex justify-between items-center`
- Kiri: `"1–20 dari 253"`, `9px muted`
- Kanan: page buttons (angka + prev/next)
- Atau: tombol `"Muat 20 lagi..."` di bawah list (infinite scroll feel)

---

## 6. PO Cart Mobile

### 6.1 Akses
Di V1.6 desktop, keranjang PO ada di bawah tabel inventory (bukan sidebar). Di mobile:
- Saat user klik `"+ Rancang PO"` di card/tabel → item masuk ke cart
- **Badge count** muncul di bottom nav slot PO (`📋` dengan angka)
- User navigate ke cart via:
  - Klik badge di bottom nav → sheet/page cart
  - Atau scroll ke bawah tabel inventory ke section cart

### 6.2 Cart Layout — Full Page

```
┌──────────────────────────────────────────┐
│ Keranjang PO                    [2 item] │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ Beras Premium                       │ │
│ │ CV Maju Bersama    [🌿 Raw/Bulk+AI] │ │
│ │                                     │ │
│ │ Qty order      Harga satuan         │ │
│ │ [25 kg    ]    [Rp 13.000    ]      │ │
│ │                                     │ │
│ │ ┌ ✦ AI Research (Claude) ────────┐  │ │
│ │ │ Harga pasar    Rp 13.200/kg    │  │ │
│ │ │ Yield est.     ~166 porsi nasi │  │ │
│ │ │ Buffer         5 hari          │  │ │
│ │ └────────────────────────────────┘  │ │
│ │                                     │ │
│ │ Subtotal              Rp 325.000    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Minyak Goreng 1L                    │ │
│ │ PT Sari Rasa       [📦 Packaged]    │ │
│ │                                     │ │
│ │ Qty       Harga                     │ │
│ │ [6 pcs]   [Rp 45.000]              │ │
│ │                                     │ │
│ │ Subtotal              Rp 270.000    │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│ Total (2 item)            Rp 595.000     │
│ ┌──────────────────────────────────────┐ │
│ │        + Buat 2 Draft PO            │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Setiap item card: background `card`, border `border`, border-radius `10px`, padding `12px`
- Badge template: `Raw/Bulk + AI` (hijau) atau `Packaged` (biru)
- Input fields: flex 2 kolom, background `surface`, border `border2`
- AI Research panel (HANYA untuk `raw_bulk`): background `rgba(accent,0.04)`, border `rgba(accent,0.1)`
- Subtotal: border-top `1px solid border`, flex justify-between
- **Sticky bottom bar:**
  - Position: `sticky bottom-0` atau `fixed bottom-[60px]` (di atas bottom nav)
  - Background: `surface`, border-top `border`, padding `10px 16px`
  - Total: text `muted` kiri, nominal `red bold 14px` kanan
  - CTA: full width, gradient accent, `12px` extrabold, border-radius `8px`, padding `12px`
- **Empty state:**
  - Icon 🛒 besar (40px), opacity `0.3`
  - Teks: `"Belum ada item di keranjang"`, `12px muted`
  - Sub-teks: `"Klik '+ Rancang PO' di tabel inventory"`, `10px muted`
- **Swipe to delete**: opsional — swipe kiri pada item card untuk hapus dari cart

---

## 7. Products & Recipes Mobile

### 7.1 Tab Selector
- Background `#14142A`, padding `3px`, border-radius `8px`
- 3 tab: `Bahan` | `Resep` | `Menu`
- Label disingkat dari "1. Master Bahan" → "Bahan" agar muat
- Active: background `rgba(accent,0.1)`, color `accent`
- Tab bisa wrap jika layar < 340px (unlikely, tapi safe)

### 7.2 Stat Bar — Grid 3 kolom compact

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Bahan    │ │ BOM      │ │ Menu     │
│    42    │ │    18    │ │    35    │
└──────────┘ └──────────┘ └──────────┘
```

- `grid grid-cols-3 gap-2`
- Card: padding `8px`, text-align center
- Label: `8px`, Nilai: `18px` bold

### 7.3 Tab 1 — Master Bahan Mobile (Card View)

Setiap bahan baku jadi card:

```
┌──────────────────────────────────────────┐
│ ⠿  Beras Premium              [🌿 raw]  │
│    BHN-001                               │
│                                          │
│ Kemasan    Dapur   Min    Harga   Yield  │
│ 1 karung   gram   5.000  610rb   50.000 │
│                                          │
│ Harga/porsi: Rp 12,2                     │
│                                          │
│ [ID]  [Edit]  [Hapus]                    │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Drag handle `⠿`: `12px`, color `#374151`, cursor grab, di kiri nama
- Nama: `11px bold text`, Tipe badge di kanan
- ID: `9px monospace muted`
- Data: `flex gap-2 flex-wrap` — setiap item: label `8px muted` + nilai `9px sub`
- Harga/porsi: `accent bold` (calculated field)
- Aksi buttons: flex row gap `6px`
  - `[ID]`: background `rgba(accent,0.08)`, color `accent`, 8px bold — **admin only**
  - `[Edit]`: background `rgba(blue,0.08)`, color `blue`
  - `[Hapus]`: background `rgba(red,0.08)`, color `red`

**Search + Pagination:** sama dengan Section 5

### 7.4 Modal Tambah/Edit Bahan — Fullscreen Sheet

Di mobile, modal `520px` desktop → fullscreen bottom sheet.

**Spesifikasi:**
- `position: fixed; inset: 0` atau slide dari bawah
- Background: `card`, border-radius top: `18px` (jika sheet), `0` (jika fullscreen)
- Header: Accent line 3px + title `"Tambah Bahan Baku"` + tombol `✕` close
- Body: scrollable, padding `16px`
- Semua field stacked vertikal (1 kolom), label di atas
- Field yang berdampingan di desktop (misal Kemasan + Satuan): tetap 2 kolom di mobile jika muat, atau stack
- **Mode Yield (3 opsi):** tab/segmented control di atas field Isi Kemasan
  - Direct | Batch | AI Estimasi
- Tombol "✦ Estimasi Porsi (AI)" → trigger AI Yield Wizard (Section 10)
- Footer sticky: `Batal` (ghost) + `Simpan Bahan` (primary)

---

## 8. Master Menu + Channel Grouping Mobile

### 8.1 Group Card View

Setiap menu group jadi card yang bisa di-expand/collapse:

```
┌──────────────────────────────────────────┐
│ ▾ ⠿  Dimsum – Ayam          [3 channel] │
│ ┌────────────────────────────────────────┤
│ │ 🏠 Dine In          MNU-001    72%    │
│ │   COGS Rp 8.500 · Jual 32.000 · 0%   │
│ ├────────────────────────────────────────┤
│ │ 🟢 GrabFood         MNU-002    47%    │
│ │   COGS Rp 8.500 · Jual 35.000 · 20%  │
│ ├────────────────────────────────────────┤
│ │ 🟠 ShopeeFood       MNU-003    44%    │
│ │   COGS Rp 8.500 · Jual 33.000 · 20%  │
│ └────────────────────────────────────────┤
│             [+ Variant]  [Edit Resep]    │
└──────────────────────────────────────────┘
```

**Group Header:**
- Toggle: `▸` (collapsed) / `▾` (expanded), color `accent`
- Drag handle: `⠿`, hidden di mobile table view
- Nama menu: `12px bold text`
- Badge: `"N channel"`, background `rgba(accent,0.1)`, color `accent`

**Sub-rows (Variants):**
- Indent kiri: `28px` (di bawah toggle/drag area)
- Setiap variant:
  - Channel icon + label
  - ID Menu: monospace `muted` — `MNU-xxx`
  - Margin: warna sesuai threshold (hijau ≥65%, amber ≥40%, merah <40%)
  - Detail line: COGS, Harga Jual, Fee % (fee disorot `amber` jika > 0)
- Border-top antar variant: `1px solid surface`

**Footer row:**
- `flex gap-2 justify-end`
- `"+ Variant"`: color `accent` text button
- `"Edit Resep"`: color `blue` text button

**Collapsed State:**
- Hanya tampilkan group header
- Inline summary: channel icons + outlet + dominant margin

### 8.2 Margin Color Coding

```
margin ≥ 65%  → hijau (#22C55E)
margin ≥ 40%  → amber (#F59E0B)
margin < 40%  → merah (#EF4444)
```

Formula:
```
fee_amount  = harga_jual × (platform_fee_percent / 100)
net_revenue = harga_jual - fee_amount
margin      = (net_revenue - total_cogs) / net_revenue × 100
```

### 8.3 Modal Tambah Menu — Fullscreen Sheet

Fields stacked vertikal:
- Nama Menu * (text)
- Kategori * (select: food / beverage)
- Harga Jual (number)
- Outlet (select)
- Channel (select: dine_in / takeaway / grabfood / shopee / gofood / other)
- Platform Fee % (number, auto-filled berdasarkan channel: 0 atau 20)

---

## 9. BOM Editor Mobile

### 9.1 Layout — Fullscreen Page

Di desktop: modal 620px. Di mobile: fullscreen page dengan back button.

```
┌──────────────────────────────────────────┐
│ ← Edit Resep: Dimsum Ayam                │
├──────────────────────────────────────────┤
│ ┌ Total COGS saat ini ─── Rp 8.500 ───┐ │
│ └──────────────────────────────────────┘ │
│                                          │
│ KOMPOSISI BAHAN                          │
│ ┌──────────────────────────────────────┐ │
│ │ [Bahan]  Tepung Terigu         🗑    │ │
│ │ Qty [50]  Satuan [gram]  COGS Rp610 │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ [Sub-Resep]  Kulit Dimsum      🗑    │ │
│ │ Qty [3]   Satuan [lmbr]  COGS Rp1.2k│ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ [Kemasan]  Cup Plastik 16oz    🗑    │ │
│ │ Qty [1]   Satuan [pcs]   COGS Rp350 │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌ + Tambah baris komposisi ────────────┐ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│    [Batal]        [Simpan Resep]         │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Header: back arrow `←` + "Edit Resep: [nama menu]"
- **Total COGS card**: sticky top, background `rgba(accent,0.04)`, border `rgba(accent,0.1)`, border-radius `8px`
  - Kiri: `"Total COGS saat ini"`, 10px semibold accent
  - Kanan: nominal `16px extrabold accent`
  - Nilai update real-time saat user ubah qty atau item
- **Setiap baris komposisi** = card:
  - Row 1: Tipe badge (`Bahan` hijau / `Sub-Resep` biru / `Kemasan` biru) + Item name (searchable combobox) + delete icon 🗑 merah
  - Row 2: 3 kolom flex — Qty (input number) + Satuan (text/select) + Sub-COGS (calculated, accent, read-only)
  - Combobox item: `dropdown via portal` (escape overflow hidden) — searchable
- **Tombol tambah**: dashed border accent, teks `"+ Tambah baris komposisi"` accent, full width
- **Footer sticky**: `Batal` (ghost 1fr) + `Simpan Resep` (primary 2fr), gap `8px`

---

## 10. AI Yield Wizard Mobile

### 10.1 Trigger
Saat user klik `"✦ Estimasi Porsi (AI)"` di modal Tambah Bahan (field Isi Kemasan, mode AI).

### 10.2 Layout — Bottom Sheet atau Inline Expand

```
┌──────────────────────────────────────────┐
│ ✦ AI Yield Wizard                        │
│ Estimasi porsi: Beras Premium            │
│ Claude akan membantu estimasi yield.     │
├──────────────────────────────────────────┤
│ ┌ ✦ Pertanyaan 1 dari 3 ──────────────┐ │
│ │ Berapa gram beras yang biasa         │ │
│ │ digunakan untuk satu porsi nasi?     │ │
│ └──────────────────────────────────────┘ │
│ [150 gram                          ] [→] │
│                                          │
│ ┌ ✦ Pertanyaan 2 dari 3 ──────────────┐ │
│ │ Apakah beras ini juga digunakan      │ │
│ │ untuk menu lain selain nasi putih?   │ │
│ └──────────────────────────────────────┘ │
│ [Ya, 3 menu]        [Tidak]             │
│                                          │
│ ┌ ✓ Hasil Estimasi AI ────────────────┐ │
│ │ Yield/karung (50kg)   ~333 porsi    │ │
│ │ Harga per porsi       Rp 1.831      │ │
│ │                                      │ │
│ │ "Berdasarkan 150g/porsi, 1 karung   │ │
│ │  50kg menghasilkan ~333 porsi..."    │ │
│ │                                      │ │
│ │ [Terima estimasi]  [Abaikan]         │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Spesifikasi:**
- Intro card: gradient subtle `rgba(accent,0.06) → rgba(blue,0.04)`, border `rgba(accent,0.15)`
- Pertanyaan card: background `card`, border `border`
  - Icon: Circle 24px, background `rgba(accent,0.1)`, icon `✦` accent
  - Label: "Pertanyaan N dari M", `11px semibold text`
  - Teks: `10px sub`, line-height `1.4`
- Input jawaban:
  - Text input: standard spec + send button (circle accent, icon `→`)
  - Atau choice buttons: flex row, background `surface`, border `border2`, padding `9px`, text center
- Hasil card: background `rgba(accent,0.04)`, border `rgba(accent,0.1)`
  - Data rows: flex justify-between, label `muted`, value `text bold`
  - Narasi: `9px sub italic`, line-height `1.3`
  - Buttons: `Terima estimasi` (primary flex-1) + `Abaikan` (ghost flex-1)
- Loading state saat menunggu Claude: spinner + "Claude sedang menganalisis..."

---

## 11. Suppliers Mobile

### 11.1 List View (Card View)

```
┌──────────────────────────────────────────┐
│ CV Maju Bersama             [LT: 3 hari] │
│ 📱 08123456789                           │
│ 💳 BCA 1234567890                        │
│                                          │
│ 5 item · Rp 2,4jt              Detail →  │
└──────────────────────────────────────────┘
```

### 11.2 Detail View — Full Page

```
┌──────────────────────────────────────────┐
│ ← CV Maju Bersama              [✏ Edit] │
├──────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐               │
│ │ Kontak   │ │ Lead Time│               │
│ │ 08123... │ │  3 hari  │               │
│ └──────────┘ └──────────┘               │
│ ┌──────────┐ ┌──────────┐               │
│ │ Bayar    │ │ Spend    │               │
│ │ BCA 123..│ │ Rp 2,4jt │               │
│ └──────────┘ └──────────┘               │
│                                          │
│ Bahan Disupply                [+ Tambah] │
│ ┌──────────────────────────────────────┐ │
│ │ Beras Premium                       │ │
│ │ Rp 13.000/kg · Primary        [Edit]│ │
│ ├──────────────────────────────────────┤ │
│ │ Gula Pasir                          │ │
│ │ Rp 18.000/kg                  [Edit]│ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Riwayat PO                               │
│ ┌──────────────────────────────────────┐ │
│ │ PO-008  Beras 25kg     RECEIVED     │ │
│ │                        Rp 325.000   │ │
│ ├──────────────────────────────────────┤ │
│ │ PO-005  Gula 10kg      SENT         │ │
│ │                        Rp 180.000   │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## 12. PO Logs Mobile

### 12.1 Layout

```
┌──────────────────────────────────────────┐
│ PO Logs                                  │
├──────────────────────────────────────────┤
│ [Total 15] [Draft 3] [Sent 4] [Done 8]  │
│                                          │
│ [Cari PO / vendor...] [All▾][Draft]...   │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PO-012                       SENT    │ │
│ │ Beras Premium 25kg                   │ │
│ │ CV Maju · Admin · 10 Mar            │ │
│ │                         Rp 325.000   │ │
│ │                                      │ │
│ │ ○ Draft ──── ● Sent ──── ○ Received │ │
│ │                                      │ │
│ │ [✓ Terima]  [PDF]                    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PO-011                       DRAFT   │ │
│ │ Minyak Goreng 6pcs                   │ │
│ │ PT Sari · Admin · 10 Mar            │ │
│ │                         Rp 270.000   │ │
│ │                                      │ │
│ │ [📤 Kirim]  [PDF]                    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│              [1] [2] [›]                 │
└──────────────────────────────────────────┘
```

**Status Timeline (inline per card):**
```
○─────●─────○
Draft  Sent  Received
```
- Circle completed: background `rgba(status,0.2)`, border `2px solid status`, icon `✓`
- Circle current: sama + badge "Current" (optional di mobile, bisa skip)
- Circle future: border `2px solid border2`, transparent
- Line completed: height `2px`, color status
- Line future: height `2px`, color `border`

---

## 13. Halaman Lainnya

### 13.1 Stores Mobile
- Stat cards: grid 2×2
- Tab: Upload Compliance | Profitability
- Tabel: card view per outlet (nama, compliance bar, critical/warning count)
- Profitability Matrix: card view per menu (nama, COGS, jual, margin badge)

### 13.2 Assets & Inventory Mobile
- 3 tab tetap: Barang Habis Pakai | Aset Tetap | Mutasi
- Setiap tab: card view, bukan tabel
- Tombol tambah per tab

### 13.3 Billing Mobile
- Stat cards: grid 2×2
- Tabel invoice: card view — ID, vendor, total, status badge, action buttons
- Tombol "Tandai Lunas": prominent di card UNPAID

### 13.4 Upload History Mobile
- Card view: setiap upload = card — file name, outlet badge, status badge, items parsed, tanggal
- Read-only, tidak ada aksi

### 13.5 Delivery Mobile
- Stat cards: grid 3 kolom compact
- Card view per delivery: DEL ID, PO ID, vendor, bahan, ETA, status badge
- Tombol "✓ Konfirmasi Terima" prominent

### 13.6 Report Mobile
- Stat cards: grid 2×2
- Chart: full width, height `120px` (dikurangi dari 140px)
- Filter periode: chip selector horizontal
- Top 5 + Vendor perf: stacked vertikal (bukan 2 kolom)
- Export Excel: tombol ghost di header

### 13.7 Users Mobile (Admin Only)
- Stat cards: grid 3 compact
- Card view per user: avatar + nama + email + role badge + status + aksi
- Modal tambah user: fullscreen sheet
- Credential card: fullscreen overlay

### 13.8 Settings Mobile (Admin Only)
- 4 card stacked vertikal (bukan grid 2 kolom)
- Migration card: same logic, button full width
- Info cards: same content

---

## 14. Komponen Shared Mobile

### 14.1 Fullscreen Modal / Bottom Sheet

Pattern untuk SEMUA modal di mobile:

```css
/* Mobile: fullscreen */
@media (max-width: 767px) {
  .modal-content {
    position: fixed;
    inset: 0;
    border-radius: 0;
    max-height: 100vh;
    overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom, 20px);
  }
}

/* Tablet+: centered modal */
@media (min-width: 768px) {
  .modal-content {
    width: 520px;
    border-radius: 18px;
    max-height: 90vh;
  }
}
```

### 14.2 Empty State Mobile
- Icon: `32px`, opacity `0.3`
- Teks utama: `12px muted`
- Teks panduan: `10px muted`
- Centered, padding `40px 20px`

### 14.3 Loading State Mobile
- Spinner circle `20px`, color `accent`
- Teks: `"Memuat..."`, `11px muted`
- Skeleton cards: background `surface`, animate pulse

### 14.4 Toast / Alert Mobile
- Position: top center, `inset-x: 16px`, `top: env(safe-area-inset-top, 44px)`
- Background: sesuai tipe (success green, error red, warning amber)
- Auto dismiss: 3 detik
- Swipe up to dismiss

### 14.5 Guest Mode Mobile
- Bottom nav: Upload FAB **hidden** (diganti spacer)
- Semua tombol aksi (tambah, edit, hapus, rancang PO): **hidden**
- Badge "GUEST" tidak wajib ditampilkan

---

## 15. Implementasi Teknis

### 15.1 Responsive Utilities (Tailwind)

```js
// tailwind.config.ts
screens: {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
}
```

### 15.2 Key CSS Patterns

```css
/* Safe area padding untuk iPhone notch/home indicator */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.page-header {
  padding-top: env(safe-area-inset-top, 36px);
}

/* Prevent iOS zoom on input focus */
input, select, textarea {
  font-size: 16px; /* WAJIB di iOS */
}

/* Horizontal scroll table wrapper */
.table-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Sticky column */
.sticky-col {
  position: sticky;
  left: 0;
  z-index: 10;
  background: #13131F;
  box-shadow: 4px 0 8px rgba(0,0,0,0.3);
}
```

### 15.3 Body Padding
- Semua halaman: `padding-bottom: 72px` (tinggi bottom nav + safe area)
- Content area: `padding: 10px 12px 72px`

### 15.4 Performance
- Card view: gunakan `virtualized list` jika > 100 item (react-window atau @tanstack/virtual)
- Lazy load widget row: widget 3 dan 4 bisa lazy load
- Image: tidak ada image berat di app ini, skip optimization

### 15.5 Gesture Support (Nice to Have)
- Swipe left pada cart item → delete
- Pull to refresh pada list pages
- Swipe between tabs (Products, PO Logs)

---

## Checklist Implementasi

| # | Screen | Prioritas |
|---|---|---|
| 1 | Bottom Navigation Bar | P0 |
| 2 | Compact Page Header | P0 |
| 3 | Login Mobile | P0 |
| 4 | Dashboard — stat cards 2×2 + widget stack | P0 |
| 5 | Tabel Inventory — Card View + Filter | P0 |
| 6 | Tabel Inventory — Table Scroll + Sticky Col | P0 |
| 7 | PO Cart — Full Page | P0 |
| 8 | Master Bahan — Card View | P0 |
| 9 | Master Menu — Channel Group Cards | P0 |
| 10 | BOM Editor — Fullscreen | P1 |
| 11 | AI Yield Wizard — Chat UI | P1 |
| 12 | Supplier Detail — Full Page | P1 |
| 13 | PO Logs — Card View + Timeline | P1 |
| 14 | More Menu Page | P1 |
| 15 | All Modals → Fullscreen Sheet | P1 |
| 16 | Stores, Assets, Billing, Delivery, Report, Users, Settings | P2 |
| 17 | Empty States + Loading + Toast | P2 |
| 18 | Guest Mode — hide actions | P2 |

---

*— OMNI-STOCK V1.6 Mobile UI PRD · Easy Going Group · Maret 2026*
