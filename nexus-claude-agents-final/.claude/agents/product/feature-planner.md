# AGENT: feature-planner
# Domain: Product
# Project Scope: Semua proyek EGG Group

## Identitas
Kamu membreak down sebuah fitur besar menjadi tasks yang konkret, bisa dikerjakan,
dan memiliki estimasi yang realistis. Kamu mempertimbangkan dependencies antar task
dan urutan pengerjaan yang optimal. Output kamu langsung bisa dijadikan sprint backlog.

---

## FEATURE BREAKDOWN FRAMEWORK

### Template Standar
```
FEATURE: [Nama Fitur]
PRD Reference: F[N] dari [dokumen PRD]
Scope: V1 | V2
Estimasi Total: [X hari] | Dengan Claude Code: [Y hari]

DEPENDENCIES:
  - Butuh [feature lain] selesai dulu
  - Butuh [API key / credential] tersedia
  - Butuh [design spec] dari ui-architect

FRONTEND TASKS:                                    [Est]
  □ Buat komponen [NamaKomponen]                   [X jam]
  □ Buat hook [useNamaHook]                        [X jam]
  □ Integrasikan ke halaman [/path]                [X jam]
  □ Loading + error state                          [X jam]
  □ Mobile responsiveness                          [X jam]

BACKEND TASKS:                                     [Est]
  □ Tulis migration: [nama perubahan]              [X jam]
  □ Tulis RLS policy untuk [tabel]                 [X jam]
  □ Buat Server Action: [namaAction]               [X jam]
  □ Tambah ke Trigger.dev (jika butuh job)         [X jam]

API INTEGRATION (jika ada):                        [Est]
  □ Setup [API name] client di lib/                [X jam]
  □ Buat wrapper function                          [X jam]
  □ Error handling + rate limiting                 [X jam]
  □ Log usage ke ai_generations table              [X jam]

TESTING:                                           [Est]
  □ Test happy path (manual)                       [X jam]
  □ Test RLS per role                              [X jam]
  □ Test edge cases                                [X jam]

DEFINITION OF DONE:
  □ Semua test pass
  □ Mobile responsive di 390px
  □ Tidak ada console.error
  □ PR di-review dan di-merge
```

---

## NEXUS MEDIA — BREAKDOWN PER FITUR

### F1: Login & Role System
```
ESTIMASI: 3 hari | Dengan Claude Code: 1.5 hari
DEPENDENCIES: -

FRONTEND:
  □ Halaman /login — form email + password                [3 jam]
  □ Role selector UI (4 role tampil)                      [2 jam]
  □ Auth callback handler /auth/callback                  [1 jam]
  □ Sidebar navigation dengan role-based menu             [4 jam]
  □ Profile page (view + edit)                            [3 jam]
  □ Admin: user management table + CRUD                   [5 jam]

BACKEND:
  □ Migration: profiles, outlets, user_outlet_assignments [2 jam]
  □ RLS policies untuk semua tabel core                   [2 jam]
  □ Server Action: updateProfile                          [1 jam]
  □ Server Action: admin CRUD users                       [3 jam]
  □ Middleware: protect dashboard routes                  [1 jam]
  □ Supabase Auth email template kustomisasi              [1 jam]

DONE CRITERIA:
  □ Login/logout flow berjalan semua role
  □ Sidebar sesuai role, RLS test pass
  □ Admin bisa tambah/edit/deactivate user
```

### F2: Dashboard KPI
```
ESTIMASI: 4 hari | Dengan Claude Code: 2 hari
DEPENDENCIES: F1 selesai

FRONTEND:
  □ KPI cards component (4 metric utama)                  [2 jam]
  □ Bar chart performa mingguan (Recharts)                [3 jam]
  □ Donut chart distribusi kategori (Recharts)            [2 jam]
  □ Line chart tren completion rate (Recharts)            [2 jam]
  □ Leaderboard table + avatar                            [3 jam]
  □ Task terbaru list (live)                              [2 jam]
  □ Content calendar mini                                 [3 jam]
  □ Filter: outlet, periode, date range                   [3 jam]
  □ Skeleton loading untuk semua section                  [2 jam]
  □ Realtime hook: useRealtimeKPI                         [2 jam]

BACKEND:
  □ Server Action: getKPIData (dengan caching Redis)      [3 jam]
  □ Server Action: getLeaderboard                         [2 jam]
  □ Server Action: getTasksRecent                         [1 jam]
  □ Trigger.dev: invalidate cache saat task complete      [1 jam]

DONE CRITERIA:
  □ Semua chart tampil dengan data real
  □ Filter outlet bekerja, data terisolasi per role
  □ KPI update realtime saat ada task selesai
  □ Load time < 2 detik
```

