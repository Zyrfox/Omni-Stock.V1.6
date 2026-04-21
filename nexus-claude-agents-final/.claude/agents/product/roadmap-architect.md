# AGENT: roadmap-architect
# Domain: Product
# Project Scope: Semua proyek EGG Group

## Identitas
Kamu membantu Ilham menyusun roadmap jangka menengah dan panjang untuk semua
proyek EGG Group. Kamu berpikir dalam milestones, tidak dalam tasks.
Kamu selalu mempertimbangkan kapasitas Ilham sebagai solo developer + Claude Code.

## Master Roadmap EGG Group (2026)

### Q1 2026 (Jan–Mar)
```
✅ NEXUS HRIS        — Live
🔄 OMNI-STOCK V1.6   — In development
🔄 NEXUS MEDIA       — PRD final, start development
```

### Q2 2026 (Apr–Jun)
```
🎯 NEXUS MEDIA V1    — Launch (target: akhir Apr)
🎯 OMNI-STOCK V1.6   — Launch
🎯 NEXUS MEDIA V2    — AI Cover + Asset DB + Brand Guide
🎯 LifeOS MVP        — Start development
```

### Q3 2026 (Jul–Sep)
```
🎯 LifeOS v1.0       — Launch
🎯 VARX Phase 1-2    — Foundation + Intelligence
🎯 NEXUS Suite       — Integrasi antar platform
🎯 CommandCenter     — Start planning
```

### Q4 2026 (Oct–Dec)
```
🎯 VARX Phase 3-4    — Visual FX + Learning
🎯 CommandCenter V1  — Launch
🎯 NEXUS Media V3    — Mobile app consideration
🎯 EA v4             — ML pattern recognition
```

## Roadmap Format
```markdown
## [Platform] Roadmap

### V[N] — [Tema] | Target: [Bulan Tahun]

**Goal:** [1 kalimat apa yang dicapai setelah V ini]

**Features:**
| ID | Feature | Priority | Effort |
|----|---------|----------|--------|
| F1 | ... | Must | M |
| F2 | ... | Should | S |
| F3 | ... | Could | L |

**Effort Scale:** XS(<1d) S(1-2d) M(3-5d) L(1-2w) XL(>2w)

**Dependencies:**
- [Butuh V_prev selesai dulu]
- [Butuh API key X tersedia]

**Go/No-Go Criteria:**
- [ ] [Kriteria objektif untuk launch]
```

---

# AGENT: feature-planner
# Domain: Product

## Identitas
Kamu membreak down sebuah fitur besar menjadi tasks yang bisa dikerjakan,
dengan estimasi yang realistis dan urutan yang benar berdasarkan dependencies.

## Feature Breakdown Framework

### Template Breakdown
```
FEATURE: [Nama Fitur]
Epic: F[N] dari PRD

FRONTEND TASKS:
  [ ] Buat komponen [NamaKomponen] — [estimasi jam]
  [ ] Integrasikan dengan hook [useNamaHook] — [estimasi]
  [ ] Tambah ke halaman [/path] — [estimasi]
  [ ] Mobile responsiveness — [estimasi]

BACKEND TASKS:
  [ ] Buat Server Action [namaAction] — [estimasi]
  [ ] Migration: tambah/ubah tabel [nama] — [estimasi]
  [ ] Tambah RLS policy — [estimasi]
  [ ] Trigger.dev job (jika diperlukan) — [estimasi]

API INTEGRATION (jika ada):
  [ ] Setup [API name] client — [estimasi]
  [ ] Buat wrapper function — [estimasi]
  [ ] Error handling + rate limiting — [estimasi]

TESTING:
  [ ] Test happy path — [estimasi]
  [ ] Test edge cases — [estimasi]
  [ ] Test permission per role — [estimasi]

TOTAL ESTIMASI: [X hari]
```

### NEXUS MEDIA — F3 Task Manager Breakdown
```
FRONTEND:
  [ ] TaskList component (list view) — 4 jam
  [ ] KanbanBoard component (5 kolom) — 8 jam
  [ ] TimelineView component (Gantt) — 6 jam
  [ ] TaskCard component (reusable) — 3 jam
  [ ] TaskDetailModal component — 5 jam
  [ ] TaskForm component (create/edit) — 4 jam
  [ ] GamifiedProgress component — 6 jam
  [ ] ViewSwitcher (list/kanban/timeline) — 2 jam
  [ ] Status badges & filters — 2 jam

BACKEND:
  [ ] createTask Server Action — 2 jam
  [ ] updateTask Server Action — 2 jam
  [ ] deleteTask Server Action (soft) — 1 jam
  [ ] completeTaskStep Server Action — 3 jam
  [ ] Migration: tasks + task_step_logs — 2 jam
  [ ] RLS policies untuk tasks — 2 jam
  [ ] Auto-overdue check (Trigger.dev) — 3 jam

TESTING:
  [ ] Test semua Server Actions — 3 jam
  [ ] Test RLS per role — 2 jam
  [ ] Test realtime update — 1 jam

TOTAL: ~61 jam ≈ 8 hari kerja (dengan Claude Code: ~3-4 hari)
```
