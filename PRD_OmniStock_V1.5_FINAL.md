# OMNI-STOCK V1.5 Phase 1 — The Predictive Watchdog
## Product Requirements Document — FINAL

| | |
|---|---|
| **Versi Dokumen** | 2.0 — Final |
| **Tanggal** | Maret 2026 |
| **Owner** | Easy Going Group |
| **Status** | ✅ FINAL — Siap Development |

---

## Daftar Isi

1. [Overview](#1-overview)
2. [Design System](#2-design-system)
3. [Shell Layout & Navigasi](#3-shell-layout--navigasi)
4. [Halaman Login](#4-halaman-login-login)
5. [Dashboard](#5-dashboard-dashboard)
6. [Stores](#6-stores-stores)
7. [Products & Recipes](#7-products--recipes-products)
8. [Assets & Inventory](#8-assets--inventory-category)
9. [Suppliers](#9-suppliers-suppliers)
10. [Billing](#10-billing-billing)
11. [Upload History](#11-upload-history-upload-history)
12. [PO Logs](#12-po-logs-po-logs)
13. [Delivery](#13-delivery-delivery)
14. [Report](#14-report-report)
15. [Users (Admin Only)](#15-users-users--admin-only)
16. [Settings (Admin Only)](#16-settings-settings--admin-only)
17. [Database Schema](#17-database-schema)
18. [Logika Status 3 Warna](#18-logika-status-3-warna)
19. [AI Engine — Gemini API](#19-ai-engine--gemini-api)
20. [Tech Stack](#20-tech-stack)
21. [Environment Variables](#21-environment-variables)
22. [Implementation Roadmap](#22-implementation-roadmap-phase-1)

---

## 1. Overview

Omni-Stock V1.5 Phase 1 adalah platform manajemen persediaan terpusat untuk bisnis F&B multi-outlet milik Easy Going Group. Sistem ini berfungsi sebagai back-office yang menarik data dari Pawoon POS (via Excel), membedah menu menjadi komponen bahan baku lewat Bill of Materials (BOM), serta melacak dan memprediksi kebutuhan stok agar manajemen dapat melakukan pengadaan bahan baku secara efisien ke vendor.

**Fokus Phase 1 mencakup tiga pilar utama:**

- Membangun fondasi arsitektur data dengan 11 tabel Drizzle ORM yang menjadi Single Source of Truth.
- Migrasi one-way dari Google Sheets secara atomik — hanya boleh dijalankan satu kali.
- Mengaktifkan AI Prediction Engine (Gemini API) untuk rekomendasi restock berdasarkan Lead Time dan `avg_daily_consumption`.

> ⚠️ **PENTING:** PRD ini adalah dokumen FINAL yang menjadi kontrak antara design dan engineering. Setiap halaman, komponen, field, warna, dan logika di dokumen ini **HARUS diimplementasikan identik** dengan rancangan UI.

---

## 2. Design System

Seluruh UI menggunakan dark theme konsisten. Semua nilai warna, tipografi, dan komponen di bawah ini adalah referensi tetap yang harus diikuti di seluruh codebase.

### 2.1 Color Tokens

| Token Name | Nilai Hex | Penggunaan |
|---|---|---|
| `bg` | `#0A0A0F` | Background halaman utama |
| `surface` | `#0F0F18` | Sidebar, topbar, card background |
| `card` | `#13131F` | Card konten, modal background |
| `border` | `#1E1E2E` | Border card, divider garis |
| `border2` | `#2D2D44` | Border input, hover state |
| `muted` | `#4B5563` | Label sekunder, placeholder |
| `sub` | `#6B7280` | Teks deskripsi, teks tabel |
| `text` | `#E2E8F0` | Teks utama konten |
| `accent` | `#C8F135` | Tombol CTA, active nav, badge Admin |
| `accentD` | `#86EF3C` | Gradient ujung tombol aksen |
| `red` | `#EF4444` | Status CRITICAL, error, destructive action |
| `amber` | `#F59E0B` | Status WARNING, PO status SENT |
| `green` | `#22C55E` | Status SAFE, RECEIVED, aktif |
| `blue` | `#60A5FA` | Badge info, tombol detail, label kategori |

### 2.2 Typography Scale

| Elemen UI | Font | Size | Weight | Color Token |
|---|---|---|---|---|
| Page Title H1 | DM Sans / Arial | 20px | 800 ExtraBold | `text` |
| Section Title | DM Sans / Arial | 14px | 700 Bold | `text` |
| Card Title | DM Sans / Arial | 13px | 700 Bold | `text` |
| Body / Table row | DM Sans / Arial | 12px | 400 Regular | `text` / `sub` |
| Label / Caption | DM Sans / Arial | 10–11px | 600 SemiBold UPPERCASE | `muted` |
| Code / ID | Courier New | 11–12px | 400 Regular | `muted` / `accent` |
| Stat Number | DM Sans / Arial | 28–30px | 800 ExtraBold | varies |
| Badge / Pill | DM Sans / Arial | 9–10px | 700 Bold | varies |

### 2.3 Spacing & Radius

| Elemen | Nilai |
|---|---|
| Border radius — card | `12px` |
| Border radius — modal | `12–18px` |
| Border radius — button | `7–10px` |
| Border radius — badge/pill | `3–5px` |
| Border radius — input | `7–9px` |
| Padding card | `18–20px` |
| Padding tabel cell | `10px 14px` |
| Gap grid stat cards | `14px` |
| Sidebar expanded width | `220px` |
| Sidebar collapsed width | `58px` |
| Topbar height | `52px` |

### 2.4 Komponen Global

#### Tombol CTA (Primary)
- Background: `linear-gradient(135deg, #C8F135, #86EF3C)`
- Color teks: `#0A0A0F` (hitam pekat), font-weight: 800, border-radius: 7–10px
- Disabled state: `background #1E2A06`, color `muted`, cursor: `not-allowed`, opacity: 0.7
- Loading state: spinner circle 14px + teks `"Memverifikasi..."`

#### Tombol Ghost
- Background: `transparent`, border: `1px solid #2D2D44`, color: `sub`

#### Tombol Danger
- Background: `rgba(239,68,68,0.1)`, border: `1px solid rgba(239,68,68,0.3)`, color: `red`

#### Tombol Blue
- Background: `rgba(96,165,250,0.1)`, border: `1px solid rgba(96,165,250,0.3)`, color: `blue`

#### Badge / Pill
- Font: 9–10px bold, padding: `2–3px 7–8px`, border-radius: `3–5px`
- Setiap kategori memiliki kombinasi `color` + `bg (rgba)` + `border (rgba)` yang konsisten

#### Stat Card
- `background: card`, `border: 1px solid border`, `border-radius: 12px`, `padding: 18px`, `overflow: hidden`
- Icon watermark: `position absolute` top-right, `opacity: 0.15`, `font-size: 22px`
- Label: `10px uppercase letter-spacing 0.5`, color: `muted`
- Nilai: `28px bold`, color: `text`

#### Table
- Header row: `background #14142A`, 10px uppercase bold `muted`, `border-bottom border`
- Data row: hover `background #14142A`, `border-bottom #131320`, `transition background 0.1s`
- ID column: font monospace, color `muted`

#### Modal / Dialog
- Overlay: `position fixed inset-0`, `background rgba(0,0,0,0.75)`, flex center
- Card: `background card`, `border-radius 12–18px`, `border border2`, box-shadow tebal
- Accent line: `3px` gradient (`#C8F135 → #86EF3C → transparent`) di paling atas
- Animation: `fadeIn 0.25s ease` — `translateY(10px) → 0`, `opacity 0 → 1`

#### Input Field
- Background: `#0F0F18`, border: `1px solid border2`
- `border-radius: 7–9px`, `padding: 8–11px 12–14px`, font-size: `12–13px`
- `onFocus`: `border-color → accent (#C8F135)`, `transition: 0.2s`

---

## 3. Shell Layout & Navigasi

### 3.1 Sidebar

| Bagian | Spesifikasi |
|---|---|
| Container | Width `220px` (expanded) / `58px` (collapsed), background `surface`, `border-right 1px border`, `transition width 0.2s` |
| Logo area | Padding `18px 14px 14px`, border-bottom. Logo: div `32×32px` border-radius `8px` gradient accent, icon `⊚`. Teks `"OMNI-STOCK"` 12px bold + subtitle `"Easy Going Group"` 9px muted |
| Nav section label | 9px uppercase letter-spacing 2px, color `#374151`, tersembunyi saat collapsed |
| Nav item | Padding `8px 14px` (expanded) / `10px 0 justify-center` (collapsed). Active: `background rgba(200,241,53,0.07)` + `border-left 3px accent` |
| Badge admin-only | Badge `"A"` 8px di kanan label untuk halaman Users & Settings |
| User pill | Padding `12px 14px`, border-top. Avatar 28px circle gradient accent, initial nama, nama 11px bold, email 9px muted, badge role 8px |

### 3.2 Struktur Navigasi

| Section | Label | Icon | Route | Role |
|---|---|---|---|---|
| DISCOVER | Dashboard | ⊞ | `/dashboard` | Admin + Manager |
| DISCOVER | Stores | 🏪 | `/stores` | Admin + Manager |
| INVENTORY | Products & Recipes | 📦 | `/products` | Admin + Manager |
| INVENTORY | Assets & Inv. | 🗂 | `/category` | Admin + Manager |
| INVENTORY | Suppliers | 🚚 | `/suppliers` | Admin + Manager |
| INVENTORY | Billing | 💳 | `/billing` | Admin + Manager |
| INVENTORY | Upload History | ⬆ | `/upload-history` | Admin + Manager |
| INVENTORY | PO Logs | 📋 | `/po-logs` | Admin + Manager |
| INVENTORY | Delivery | 🚛 | `/delivery` | Admin + Manager |
| INVENTORY | Report | 📊 | `/report` | Admin + Manager |
| SETTINGS | Users | 👥 | `/users` | **Admin Only** |
| SETTINGS | Settings | ⚙ | `/settings` | **Admin Only** |

> ⚠️ Halaman `/users` dan `/settings` WAJIB server-side role check. Manager yang akses langsung via URL → redirect `/dashboard` atau 403.

### 3.3 Topbar

| Elemen | Spesifikasi |
|---|---|
| Container | Height `52px`, background `surface`, `border-bottom 1px border`, padding `0 20px` |
| Hamburger ☰ | Toggle collapse/expand sidebar |
| AI Search Bar | Background `#14142A`, border `1px border2`, border-radius `8px`, min-width `220px`. Icon `✦` accent. Teks `"Ask AI anything..."`. Shortcut `⌘K` di kanan. |
| Notification Bell | Icon 🔔 dengan red dot indicator (`7×7px`). Klik → dropdown notifikasi (width `260px`). |
| Dark Mode Toggle | Icon 🌙 |

---

## 4. Halaman Login (`/login`)

### 4.1 Layout
- Full viewport, background `#0A0A0F`
- Blob kiri atas: `400×400px`, `radial-gradient rgba(200,241,53,0.06)`
- Blob kanan bawah: `350×350px`, `radial-gradient rgba(96,165,250,0.05)`
- Card: width `420px`, centered, background `card (#13131F)`, `border-radius 18px`, `box-shadow 0 32px 80px rgba(0,0,0,0.6)`
- Accent line: `3px` gradient di paling atas card

### 4.2 Komponen dalam Card

| Elemen | Spesifikasi |
|---|---|
| Logo SVG | 3 lingkaran, `52×28px`. Stroke `#C8F135`, `strokeWidth 2.5` |
| Judul | `"Selamat Datang"`, 22px bold |
| Subtitle | `"Masuk ke OMNI-STOCK Dashboard"`, 12px color `sub` |
| Tab Role | 3 tab: **STAFF / SPV / MANAGER**. Active: color `accent`, border-bottom `2px solid accent` |
| Input Email | Type `email`, `onFocus: border-color → accent` |
| Input Password | Type `password`, toggle show/hide (icon 👁/🙈) di kanan |
| Error state | Background `rgba(239,68,68,0.08)`, border `rgba(239,68,68,0.2)`, icon `⚠` |
| Tombol CTA | `"→ Masuk ke Dashboard"`, full-width, gradient accent, loading state dengan spinner |
| Footer | `"Easy Going Group © 2026 · OMNI-STOCK"`, 10px, color `muted` |

### 4.3 Auth Logic
- Better Auth: email + password credential provider
- Hanya email yang terdaftar di tabel `users` yang dapat login
- Jika `must_change_password = true`: redirect ke `/change-password` setelah login pertama
- Session: JWT 7 hari
- Redirect setelah login berhasil: `/dashboard`

---

## 5. Dashboard (`/dashboard`)

### 5.1 Smart Batch Uploader
- Card full-lebar, background `card`
- Badge last upload: `"Last upload: [tanggal] · [N] item di-parse"` — background `rgba(34,197,94,0.1)`, color `green`
- Drop zone: `border 2px dashed border2`, hover: `border-color → accent`
- Label: `"Click to upload or drag and drop"` + `".xls and .xlsx supported"`
- Klik → file input (hidden) `accept=".xls,.xlsx"`

### 5.2 Stat Cards (4 kolom)

| Kartu | Nilai / Source | Icon | Color Sub |
|---|---|---|---|
| Total Products | `COUNT master_bahan` | 📦 | Blue |
| Available Stocks | `COUNT status = SAFE` | ✅ | Green |
| Warning + Critical | `COUNT WARNING + CRITICAL` | ⚠ | Amber |
| Out of Stocks | `COUNT status = CRITICAL` | 🚫 | Red |

### 5.3 Widget Row (2×2)

**Widget 1 — Top Contributors**
- List 3 user paling aktif (upload + PO)
- Setiap baris: avatar gradient (initial nama), nama bold, `"X uploads · Y POs"`, badge total aksi

**Widget 2 — Audit Pengeluaran**
- Total Outstanding + Total Paid (angka besar)
- Mini bar chart top 3 vendor: nama + nominal merah + progress bar

**Widget 3 — Smart Stock Warning**
- Iterasi CRITICAL dulu lalu WARNING, max 3 item
- Setiap item: card mini, nama + badge status, stok + estimasi hari habis (`floor(stok / avg_daily_consumption)`)
- Empty state: icon 🔥 + `"Semua stok aman"`

**Widget 4 — AI Predictive Restock**
- Label `"✦ AI Predictive Restock (Gemini)"`
- Background gelap dengan blob dekoratif sudut kanan atas
- Per critical item: nama, estimasi hari, badge tipe bahan, badge lead time, teks AI
- Empty state: icon ✦ opacity rendah + `"Upload kartu stok untuk mengaktifkan AI"`

### 5.4 Tabel Inventory

| Kolom | Spesifikasi |
|---|---|
| # | Nomor urut, 10px muted |
| ID Bahan | Monospace muted — `BHN-001` |
| Nama Bahan | Bold |
| Tipe | Badge: `packaged` (biru 📦) / `raw_bulk` (hijau 🌿) |
| Stok Akhir | Nilai bold + satuan 9px muted. **Sumber: upload Pawoon (transient)** |
| Min. Stok | Nilai muted |
| Status | Badge 3 warna sesuai logika threshold |
| Vendor | Nama vendor utama (primary dari `vendor_bahan`) |
| Harga Beli | `Rp` formatted |
| Aksi | CRITICAL/WARNING: `"+ Rancang PO"`. Setelah klik: `"✓ In Cart"` (hijau). SAFE: `"—"` |

### 5.5 PO Cart Sidebar (300px)

- Header: `"Keranjang PO"` bold + badge count bulat accent
- Setiap item: nama, vendor, badge template (`Packaged` / `Raw/Bulk + AI Research`), input qty
- **Khusus `raw_bulk`:** panel `"✦ AI Research"` — estimasi harga pasar + estimasi yield ke menu
- CTA bawah: `"+ Buat [N] Draft PO"`, full-width, gradient accent
- Empty state: icon 🛒 + teks panduan

### 5.6 PO Logs Section (bawah)

| Kolom | Spesifikasi |
|---|---|
| PO ID | Monospace accent bold — format `PO-001` (bukan hash) |
| Tanggal | `created_at` formatted |
| Vendor | Nama vendor |
| Total Item | Jumlah bahan |
| Total Biaya | Rp, color red bold |
| Status | Badge: `DRAFT` (abu) / `SENT` (amber) / `RECEIVED` (hijau) |
| Action | Tombol `Detail` (biru) + `PDF` (ghost) |

---

## 6. Stores (`/stores`)

### 6.1 Stat Cards (4 kolom)

| Kartu | Nilai | Sub |
|---|---|---|
| Total Outlet | `COUNT outlets` | Aktif |
| Inventory Net Worth | `SUM nilai stok semua outlet` | Total semua cabang (Rp) |
| Avg Upload Compliance | Rata-rata % upload per outlet | Target: 80% |
| Outlets Butuh Perhatian | `COUNT outlet compliance < 50%` | Compliance rendah |

### 6.2 Tab Overview — Upload Compliance per Outlet

| Kolom | Spesifikasi |
|---|---|
| Outlet ID | Monospace muted — `O-001` |
| Nama Outlet | Bold |
| Upload Compliance | Progress bar (max-width 80px) + %. Warna: hijau ≥70%, amber ≥50%, merah <50% |
| Inventory Net Worth | `Rp [nilai] jt` bold |
| Critical | Badge merah + count |
| Warning | Badge amber + count |
| Aksi | Tombol `Detail` biru |

### 6.3 Tab Menu Profitability Matrix

| Kolom | Spesifikasi |
|---|---|
| Nama Menu | Teks |
| COGS | Rp formatted, color `sub` |
| Harga Jual | Rp formatted, bold |
| Margin | Badge hijau ≥65%, amber <65%. Format: `"[N]%"` |
| Terjual/Bulan | N porsi, color `sub` |
| Kontribusi | Mini progress bar + nominal Rp keuntungan (accent, format `[N]k`) |

---

## 7. Products & Recipes (`/products`)

### 7.1 Stat Bar (3 kartu)

| Kartu | Source | Color |
|---|---|---|
| Master Bahan Baku | `COUNT master_bahan` | Blue |
| Bill of Materials | `COUNT menu dengan recipe` | Amber |
| Master Menu Final | `COUNT master_menu` | Accent |

### 7.2 Tab Selector
- Container: `background #14142A`, padding `4px`, border-radius `8px`
- Tab: `1. Master Bahan` | `2. Master Resep` | `3. Master Menu`

### 7.3 Tab 1 — Master Bahan

| Kolom | Spesifikasi |
|---|---|
| ID | Monospace muted |
| Nama Bahan | Bold |
| Tipe | Badge `packaged` (biru) / `raw_bulk` (hijau) |
| Kemasan Beli | `"1 karung"` |
| Satuan Dapur | `"gram"` |
| Min. Stok | Angka + satuan |
| Harga Beli | Rp formatted |
| Isi/Yield | Angka (isi per kemasan) |
| Harga/Porsi | Rp calculated, color `accent` bold |
| Aksi | Tombol ✏ |

**Modal Tambah Bahan:**

| Field | Tipe | Placeholder |
|---|---|---|
| Nama Bahan Khusus * | Text | `Cth: Stok Makanan - Beras` |
| Tipe Bahan * | Select | `packaged \| raw_bulk` |
| Kemasan Beli | Text | `1_karung` |
| Satuan Dapur | Text | `gram` |
| Batas Minimum Stock | Number | `5000` |
| Harga Beli Kemasan | Number | `610000` |
| Isi Kemasan (Yield) | Number | `50000` |

### 7.4 Tab 2 — Master Resep (BOM)

| Kolom | Spesifikasi |
|---|---|
| ID Menu | Monospace muted |
| Nama Menu | Bold |
| Outlet | Kode outlet |
| Komposisi | Chip kecil per bahan — `"Beras 150g"`, `background #14142A` |
| Total COGS | `SUM(qty × harga_per_satuan_porsi)`, color `accent` bold |

### 7.5 Tab 3 — Master Menu

| Kolom | Spesifikasi |
|---|---|
| ID Menu | Monospace muted |
| Nama Menu | Bold |
| Kategori | Badge biru — Food / Beverage |
| Outlet | Kode |
| Recipe Overview | Badge hijau `"✓ Recipe Built"` / abu `"No Recipe"` |
| Total COGS | Rp accent jika > 0, muted jika 0 |
| Aksi | Tombol `"+ Edit Resep"` (accent transparan) |

**Modal BOM Editor (Multi-Level) — Width 620px:**
- Dropdown `Menu Target *`
- Setiap baris komposisi: `[Select Tipe 120px] [Select Item flex] [Qty 70px] [Satuan 80px] [Sub-COGS 90px] [🗑 30px]`
- Select Tipe: `Bahan` atau `Sub-Resep`
- Panel bawah: `"Total COGS Saat Ini"` — SUM real-time, 14px bold accent
- Tombol: `Batal` (ghost) + `Simpan Multi-Level Resep` (primary)

---

## 8. Assets & Inventory (`/category`)

3 tab: Barang Habis Pakai, Aset Tetap, Mutasi Antar Cabang.

### Tab: Barang Habis Pakai

| Kolom | Spesifikasi |
|---|---|
| ID | `CON-xxx`, monospace |
| Nama Barang | Bold |
| Kategori | Badge biru |
| Outlet | Kode |
| Stok | Nilai + satuan |
| Min. Stok | Angka muted |
| Status | `"🔴 Low Stock"` jika `stok < minStok`, `"🟢 OK"` jika sebaliknya |
| Aksi | ✏ |

### Tab: Aset Tetap

| Kolom | Spesifikasi |
|---|---|
| ID | `AST-xxx` |
| Nama Aset | Bold |
| Kategori | Badge biru |
| Outlet | Kode |
| Tgl Beli | Tanggal muted |
| Nilai | Rp bold |
| Kondisi | Badge hijau `"Baik"` / merah `"Rusak"` |

### Tab: Mutasi Antar Cabang
- Empty state: icon ↔ + teks panduan
- Tabel jika ada data: Item, Dari, Ke, Qty, Tanggal, Status

---

## 9. Suppliers (`/suppliers`)

### 9.1 Stat Cards (3 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| Total Vendor | `COUNT master_vendor` | Blue |
| Total Bahan | `COUNT distinct vendor_bahan` | Green |
| Vendor dengan WA | `COUNT vendor dengan kontak_wa` | Accent |

### 9.2 Tabel Daftar Vendor

| Kolom | Spesifikasi |
|---|---|
| Nama Vendor | Bold |
| WhatsApp | Hijau `"📱 [nomor]"` jika ada, `"—"` jika kosong |
| Info Pembayaran | `no_rekening`, color `sub` |
| Lead Time | Badge biru `"⏱ [N] hari"` |
| Item | `COUNT vendor_bahan`, color `sub` |
| Pengeluaran | `SUM total_harga PO RECEIVED`, color `accent` bold |
| Aksi | ✏ + tombol `"Detail →"` (biru) |

Klik baris → **View Detail Vendor** (client-side state).

### 9.3 View Detail Vendor
- Tombol `"← Kembali"` di kiri atas
- 4 kartu: 📞 Kontak WA, 💳 Info Pembayaran, ⏱ Lead Time, 📈 Total Pengeluaran
- 2 kartu statistik: Pengeluaran Bulan Ini, Rata-rata PO per Bulan
- Tabel PO history vendor

### 9.4 Modal Tambah Vendor

| Field | Wajib |
|---|---|
| Nama Vendor | Ya |
| Nomor WhatsApp | Tidak |
| Lead Time (hari) | Ya |
| Info Rekening / Pembayaran | Tidak |
| Outlet | Tidak |

---

## 10. Billing (`/billing`)

### 10.1 Stat Cards (4 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| Total Invoice | `COUNT purchase_orders` | Blue |
| Outstanding | `SUM non-RECEIVED` + count | Amber |
| Lunas | `SUM RECEIVED` + count | Green |
| Bulan Ini | `SUM total_harga PO bulan ini` | Accent |

### 10.2 Tabel Invoice

| Kolom | Spesifikasi |
|---|---|
| Invoice ID | Monospace accent bold — `PO-001` |
| Tanggal | `created_at`, color `sub` |
| Vendor | Nama vendor, bold |
| Total Item | Jumlah bahan |
| Total Biaya | Rp, color red bold |
| Status | `"✓ LUNAS"` (hijau) jika RECEIVED / `"⏳ UNPAID"` (amber) lainnya |
| Action | `Detail` (biru) + `PDF` (ghost) + `"✓ Tandai Lunas"` (primary) jika belum RECEIVED |

---

## 11. Upload History (`/upload-history`)

| Kolom | Spesifikasi |
|---|---|
| ID | `UPL-xxx`, monospace muted |
| File | Nama file + icon 📄 |
| Outlet | Badge biru |
| Uploaded By | Nama user |
| Items Parsed | Jumlah baris / `"—"` jika error |
| Status | `"✓ Success"` hijau / `"✕ Error"` merah |
| Tanggal | Timestamp |

---

## 12. PO Logs (`/po-logs`)

### 12.1 Stat Cards (4 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| Total PO | `COUNT purchase_orders` | Blue |
| Draft | `COUNT status = draft` | Gray/muted |
| Sent | `COUNT status = sent` | Amber |
| Received | `COUNT status = received` | Green |

### 12.2 Tabel PO

| Kolom | Spesifikasi |
|---|---|
| PO ID | Monospace accent bold — `PO-001` |
| Bahan | Bold |
| Vendor | Color `sub` |
| Outlet | Badge biru |
| Qty | Nilai + satuan |
| Total Biaya | Rp bold |
| Status | Badge: `DRAFT` abu / `SENT` amber / `RECEIVED` hijau |
| Dibuat Oleh | Nama user |
| Tanggal | Timestamp |
| Action | `DRAFT` → `"📤 Kirim"` \| `SENT` → `"✓ Terima"` \| semua → `"PDF"` |

Klik baris → **Modal Detail PO**

### 12.3 Modal Detail PO
- Grid 2 kolom: Bahan, Vendor, Outlet, Qty, Total Biaya, Dibuat Oleh
- **STATUS TIMELINE visual:** 3 circle `DRAFT → SENT → RECEIVED`
  - Circle active: background rgba sesuai status, border 2px, icon ✓
  - Badge `"Current"` di status aktif
- Tombol: aksi sesuai status + `"📄 Export PDF"`

### 12.4 Logika PO Dual-Template

**Template A — Packaged:**

| Field | Keterangan |
|---|---|
| Vendor | Select dari `vendor_bahan` untuk bahan ini |
| Item / Bahan | Nama bahan (read-only dari cart) |
| Qty | Input number (pack, pcs, unit) |
| Harga Satuan | Manual atau dari `vendor_bahan.harga_per_satuan` |
| Estimasi Tiba | Auto: `created_at + lead_time_days` |
| Total Harga | Generated: `qty × harga_satuan` (read-only) |
| Catatan AI | Teks narasi Gemini (read-only, auto-generated) |

**Template B — Raw/Bulk (semua field A, plus):**

| Field Tambahan | Keterangan |
|---|---|
| Panel `"✦ AI Research"` | Muncul otomatis untuk `raw_bulk` |
| Estimasi Harga Pasar | Hybrid: cache Gemini / fetch terbaru. Format: `Rp [N]/kg` |
| Estimasi Qty Optimal | Dari AI: qty berdasarkan harga + konsumsi + buffer 5 hari |
| Estimasi Yield | Dari `mapping_resep`: `"[N] porsi [nama_menu]"` |

---

## 13. Delivery (`/delivery`)

### 13.1 Stat Cards (3 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| In Transit | `COUNT status = in_transit` | Blue |
| Pending | `COUNT status = pending` | Amber |
| Delivered | `COUNT status = delivered` | Green |

### 13.2 Tabel Tracking

| Kolom | Spesifikasi |
|---|---|
| DEL ID | `DEL-xxx`, monospace muted |
| PO ID | `PO-xxx`, monospace accent |
| Vendor | Bold |
| Bahan | Nama bahan |
| Qty | Nilai + satuan |
| ETA | `created_at + lead_time_days` |
| Status | `Delivered` hijau / `In Transit` biru / `Pending` amber |
| Aksi | Belum delivered: `"✓ Konfirmasi Terima"` (biru). Delivered: `"✓ Selesai"` hijau. |

> Konfirmasi Terima: mengubah `PO.status → received`, menambah `qty_order` ke stok bahan.

---

## 14. Report (`/report`)

### 14.1 Header Controls
- Filter periode: `Minggu Ini` / `Bulan Ini` / `Tahun Ini`
- Tombol `Export Excel` (ghost)

### 14.2 Stat Cards (4 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| Total Pengeluaran | `SUM total_harga PO periode` | Red |
| Total PO Selesai | `COUNT PO RECEIVED periode` | Green |
| Avg Lead Time | `AVG lead time semua vendor` (hari) | Blue |
| Item Critical | `COUNT bahan CRITICAL saat ini` | Red |

### 14.3 Chart Tren Pengeluaran
- 12 bar (Jan–Des), height area `140px`
- Bar bulan aktif: `linear-gradient(180deg, #C8F135, #86EF3C)`, solid
- Bar lainnya: `rgba(200,241,53,0.2)`, border `rgba(200,241,53,0.1)`
- Label nilai di atas, label bulan di bawah

### 14.4 Grid Bawah (2 kolom)
- **Kiri — Top 5 Bahan by Pengeluaran:** nama, nominal merah, progress bar gradient accent
- **Kanan — Performa Vendor:** tabel lead time estimasi vs aktual + badge `"⭐ On Time"` / `"⚠ Terlambat"`

---

## 15. Users (`/users`) — Admin Only

> 🔒 HANYA dapat diakses role **Admin**. Manager → redirect `/dashboard`.

### 15.1 Admin-Only Banner
- Card info di atas tabel: `background rgba(200,241,53,0.04)`, border `rgba(200,241,53,0.15)`

### 15.2 Stat Cards (3 kolom)

| Kartu | Nilai | Color |
|---|---|---|
| Total Pengguna | `COUNT users` | Blue |
| Admin | `COUNT role = admin` | Accent |
| Manager | `COUNT role = manager` | Green |

### 15.3 Tabel Pengguna

| Kolom | Spesifikasi |
|---|---|
| USERNAME / EMAIL | Avatar 34px + nama bold + badge `"ANDA"` jika akun sendiri + email 11px muted |
| ROLE | Badge dot: Admin `#C8F135` / Manager `#60A5FA` |
| OUTLET | Nama outlet |
| TERDAFTAR SEJAK | `created_at` |
| STATUS | `"● Aktif"` (hijau) / `"○ Nonaktif"` (muted) |
| AKSI | `Edit` (biru) + 🗑 (merah). Tidak tampil untuk baris akun sendiri. |

### 15.4 Flow Tambah User

1. Admin klik `"👤+ Tambah Pengguna"`
2. Modal Tambah User muncul (width `480px`)
3. Admin isi form: Nama Lengkap \*, Email Google \*, Role (select), Outlet (select)
4. Password **auto-generated 12 karakter** (huruf besar+kecil+angka+simbol). Tombol `↻ Regenerate`.
5. Admin klik `"✓ Buat Akun & Tampilkan Kredensial"`
6. Validasi: format email, cek duplikasi, field wajib
7. Jika valid: user tersimpan ke DB, **Credential Card muncul**
8. Admin salin & kirim kredensial ke user via WhatsApp/DM

### 15.5 Credential Card (One-Time Display)

| Elemen | Spesifikasi |
|---|---|
| Overlay | `rgba(0,0,0,0.8)`, flex center |
| Card | Width `480px`, border `rgba(200,241,53,0.3)`, glow effect |
| Warning | `"⚠ Tampil sekali saja — salin dan kirim ke user secara private"` (amber) |
| Row Email | Monospace accent. Tombol `Copy` → setelah copy: `"✓ Copied"` hijau |
| Row Password | Default tersembunyi, toggle 👁/🙈, warna amber. Tombol `Copy` |
| Copy All Button | `"📋 Copy Semua Kredensial (Siap Kirim)"` → setelah klik: `"✓ Disalin!"` |
| Footer note | `"User wajib ganti password setelah login pertama kali."` |
| CTA Tutup | Full-width gradient accent, `"✓ Selesai, Tutup"` |

**Format teks Copy All:**
```
[OMNI-STOCK Login]
Nama: [nama]
Email: [email]
Password: [password]
Role: [ROLE]
Outlet: [outlet]

Login: http://[domain]/login
```

### 15.6 Delete User Flow
- Klik 🗑 → Confirm Dialog
- Dialog: icon ⚠, konfirmasi dengan email user warna merah
- Tombol: `Batal` (ghost) + `Ya, Hapus` (danger)

---

## 16. Settings (`/settings`) — Admin Only

> 🔒 HANYA dapat diakses role **Admin**.

Layout: grid 2 kolom, gap `16px`, 4 card.

### Card 1 — One-Way Bridge Migration

| State | Tampilan |
|---|---|
| Belum migrasi | Status box amber `"⚠ Ready to Migrate"`. Tombol aktif: `"🔄 Sync from Google Sheets"` |
| Sudah migrasi | Status box hijau `"✅ Migration Complete"`. Tombol **disabled** permanen: `"✓ Migration Complete (Locked)"` |

> Setelah sukses: `system_configs.is_initial_migration_done = 'true'`. **Tombol tidak pernah bisa diklik lagi.**

### Card 2 — Supabase PITR Backup
- Status `"● PITR Active"` hijau + last backup timestamp
- Toggle on/off visual (konfigurasi aktual di Supabase dashboard)
- Info: Retention Period, Region, Storage usage

### Card 3 — Auth (Better Auth)
- Info read-only: Provider, Library, Session, Allowed Domain

### Card 4 — System Info
- Info read-only (warna accent): Version, Framework, Database, ORM, AI Engine, Deployment, ID Format

---

## 17. Database Schema

> 11 tabel dengan Drizzle ORM. **Text Primary Key kustom — tidak ada UUID.** Format: `PREFIX-001`.

### 17.1 Daftar Tabel

| No | Tabel | Prefix ID | Keterangan |
|---|---|---|---|
| 1 | `system_configs` | — | Key-value config global |
| 2 | `users` | `USR-xxx` | Akun pengguna + role |
| 3 | `outlets` | `OUT-xxx` | Data cabang/outlet |
| 4 | `master_bahan` | `BHN-xxx` | Katalog bahan baku + tipe + threshold |
| 5 | `semi_finished` | `SFG-xxx` | Bahan setengah jadi (BOM level 2) |
| 6 | `master_menu` | `MNU-xxx` | Menu final yang dijual |
| 7 | `mapping_resep` | `RSP-xxx` | Junction BOM (menu/SFG → bahan/SFG) |
| 8 | `master_vendor` | `VND-xxx` | Data pemasok |
| 9 | `vendor_bahan` | `VBH-xxx` | Many-to-many vendor ↔ bahan |
| 10 | `sales_transactions` | `TRX-xxx` | Log penjualan dari upload Pawoon |
| 11 | `purchase_orders` | `PO-xxx` | PO dengan status tracking |

### 17.2 Skema Detail

#### `system_configs`
```
key    text PK   — e.g., "is_initial_migration_done"
value  text      — e.g., "true"
```

#### `users`
```
id                    text PK          — USR-001
email                 text UNIQUE NN   — Email Google
nama                  text NN
role                  enum NN          — 'admin' | 'manager'
password_hash         text
must_change_password  boolean DEFAULT true
outlet_id             text FK → outlets  — NULL = semua outlet (admin)
created_at            timestamp DEFAULT now()
```

#### `outlets`
```
id           text PK   — OUT-001
nama_outlet  text NN
```

#### `master_bahan`
```
id                       text PK          — BHN-001
outlet_id                text FK → outlets
nama_bahan               text NN
tipe_bahan               enum NN          — 'packaged' | 'raw_bulk'
kategori_bahan           text
harga_beli               numeric NN       — Harga per kemasan
satuan_beli              text NN          — e.g., '1_karung'
isi_satuan               numeric NN       — Yield per kemasan
satuan_dapur             text NN          — e.g., 'gram'
stok_minimum             integer NN       — Threshold merah
lead_time_days           integer NN
avg_daily_consumption    float NN         — Hybrid: manual atau auto
avg_consumption_source   enum DEFAULT 'manual'  — 'manual' | 'auto'
harga_per_satuan_porsi   numeric          — Auto-calculated
```

> ⚠️ **TIDAK ADA kolom `stok_saat_ini`**. Stok aktual hanya berasal dari upload kartu stok (transient per sesi).

#### `semi_finished`
```
id                  text PK   — SFG-001
outlet_id           text FK → outlets
nama_semi_finished  text NN
satuan              text NN
stok_minimum        numeric NN   — Threshold minimum, BUKAN stok_saat_ini
```

#### `master_menu`
```
id          text PK   — MNU-001
nama_menu   text NN
outlet_id   text FK → outlets
kategori    enum      — 'food' | 'beverage'
harga_jual  numeric
total_cogs  numeric   — Di-update setiap mapping_resep berubah
```

#### `mapping_resep`
```
id           text PK   — RSP-001
parent_id    text NN   — MNU-xxx atau SFG-xxx
parent_type  enum NN   — 'menu' | 'semi_finished'
item_id      text NN   — BHN-xxx atau SFG-xxx
item_type    enum NN   — 'bahan_dasar' | 'semi_finished'
qty          numeric NN
```

> Hierarki BOM: `menu → semi_finished → bahan_dasar`. **Maksimal 2 level.** Resolusi dengan 2 JOIN query.

#### `master_vendor`
```
id                    text PK   — VND-001
nama_vendor           text NN
no_rekening           text
kontak_wa             text      — Nomor WhatsApp
estimasi_pengiriman   integer NN  — Lead time default (hari)
```

#### `vendor_bahan` (Many-to-Many)
```
id               text PK   — VBH-001
vendor_id        text FK → master_vendor NN
bahan_id         text FK → master_bahan NN
harga_per_satuan numeric NN  — Harga spesifik vendor ini untuk bahan ini
is_primary       boolean DEFAULT false
```

#### `sales_transactions`
```
id                  text PK   — TRX-001
outlet_id           text FK → outlets NN
upload_batch_id     text NN   — Grouping per sesi upload
tanggal_transaksi   date NN
menu_id             text FK → master_menu NN
qty_terjual         integer NN
created_at          timestamp DEFAULT now()
```

#### `purchase_orders`
```
id              text PK             — PO-001
outlet_id       text FK → outlets NN
vendor_id       text FK → master_vendor NN
bahan_id        text FK → master_bahan NN
status          enum NN DEFAULT 'draft'   — 'draft' | 'sent' | 'received'
qty_order       numeric NN
harga_satuan    numeric NN
total_harga     numeric NN          — Generated: qty_order × harga_satuan
ai_notes        text                — Teks rekomendasi Gemini
tanggal_kirim   timestamp           — Diisi otomatis saat → sent
tanggal_terima  timestamp           — Diisi otomatis saat → received
created_by      text FK → users NN
created_at      timestamp DEFAULT now()
```

---

## 18. Logika Status 3 Warna

| Status | Formula (Server-side) | Tampilan | Aksi Tabel |
|---|---|---|---|
| 🟢 **SAFE** | `stok_akhir > (stok_minimum + (lead_time_days × avg_daily_consumption))` | Badge hijau | `"—"` |
| 🟠 **WARNING** | `stok_akhir ≤ (stok_minimum + (lead_time_days × avg_daily_consumption))` | Badge amber | Tombol `"+ Rancang PO"` amber |
| 🔴 **CRITICAL** | `stok_akhir ≤ stok_minimum` | Badge merah | Tombol `"+ Rancang PO"` merah |

> ⚠️ `stok_akhir` **BUKAN kolom permanen** di database. Nilainya adalah data transient dari hasil upload kartu stok. Kalkulasi status dilakukan di server setelah upload berhasil diproses.

---

## 19. AI Engine — Gemini API

### 19.1 Input per Item
- `stok_akhir` (transient dari upload)
- `stok_minimum`, `lead_time_days`, `avg_daily_consumption` (dari `master_bahan`)
- `tipe_bahan` → menentukan template prompt
- Untuk `raw_bulk` saja: yield dari `mapping_resep` + harga pasar dari Gemini web research

### 19.2 Output AI
- **Status warna:** dihitung server-side dengan formula Section 18, **bukan oleh AI**
- **Teks narasi:** natural language, disimpan di `purchase_orders.ai_notes`
- Untuk `raw_bulk`: estimasi qty optimal + estimasi yield ke produk akhir

### 19.3 Template Prompt

**Packaged:**
```
Stok saat ini {qty} {satuan}, konsumsi {avg}/hari, lead time {lt} hari.
Stok akan habis dalam {X} hari. Order {qty_rec} untuk buffer 5 hari ke depan.
```

**Raw / Bulk:**
```
Stok saat ini {qty} {satuan}, konsumsi {avg}/hari, lead time {lt} hari.
Stok akan habis dalam {X} hari. Order {qty_rec} untuk buffer 5 hari ke depan.
Estimasi harga pasar hari ini: Rp {harga}/kg.
Qty ini mencukupi kebutuhan ±{porsi} porsi {nama_menu}.
```

### 19.4 Test Case & Exit Criteria AI

| Input | Expected Output |
|---|---|
| Stok: 100g, Konsumsi: 500g/hari, LT: 1 hari, Min: 200g | Status 🔴 CRITICAL. Teks mengandung `"habis dalam"` DAN `"BUAT PO"` |
| Stok: 800g, Konsumsi: 500g/hari, LT: 1 hari, Min: 200g | Status 🟠 WARNING. Teks mengandung `"order sekarang"` |
| Stok: 2000g, Konsumsi: 500g/hari, LT: 1 hari, Min: 200g | Status 🟢 SAFE. Teks mengandung `"aman"` atau `"sufficient"` |

---

## 20. Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| Fullstack Framework | Next.js 15 | App Router, Server Components + Server Actions |
| UI Library | shadcn/ui | Dark theme preset |
| Styling | Tailwind CSS v3 | Utility-first, custom dark tokens |
| Database | **Supabase** | PostgreSQL managed, realtime, PITR built-in |
| ORM | Drizzle ORM | Type-safe, null-safe, push migration |
| Autentikasi | Better Auth | TypeScript-native, Google SSO + credential provider |
| AI Engine | Google Gemini API | Flash/Pro model, web research untuk harga pasar |
| Deployment | Vercel | Edge network, auto-deploy |
| Backup | Supabase PITR | Point-in-Time Recovery (Pro plan) |
| Integrasi 1 | Google Sheets API | One-time migration, Service Account auth |
| Integrasi 2 | xlsx / SheetJS | Parse `.xls` dan `.xlsx` dari upload Pawoon |

---

## 21. Environment Variables

| Variable | Keterangan | Wajib |
|---|---|---|
| `DATABASE_URL` | Supabase direct connection string (port 5432) | Ya |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL `https://xxx.supabase.co` | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key dari Supabase dashboard | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) | Ya |
| `GOOGLE_CLIENT_ID` | OAuth Client ID untuk Better Auth + Google SSO | Ya |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | Ya |
| `BETTER_AUTH_SECRET` | Secret key untuk signing JWT session | Ya |
| `GEMINI_API_KEY` | Google AI Studio API Key | Ya |
| `GSHEET_SERVICE_ACCOUNT_KEY` | JSON Service Account Google Sheets API | Ya (migrasi) |
| `GSHEET_SPREADSHEET_ID` | ID spreadsheet sumber data lama | Ya (migrasi) |
| `NEXT_PUBLIC_APP_URL` | Base URL deployment | Ya |

---

## 22. Implementation Roadmap (Phase 1)

### 22.1 Urutan Pengerjaan

| # | Task | Output |
|---|---|---|
| 1 | Setup repo & environment | Next.js 15, Tailwind, shadcn/ui, Drizzle, Better Auth configured |
| 2 | Inisialisasi DB schema | `drizzle-kit push` — 11 tabel terbuat di Supabase |
| 3 | Seed admin pertama | Script seed: 1 user role admin, `must_change_password: false` |
| 4 | Shell layout | Sidebar + Topbar: collapse, active nav, notif dropdown |
| 5 | Login page + Auth | Form, Better Auth, session, redirect, role guard |
| 6 | Dashboard — uploader + stat | Upload `.xls/.xlsx`, parse, stat cards, widget row |
| 7 | Dashboard — tabel + PO cart | Tabel inventory, status 3 warna, cart sidebar, draft PO |
| 8 | Products & Recipes — 3 tab | Master Bahan, BOM editor, Master Menu + semua modal |
| 9 | Suppliers — list + detail | List vendor, drill-down, tambah vendor modal |
| 10 | PO Logs + modal + dual template | Tabel PO, modal detail + timeline, template A & B |
| 11 | Delivery tracking | Tabel delivery, konfirmasi terima, update stok |
| 12 | Billing | Tabel invoice, filter, tandai lunas |
| 13 | Stores | Compliance tab + profitability tab |
| 14 | Assets & Inventory | 3 tab: habis pakai, aset, mutasi |
| 15 | Upload History | Tabel log semua upload batch |
| 16 | Report + chart | Bar chart + top 5 + vendor performance |
| 17 | Users — admin only | Tabel, tambah user, credential card, delete |
| 18 | Settings — admin only | Migration card (lock), PITR info, auth info, system info |
| 19 | One-Way Migration GSheet | Integrasi Google Sheets API, eksekusi atomik, lock button |
| 20 | AI integration (Gemini) | Server Action Gemini call, output ke `ai_notes` + widget |
| 21 | QA & exit criteria check | Semua 12 checklist exit criteria terpenuhi |

### 22.2 Exit Criteria — Phase 1 Selesai ✅

| No | Kriteria | Status |
|---|---|---|
| 1 | Login Better Auth (email+password) berfungsi | ☐ |
| 2 | Role guard: Manager tidak bisa akses `/users` dan `/settings` | ☐ |
| 3 | Migration GSheet → Supabase sukses, tombol terkunci permanen | ☐ |
| 4 | Upload Excel Pawoon berhasil di-parse, `sales_transactions` terisi | ☐ |
| 5 | Status 3 warna tampil sesuai formula (3 test case Section 19.4) | ☐ |
| 6 | `avg_daily_consumption` terupdate otomatis setelah upload | ☐ |
| 7 | AI (Gemini) memberikan teks rekomendasi per item sesuai test case | ☐ |
| 8 | Template PO packaged dan raw/bulk tampil berbeda, panel AI Research muncul | ☐ |
| 9 | PO status tracking DRAFT→SENT→RECEIVED, stok terupdate saat Received | ☐ |
| 10 | Admin buat user baru, Credential Card tampil sekali, copy berfungsi | ☐ |
| 11 | Delete user berfungsi, confirm dialog muncul | ☐ |
| 12 | PITR aktif di Supabase dashboard | ☐ |

---

*— End of Document — OMNI-STOCK V1.5 PRD Final · Easy Going Group · Confidential*