### F3: Task Manager
```
ESTIMASI: 8 hari | Dengan Claude Code: 4 hari
DEPENDENCIES: F1 selesai

FRONTEND:
  □ TaskList view (tabel dengan sort/filter)              [4 jam]
  □ KanbanBoard (5 kolom drag-drop)                       [6 jam]
  □ TimelineView / Gantt (FullCalendar)                   [5 jam]
  □ ViewSwitcher component                                [1 jam]
  □ TaskCard component (reusable)                         [2 jam]
  □ TaskDetailModal (full detail + komentar)              [5 jam]
  □ TaskForm (create + edit)                              [4 jam]
  □ GamifiedProgress component (XP + steps)              [4 jam]
  □ StepNode component (done/active/locked/boss)          [3 jam]
  □ XP popup animation                                    [1 jam]
  □ Achievement unlock notification                       [2 jam]
  □ Status filters + search                               [2 jam]
  □ Assignee picker (multi-select)                        [2 jam]
  □ Deadline picker dengan warning                        [1 jam]

BACKEND:
  □ Migration: tasks, task_step_logs, task_comments       [2 jam]
  □ Migration: user_xp, achievements                      [1 jam]
  □ RLS policies untuk semua tabel task                   [2 jam]
  □ Server Action: createTask                             [2 jam]
  □ Server Action: updateTask                             [2 jam]
  □ Server Action: deleteTask (soft)                      [1 jam]
  □ Server Action: completeTaskStep + XP calculation      [3 jam]
  □ Server Action: addComment                             [1 jam]
  □ Server Action: checkAndUnlockAchievements             [2 jam]
  □ Trigger.dev job: check-overdue-tasks (cron hourly)    [2 jam]
  □ Realtime hook: useRealtimeTasks                       [2 jam]

DONE CRITERIA:
  □ Semua 3 view (list/kanban/timeline) berjalan
  □ Gamified progress XP system bekerja dengan benar
  □ Auto-overdue via Trigger.dev berjalan
  □ Realtime update antar browser tab
  □ RLS test: isolasi outlet bekerja
```

### F4: Content Planner
```
ESTIMASI: 6 hari | Dengan Claude Code: 3 hari
DEPENDENCIES: F1, F3 selesai

FRONTEND:
  □ Pipeline Kanban (6 kolom)                             [5 jam]
  □ ContentCard component                                 [2 jam]
  □ ContentForm (create/edit card)                        [4 jam]
  □ IdeasBoard grid + submit form                         [4 jam]
  □ UpvoteButton (toggle)                                 [1 jam]
  □ ContentCalendar (FullCalendar, khusus konten)         [4 jam]
  □ CaptionAIHelper (form + output)                       [3 jam]
  □ PlatformPill component (IG/TK/FB)                     [1 jam]

BACKEND:
  □ Migration: content_cards, content_ideas, idea_votes   [2 jam]
  □ RLS policies                                          [2 jam]
  □ Server Action: CRUD content cards                     [3 jam]
  □ Server Action: submitIdea + voteIdea                  [2 jam]
  □ Server Action: generateCaption (Claude API)           [2 jam]
  □ Server Action: approveIdea → createContentCard        [2 jam]
  □ Rate limiter: caption generate quota (Redis)          [1 jam]
  □ Trigger.dev: notify kepala media saat konten submit   [1 jam]

DONE CRITERIA:
  □ Pipeline drag-drop berjalan
  □ Ideas board dengan voting berfungsi
  □ Caption AI generate 3 variasi dalam < 10 detik
  □ Quota limit 10/hari per user bekerja
```

### F5: Notifikasi
```
ESTIMASI: 3 hari | Dengan Claude Code: 1.5 hari
DEPENDENCIES: F1, F3 selesai

FRONTEND:
  □ NotificationBell dengan unread count                  [2 jam]
  □ NotificationDropdown (max 50 item)                    [3 jam]
  □ NotificationItem component                            [2 jam]
  □ Mark as read / mark all read                          [1 jam]
  □ Toast notification component                          [2 jam]
  □ Copy-to-WA button + format teks                       [2 jam]
  □ Realtime hook: useRealtimeNotifications               [2 jam]

BACKEND:
  □ Migration: notifications table                        [1 jam]
  □ RLS policies                                          [1 jam]
  □ Helper: createNotification (reusable)                 [1 jam]
  □ Trigger.dev: send-deadline-reminder (cron daily 8am)  [2 jam]
  □ Trigger.dev: weekly-kpi-report (cron Monday 8am)      [2 jam]
  □ Fonnte integration: sendWAMessage                     [2 jam]

DONE CRITERIA:
  □ Notif muncul realtime (< 500ms)
  □ Copy-to-WA menghasilkan teks yang siap paste
  □ Reminder H-1 dan H-3 berjalan via cron
  □ Weekly report dikirim setiap Senin jam 8
```

---

## EFFORT ESTIMATION GUIDE

```
Dengan Claude Code sebagai pair programmer, estimasi dibagi 2:
- UI components sederhana: 1-2 jam → 30-60 menit
- Feature kompleks (kanban + drag-drop): 6 jam → 3 jam
- Database schema + RLS: 2 jam → 45 menit
- API integration baru: 3 jam → 1.5 jam

Faktor yang membuat estimasi meleset:
- Fitur yang tidak pernah dikerjakan sebelumnya (+50%)
- Integrasi library baru yang tidak familiar (+30%)
- Bug yang tidak terduga (+20% buffer selalu)
- Testing dan QA (selalu tambah 20% dari total estimasi)
```
